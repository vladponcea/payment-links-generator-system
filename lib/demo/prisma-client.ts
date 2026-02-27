/**
 * In-memory Prisma-compatible client for demo mode.
 *
 * Replaces the real PrismaClient when DEMO_MODE=true so the app can run
 * without a PostgreSQL database.  Every query pattern used across the
 * codebase (54 total across 5 models) is implemented here.
 */

import {
  demoUsers,
  demoPaymentLinks,
  demoPayments,
  demoWebhookEvents,
  demoAppSettings,
  type DemoUser,
  type DemoPaymentLink,
  type DemoPayment,
  type DemoWebhookEvent,
  type DemoAppSettings,
} from "./data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deep-clone an object so mutations don't affect the store. */
function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_key, value) =>
    value instanceof Date ? value.toISOString() : value,
  ), (_key, value) => {
    // Restore ISO date strings back to Date objects
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return value;
  });
}

let _idCounter = 0;
function generateId(): string {
  _idCounter += 1;
  return `demo_${Date.now()}_${_idCounter}`;
}

/**
 * Wrap a value so it behaves like a Promise (supports `.then`, `.catch`,
 * `.finally`).  This lets callers do `prisma.foo.findUnique({}).catch(...)`.
 */
function thenable<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

// ---------------------------------------------------------------------------
// Where-clause matching engine
// ---------------------------------------------------------------------------

/**
 * Check whether a single record matches a Prisma-style `where` clause.
 *
 * Supports:
 *  - simple equality                `{ status: "succeeded" }`
 *  - `contains` + `mode`            `{ name: { contains: "x", mode: "insensitive" } }`
 *  - `gte` / `lte`                  `{ paidAt: { gte: date, lte: date } }`
 *  - `not`                          `{ zapierStatus: { not: null } }` or `{ not: "value" }`
 *  - `OR` arrays                    `{ OR: [{...}, {...}] }`
 *  - nested relation filters on a *single* related record
 *    (resolved via the `resolvers` map — see DemoCollection)
 */
function matchesWhere(
  record: Record<string, unknown>,
  where: Record<string, unknown>,
  resolvers?: Record<string, (rec: Record<string, unknown>) => Record<string, unknown> | null>,
): boolean {
  if (!where || Object.keys(where).length === 0) return true;

  for (const [key, condition] of Object.entries(where)) {
    // --- OR -----------------------------------------------------------------
    if (key === "OR") {
      const orClauses = condition as Record<string, unknown>[];
      if (!orClauses.some((clause) => matchesWhere(record, clause, resolvers))) {
        return false;
      }
      continue;
    }

    // --- AND ----------------------------------------------------------------
    if (key === "AND") {
      const andClauses = Array.isArray(condition) ? condition : [condition];
      if (!andClauses.every((clause: Record<string, unknown>) => matchesWhere(record, clause, resolvers))) {
        return false;
      }
      continue;
    }

    // --- NOT (top-level) ----------------------------------------------------
    if (key === "NOT") {
      const notClauses = Array.isArray(condition) ? condition : [condition];
      if (notClauses.some((clause: Record<string, unknown>) => matchesWhere(record, clause, resolvers))) {
        return false;
      }
      continue;
    }

    // --- Nested relation filter ---------------------------------------------
    // e.g. { closer: { name: { contains: "x" } } }
    // e.g. { paymentLink: { planType: "down_payment" } }
    if (resolvers && key in resolvers && typeof condition === "object" && condition !== null) {
      const related = resolvers[key](record);
      if (!related) return false;
      if (!matchesWhere(related, condition as Record<string, unknown>)) return false;
      continue;
    }

    const value = record[key];

    // --- Object conditions (contains, gte, lte, not, in, etc.) --------------
    if (typeof condition === "object" && condition !== null && !Array.isArray(condition) && !(condition instanceof Date)) {
      const cond = condition as Record<string, unknown>;

      // { contains, mode }
      if ("contains" in cond) {
        const search = String(cond.contains);
        const val = value == null ? "" : String(value);
        if (cond.mode === "insensitive") {
          if (!val.toLowerCase().includes(search.toLowerCase())) return false;
        } else {
          if (!val.includes(search)) return false;
        }
        continue;
      }

      // { not: value }
      if ("not" in cond) {
        const notVal = cond.not;
        if (value === notVal) return false;
        // Check remaining conditions in the same object (e.g. { not: null, contains: "x" })
        const rest = { ...cond };
        delete rest.not;
        if (Object.keys(rest).length > 0) {
          if (!matchesWhere(record, { [key]: rest }, resolvers)) return false;
        }
        continue;
      }

      // { gte, lte } — date or number range
      let ok = true;
      if ("gte" in cond) {
        const gte = cond.gte instanceof Date ? cond.gte.getTime() : Number(cond.gte);
        const v = value instanceof Date ? value.getTime() : Number(value);
        if (isNaN(v) || v < gte) ok = false;
      }
      if ("lte" in cond) {
        const lte = cond.lte instanceof Date ? cond.lte.getTime() : Number(cond.lte);
        const v = value instanceof Date ? value.getTime() : Number(value);
        if (isNaN(v) || v > lte) ok = false;
      }
      if ("gt" in cond) {
        const gt = cond.gt instanceof Date ? cond.gt.getTime() : Number(cond.gt);
        const v = value instanceof Date ? value.getTime() : Number(value);
        if (isNaN(v) || v <= gt) ok = false;
      }
      if ("lt" in cond) {
        const lt = cond.lt instanceof Date ? cond.lt.getTime() : Number(cond.lt);
        const v = value instanceof Date ? value.getTime() : Number(value);
        if (isNaN(v) || v >= lt) ok = false;
      }

      // { in: [...] }
      if ("in" in cond) {
        const arr = cond.in as unknown[];
        if (!arr.includes(value)) ok = false;
      }

      if (!ok) return false;
      continue;
    }

    // --- Simple equality ----------------------------------------------------
    if (value !== condition) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Select / Include helpers
// ---------------------------------------------------------------------------

function applySelect<T extends Record<string, unknown>>(
  record: T,
  select: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!select) return { ...record };
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(select)) {
    if (key === "_count") continue; // handled separately
    if (val === true) {
      result[key] = record[key];
    } else if (typeof val === "object" && val !== null) {
      // Nested select on a relation — handled at the collection level
      result[key] = record[key];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function applyOrderBy<T extends Record<string, unknown>>(
  records: T[],
  orderBy: RecordAny | RecordAny[] | undefined,
): T[] {
  if (!orderBy) return records;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...records].sort((a, b) => {
    for (const order of orders) {
      for (const [field, dir] of Object.entries(order)) {
        const aVal = a[field];
        const bVal = b[field];
        let cmp = 0;
        if (aVal instanceof Date && bVal instanceof Date) {
          cmp = aVal.getTime() - bVal.getTime();
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          cmp = aVal - bVal;
        } else if (typeof aVal === "string" && typeof bVal === "string") {
          cmp = aVal.localeCompare(bVal);
        } else if (aVal == null && bVal != null) {
          cmp = -1;
        } else if (aVal != null && bVal == null) {
          cmp = 1;
        }
        if (dir === "desc") cmp = -cmp;
        if (cmp !== 0) return cmp;
      }
    }
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Collection base
// ---------------------------------------------------------------------------

type RecordAny = Record<string, unknown>;

interface CollectionContext {
  users: () => DemoUser[];
  paymentLinks: () => DemoPaymentLink[];
  payments: () => DemoPayment[];
  webhookEvents: () => DemoWebhookEvent[];
  appSettings: () => DemoAppSettings[];
}

// ---------------------------------------------------------------------------
// User Collection
// ---------------------------------------------------------------------------

class UserCollection {
  private store: DemoUser[];
  private ctx: CollectionContext;

  constructor(initial: DemoUser[], ctx: CollectionContext) {
    this.store = clone(initial);
    this.ctx = ctx;
  }

  // -- resolvers for nested relation filters ---------------------------------
  private relationResolvers(): Record<string, (rec: RecordAny) => RecordAny | null> {
    return {};
  }

  findUnique(args: {
    where: RecordAny;
    select?: RecordAny;
  }): Promise<RecordAny | null> {
    const { where, select } = args;

    let found: DemoUser | undefined;

    if (where.email) {
      found = this.store.find((u) => u.email === where.email);
    } else if (where.id) {
      found = this.store.find((u) => u.id === where.id);
    }

    if (!found) return thenable(null);

    // Additional where conditions (e.g. { id, role: "closer" })
    const rec = found as unknown as RecordAny;
    for (const [k, v] of Object.entries(where)) {
      if (k === "id" || k === "email") continue;
      if (rec[k] !== v) return thenable(null);
    }

    let result: RecordAny = clone(found) as unknown as RecordAny;

    // Resolve nested select relations (payments, _count, paymentLinks)
    if (select) {
      result = this.resolveSelectRelations(result, select);
      result = applySelect(result, select);
      // Handle _count inside select
      if (select._count) {
        result._count = this.resolveCount(found.id, select._count as RecordAny);
      }
    }

    return thenable(result);
  }

  findMany(args?: {
    where?: RecordAny;
    select?: RecordAny;
    orderBy?: RecordAny | RecordAny[];
  }): Promise<RecordAny[]> {
    const { where, select, orderBy } = args || {};

    let results = this.store.filter((u) =>
      matchesWhere(u as unknown as RecordAny, where || {}, this.relationResolvers()),
    );

    results = applyOrderBy(results as unknown as RecordAny[], orderBy) as unknown as DemoUser[];

    return thenable(
      results.map((u) => {
        let rec = clone(u) as unknown as RecordAny;
        if (select) {
          rec = this.resolveSelectRelations(rec, select);
          const selected = applySelect(rec, select);
          if (select._count) {
            selected._count = this.resolveCount(u.id, select._count as RecordAny);
          }
          return selected;
        }
        return rec;
      }),
    );
  }

  count(args?: { where?: RecordAny }): Promise<number> {
    if (!args?.where) return thenable(this.store.length);
    const count = this.store.filter((u) =>
      matchesWhere(u as unknown as RecordAny, args.where || {}, this.relationResolvers()),
    ).length;
    return thenable(count);
  }

  create(args: { data: RecordAny; select?: RecordAny }): Promise<RecordAny> {
    const now = new Date();
    const record: DemoUser = {
      id: generateId(),
      email: "",
      passwordHash: "",
      name: "",
      role: "closer",
      phone: null,
      avatarUrl: null,
      commissionType: "percentage",
      commissionValue: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...(args.data as Partial<DemoUser>),
    };
    this.store.push(record);

    let result: RecordAny = clone(record) as unknown as RecordAny;
    if (args.select) {
      result = applySelect(result, args.select);
    }
    return thenable(result);
  }

  update(args: { where: RecordAny; data: RecordAny; select?: RecordAny }): Promise<RecordAny> {
    const idx = this.store.findIndex((u) => u.id === args.where.id);
    if (idx === -1) throw new Error("Record not found");

    const updated = { ...this.store[idx], ...args.data, updatedAt: new Date() } as DemoUser;
    this.store[idx] = updated;

    let result: RecordAny = clone(updated) as unknown as RecordAny;
    if (args.select) {
      result = applySelect(result, args.select);
    }
    return thenable(result);
  }

  // -- private helpers -------------------------------------------------------

  private resolveSelectRelations(rec: RecordAny, select: RecordAny): RecordAny {
    const userId = rec.id as string;

    // payments nested select
    if (select.payments && typeof select.payments === "object") {
      const paymentOpts = select.payments as RecordAny;
      let payments = this.ctx.payments().filter((p) => p.closerId === userId);
      if (paymentOpts.where) {
        payments = payments.filter((p) =>
          matchesWhere(p as unknown as RecordAny, paymentOpts.where as RecordAny),
        );
      }
      if (paymentOpts.orderBy) {
        payments = applyOrderBy(
          payments as unknown as RecordAny[],
          paymentOpts.orderBy as RecordAny,
        ) as unknown as DemoPayment[];
      }
      if (paymentOpts.take) {
        payments = payments.slice(0, paymentOpts.take as number);
      }
      if (paymentOpts.select) {
        rec.payments = payments.map((p) =>
          applySelect(clone(p) as unknown as RecordAny, paymentOpts.select as RecordAny),
        );
      } else {
        rec.payments = clone(payments);
      }
    }

    return rec;
  }

  private resolveCount(userId: string, countSpec: RecordAny): RecordAny {
    const result: RecordAny = {};
    const selectSpec = countSpec.select as RecordAny | undefined;
    if (!selectSpec) return result;

    if (selectSpec.paymentLinks !== undefined) {
      if (selectSpec.paymentLinks === true) {
        result.paymentLinks = this.ctx.paymentLinks().filter((l) => l.closerId === userId).length;
      }
    }

    if (selectSpec.payments !== undefined) {
      if (selectSpec.payments === true) {
        result.payments = this.ctx.payments().filter((p) => p.closerId === userId).length;
      } else if (typeof selectSpec.payments === "object") {
        const paymentWhere = (selectSpec.payments as RecordAny).where as RecordAny | undefined;
        let payments = this.ctx.payments().filter((p) => p.closerId === userId);
        if (paymentWhere) {
          payments = payments.filter((p) =>
            matchesWhere(p as unknown as RecordAny, paymentWhere),
          );
        }
        result.payments = payments.length;
      }
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// PaymentLink Collection
// ---------------------------------------------------------------------------

class PaymentLinkCollection {
  private store: DemoPaymentLink[];
  private ctx: CollectionContext;

  constructor(initial: DemoPaymentLink[], ctx: CollectionContext) {
    this.store = clone(initial);
    this.ctx = ctx;
  }

  private relationResolvers(): Record<string, (rec: RecordAny) => RecordAny | null> {
    return {
      closer: (rec) => {
        const user = this.ctx.users().find((u) => u.id === rec.closerId);
        return user ? (user as unknown as RecordAny) : null;
      },
    };
  }

  findMany(args: {
    where?: RecordAny;
    include?: RecordAny;
    orderBy?: RecordAny | RecordAny[];
    skip?: number;
    take?: number;
  }): Promise<RecordAny[]> {
    const { where, include, orderBy, skip, take } = args;

    let results = this.store.filter((l) =>
      matchesWhere(l as unknown as RecordAny, where || {}, this.relationResolvers()),
    );

    results = applyOrderBy(
      results as unknown as RecordAny[],
      orderBy,
    ) as unknown as DemoPaymentLink[];

    if (skip) results = results.slice(skip);
    if (take !== undefined) results = results.slice(0, take);

    return thenable(
      results.map((link) => this.resolveIncludes(clone(link) as unknown as RecordAny, include)),
    );
  }

  count(args?: { where?: RecordAny }): Promise<number> {
    if (!args?.where) return thenable(this.store.length);
    const count = this.store.filter((l) =>
      matchesWhere(l as unknown as RecordAny, args.where || {}, this.relationResolvers()),
    ).length;
    return thenable(count);
  }

  create(args: { data: RecordAny; include?: RecordAny; select?: RecordAny }): Promise<RecordAny> {
    const now = new Date();
    const record: DemoPaymentLink = {
      id: generateId(),
      closerId: "",
      whopPlanId: `plan_demo_${generateId()}`,
      whopProductId: "",
      productName: "",
      purchaseUrl: "",
      planType: "one_time",
      totalAmount: 0,
      initialPrice: 0,
      renewalPrice: null,
      billingPeriodDays: null,
      splitPayments: null,
      customSplitDescription: null,
      currency: "usd",
      visibility: "quick_link",
      status: "active",
      title: null,
      description: null,
      internalNotes: null,
      clientName: null,
      downPaymentStatus: null,
      createdAt: now,
      updatedAt: now,
      ...(args.data as Partial<DemoPaymentLink>),
    };
    this.store.push(record);

    let result: RecordAny = clone(record) as unknown as RecordAny;
    if (args.include) {
      result = this.resolveIncludes(result, args.include);
    }
    if (args.select) {
      result = applySelect(result, args.select);
    }
    return thenable(result);
  }

  findUnique(args: {
    where: RecordAny;
    include?: RecordAny;
    select?: RecordAny;
  }): Promise<RecordAny | null> {
    const found = this.store.find((l) => l.id === args.where.id);
    if (!found) return thenable(null);

    let result: RecordAny = clone(found) as unknown as RecordAny;
    if (args.include) {
      result = this.resolveIncludes(result, args.include);
    }
    if (args.select) {
      result = applySelect(result, args.select);
    }
    return thenable(result);
  }

  findFirst(args: {
    where: RecordAny;
    include?: RecordAny;
  }): Promise<RecordAny | null> {
    const found = this.store.find((l) =>
      matchesWhere(l as unknown as RecordAny, args.where, this.relationResolvers()),
    );
    if (!found) return thenable(null);

    let result: RecordAny = clone(found) as unknown as RecordAny;
    if (args.include) {
      result = this.resolveIncludes(result, args.include);
    }
    return thenable(result);
  }

  update(args: {
    where: RecordAny;
    data: RecordAny;
    select?: RecordAny;
  }): Promise<RecordAny> {
    const idx = this.store.findIndex((l) => l.id === args.where.id);
    if (idx === -1) throw new Error("Record not found");

    const updated = {
      ...this.store[idx],
      ...args.data,
      updatedAt: new Date(),
    } as DemoPaymentLink;
    this.store[idx] = updated;

    let result: RecordAny = clone(updated) as unknown as RecordAny;
    if (args.select) {
      result = applySelect(result, args.select);
    }
    return thenable(result);
  }

  // -- private helpers -------------------------------------------------------

  private resolveIncludes(rec: RecordAny, include?: RecordAny): RecordAny {
    if (!include) return rec;

    // closer
    if (include.closer) {
      const user = this.ctx.users().find((u) => u.id === rec.closerId);
      if (include.closer === true) {
        rec.closer = user ? clone(user) : null;
      } else if (typeof include.closer === "object") {
        const closerOpts = include.closer as RecordAny;
        if (closerOpts.select && user) {
          rec.closer = applySelect(clone(user) as unknown as RecordAny, closerOpts.select as RecordAny);
        } else {
          rec.closer = user ? clone(user) : null;
        }
      }
    }

    // payments
    if (include.payments) {
      let payments = this.ctx.payments().filter((p) => p.paymentLinkId === rec.id);
      if (typeof include.payments === "object") {
        const paymentOpts = include.payments as RecordAny;
        if (paymentOpts.where) {
          payments = payments.filter((p) =>
            matchesWhere(p as unknown as RecordAny, paymentOpts.where as RecordAny),
          );
        }
        if (paymentOpts.orderBy) {
          payments = applyOrderBy(
            payments as unknown as RecordAny[],
            paymentOpts.orderBy as RecordAny,
          ) as unknown as DemoPayment[];
        }
      }
      rec.payments = clone(payments);
    }

    // _count
    if (include._count) {
      rec._count = this.resolveCount(rec.id as string, include._count as RecordAny);
    }

    return rec;
  }

  private resolveCount(linkId: string, countSpec: RecordAny): RecordAny {
    const result: RecordAny = {};
    const selectSpec = countSpec.select as RecordAny | undefined;
    if (!selectSpec) return result;

    if (selectSpec.payments !== undefined) {
      if (selectSpec.payments === true) {
        result.payments = this.ctx.payments().filter((p) => p.paymentLinkId === linkId).length;
      } else if (typeof selectSpec.payments === "object") {
        const paymentWhere = (selectSpec.payments as RecordAny).where as RecordAny | undefined;
        let payments = this.ctx.payments().filter((p) => p.paymentLinkId === linkId);
        if (paymentWhere) {
          payments = payments.filter((p) =>
            matchesWhere(p as unknown as RecordAny, paymentWhere),
          );
        }
        result.payments = payments.length;
      }
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Payment Collection
// ---------------------------------------------------------------------------

class PaymentCollection {
  private store: DemoPayment[];
  private ctx: CollectionContext;

  constructor(initial: DemoPayment[], ctx: CollectionContext) {
    this.store = clone(initial);
    this.ctx = ctx;
  }

  private relationResolvers(): Record<string, (rec: RecordAny) => RecordAny | null> {
    return {
      closer: (rec) => {
        const user = this.ctx.users().find((u) => u.id === rec.closerId);
        return user ? (user as unknown as RecordAny) : null;
      },
      paymentLink: (rec) => {
        if (!rec.paymentLinkId) return null;
        const link = this.ctx.paymentLinks().find((l) => l.id === rec.paymentLinkId);
        return link ? (link as unknown as RecordAny) : null;
      },
    };
  }

  findMany(args?: {
    where?: RecordAny;
    include?: RecordAny;
    select?: RecordAny;
    orderBy?: RecordAny | RecordAny[];
    skip?: number;
    take?: number;
  }): Promise<RecordAny[]> {
    const { where, include, select, orderBy, skip, take } = args || {};

    let results = this.store.filter((p) =>
      matchesWhere(p as unknown as RecordAny, where || {}, this.relationResolvers()),
    );

    results = applyOrderBy(
      results as unknown as RecordAny[],
      orderBy,
    ) as unknown as DemoPayment[];

    if (skip) results = results.slice(skip);
    if (take !== undefined) results = results.slice(0, take);

    return thenable(
      results.map((payment) => {
        let rec = clone(payment) as unknown as RecordAny;
        if (include) {
          rec = this.resolveIncludes(rec, include);
        }
        if (select) {
          rec = applySelect(rec, select);
        }
        return rec;
      }),
    );
  }

  count(args?: { where?: RecordAny }): Promise<number> {
    if (!args?.where) return thenable(this.store.length);
    const count = this.store.filter((p) =>
      matchesWhere(p as unknown as RecordAny, args.where || {}, this.relationResolvers()),
    ).length;
    return thenable(count);
  }

  findUnique(args: {
    where: RecordAny;
    include?: RecordAny;
    select?: RecordAny;
  }): Promise<RecordAny | null> {
    let found: DemoPayment | undefined;

    if (args.where.id) {
      found = this.store.find((p) => p.id === args.where.id);
    } else if (args.where.whopPaymentId) {
      found = this.store.find((p) => p.whopPaymentId === args.where.whopPaymentId);
    }

    if (!found) return thenable(null);

    let result: RecordAny = clone(found) as unknown as RecordAny;
    if (args.include) {
      result = this.resolveIncludes(result, args.include);
    }
    if (args.select) {
      result = applySelect(result, args.select);
    }
    return thenable(result);
  }

  upsert(args: {
    where: RecordAny;
    create: RecordAny;
    update: RecordAny;
  }): Promise<RecordAny> {
    let existing: DemoPayment | undefined;
    if (args.where.whopPaymentId) {
      existing = this.store.find((p) => p.whopPaymentId === args.where.whopPaymentId);
    } else if (args.where.id) {
      existing = this.store.find((p) => p.id === args.where.id);
    }

    if (existing) {
      const idx = this.store.indexOf(existing);
      const updated = { ...existing, ...args.update, updatedAt: new Date() } as DemoPayment;
      this.store[idx] = updated;
      return thenable(clone(updated) as unknown as RecordAny);
    }

    const now = new Date();
    const record: DemoPayment = {
      id: generateId(),
      whopPaymentId: "",
      closerId: "",
      paymentLinkId: null,
      whopPlanId: null,
      whopProductId: null,
      productName: null,
      customerEmail: null,
      customerName: null,
      customerId: null,
      membershipId: null,
      amount: 0,
      currency: "usd",
      status: "pending",
      paidAt: null,
      refundedAt: null,
      refundAmount: null,
      installmentNumber: null,
      isRecurring: false,
      commissionAmount: null,
      whopWebhookData: null,
      zapierStatus: null,
      zapierError: null,
      zapierSentAt: null,
      createdAt: now,
      updatedAt: now,
      ...(args.create as Partial<DemoPayment>),
    };
    this.store.push(record);
    return thenable(clone(record) as unknown as RecordAny);
  }

  update(args: {
    where: RecordAny;
    data: RecordAny;
    select?: RecordAny;
  }): Promise<RecordAny> {
    const idx = this.store.findIndex((p) => p.id === args.where.id);
    if (idx === -1) throw new Error("Record not found");

    const updated = { ...this.store[idx], ...args.data, updatedAt: new Date() } as DemoPayment;
    this.store[idx] = updated;

    let result: RecordAny = clone(updated) as unknown as RecordAny;
    if (args.select) {
      result = applySelect(result, args.select);
    }
    return thenable(result);
  }

  updateMany(args: {
    where: RecordAny;
    data: RecordAny;
  }): Promise<{ count: number }> {
    let count = 0;
    for (let i = 0; i < this.store.length; i++) {
      if (matchesWhere(this.store[i] as unknown as RecordAny, args.where, this.relationResolvers())) {
        this.store[i] = {
          ...this.store[i],
          ...args.data,
          updatedAt: new Date(),
        } as DemoPayment;
        count++;
      }
    }
    return thenable({ count });
  }

  aggregate(args: {
    where?: RecordAny;
    _sum?: RecordAny;
    _count?: boolean | RecordAny;
  }): Promise<RecordAny> {
    const matching = this.store.filter((p) =>
      matchesWhere(p as unknown as RecordAny, args.where || {}, this.relationResolvers()),
    );

    const result: RecordAny = {};

    if (args._sum) {
      const sumResult: RecordAny = {};
      for (const field of Object.keys(args._sum)) {
        if (matching.length === 0) {
          sumResult[field] = null;
        } else {
          let sum: number | null = null;
          for (const rec of matching) {
            const val = (rec as unknown as RecordAny)[field];
            if (val != null) {
              sum = (sum ?? 0) + Number(val);
            }
          }
          sumResult[field] = sum;
        }
      }
      result._sum = sumResult;
    }

    if (args._count !== undefined) {
      if (args._count === true) {
        result._count = matching.length;
      }
    }

    return thenable(result);
  }

  // -- private helpers -------------------------------------------------------

  private resolveIncludes(rec: RecordAny, include: RecordAny): RecordAny {
    // closer
    if (include.closer) {
      const user = this.ctx.users().find((u) => u.id === rec.closerId);
      if (include.closer === true) {
        rec.closer = user ? clone(user) : null;
      } else if (typeof include.closer === "object") {
        const closerOpts = include.closer as RecordAny;
        if (closerOpts.select && user) {
          rec.closer = applySelect(clone(user) as unknown as RecordAny, closerOpts.select as RecordAny);
        } else {
          rec.closer = user ? clone(user) : null;
        }
      }
    }

    // paymentLink
    if (include.paymentLink) {
      const link = rec.paymentLinkId
        ? this.ctx.paymentLinks().find((l) => l.id === rec.paymentLinkId)
        : null;

      if (include.paymentLink === true) {
        rec.paymentLink = link ? clone(link) : null;
      } else if (typeof include.paymentLink === "object") {
        const linkOpts = include.paymentLink as RecordAny;

        if (linkOpts.select && link) {
          rec.paymentLink = applySelect(clone(link) as unknown as RecordAny, linkOpts.select as RecordAny);
        } else if (linkOpts.include && link) {
          // Nested include, e.g. { paymentLink: { include: { closer: true } } }
          const linkRec = clone(link) as unknown as RecordAny;
          const nestedInclude = linkOpts.include as RecordAny;
          if (nestedInclude.closer) {
            const closerUser = this.ctx.users().find((u) => u.id === link.closerId);
            if (nestedInclude.closer === true) {
              linkRec.closer = closerUser ? clone(closerUser) : null;
            } else if (typeof nestedInclude.closer === "object") {
              const closerSelectOpts = nestedInclude.closer as RecordAny;
              if (closerSelectOpts.select && closerUser) {
                linkRec.closer = applySelect(
                  clone(closerUser) as unknown as RecordAny,
                  closerSelectOpts.select as RecordAny,
                );
              } else {
                linkRec.closer = closerUser ? clone(closerUser) : null;
              }
            }
          }
          rec.paymentLink = linkRec;
        } else {
          rec.paymentLink = link ? clone(link) : null;
        }
      }
    }

    return rec;
  }
}

// ---------------------------------------------------------------------------
// WebhookEvent Collection
// ---------------------------------------------------------------------------

class WebhookEventCollection {
  private store: DemoWebhookEvent[];

  constructor(initial: DemoWebhookEvent[]) {
    this.store = clone(initial);
  }

  findUnique(args: {
    where: RecordAny;
  }): Promise<RecordAny | null> {
    let found: DemoWebhookEvent | undefined;

    if (args.where.whopMessageId) {
      found = this.store.find((e) => e.whopMessageId === args.where.whopMessageId);
    } else if (args.where.id) {
      found = this.store.find((e) => e.id === args.where.id);
    }

    return thenable(found ? (clone(found) as unknown as RecordAny) : null);
  }

  findMany(args?: {
    where?: RecordAny;
    orderBy?: RecordAny | RecordAny[];
    take?: number;
    select?: RecordAny;
  }): Promise<RecordAny[]> {
    let results = this.store.filter((e) =>
      matchesWhere(e as unknown as RecordAny, args?.where || {}),
    );

    results = applyOrderBy(
      results as unknown as RecordAny[],
      args?.orderBy,
    ) as unknown as DemoWebhookEvent[];

    if (args?.take !== undefined) results = results.slice(0, args.take);

    return thenable(
      results.map((e) => {
        const rec = clone(e) as unknown as RecordAny;
        if (args?.select) return applySelect(rec, args.select);
        return rec;
      }),
    );
  }

  upsert(args: {
    where: RecordAny;
    create: RecordAny;
    update: RecordAny;
  }): Promise<RecordAny> {
    let existing: DemoWebhookEvent | undefined;
    if (args.where.whopMessageId) {
      existing = this.store.find((e) => e.whopMessageId === args.where.whopMessageId);
    }

    if (existing) {
      const idx = this.store.indexOf(existing);
      const updated = { ...existing, ...args.update } as DemoWebhookEvent;
      this.store[idx] = updated;
      return thenable(clone(updated) as unknown as RecordAny);
    }

    const record: DemoWebhookEvent = {
      id: generateId(),
      whopMessageId: "",
      eventType: "",
      payload: {},
      processedAt: null,
      error: null,
      createdAt: new Date(),
      ...(args.create as Partial<DemoWebhookEvent>),
    };
    this.store.push(record);
    return thenable(clone(record) as unknown as RecordAny);
  }

  update(args: {
    where: RecordAny;
    data: RecordAny;
  }): Promise<RecordAny> {
    let idx = -1;
    if (args.where.whopMessageId) {
      idx = this.store.findIndex((e) => e.whopMessageId === args.where.whopMessageId);
    } else if (args.where.id) {
      idx = this.store.findIndex((e) => e.id === args.where.id);
    }
    if (idx === -1) throw new Error("Record not found");

    const updated = { ...this.store[idx], ...args.data } as DemoWebhookEvent;
    this.store[idx] = updated;
    return thenable(clone(updated) as unknown as RecordAny);
  }
}

// ---------------------------------------------------------------------------
// AppSettings Collection
// ---------------------------------------------------------------------------

class AppSettingsCollection {
  private store: DemoAppSettings[];

  constructor(initial: DemoAppSettings[]) {
    this.store = clone(initial);
  }

  findUnique(args: {
    where: RecordAny;
    select?: RecordAny;
  }): Promise<RecordAny | null> {
    const found = this.store.find((s) => s.id === args.where.id);
    if (!found) return thenable(null);

    let result: RecordAny = clone(found) as unknown as RecordAny;
    if (args.select) {
      result = applySelect(result, args.select);
    }
    return thenable(result);
  }

  upsert(args: {
    where: RecordAny;
    create: RecordAny;
    update: RecordAny;
  }): Promise<RecordAny> {
    const existing = this.store.find((s) => s.id === args.where.id);

    if (existing) {
      const idx = this.store.indexOf(existing);
      const updated = {
        ...existing,
        ...args.update,
        updatedAt: new Date(),
      } as DemoAppSettings;
      this.store[idx] = updated;
      return thenable(clone(updated) as unknown as RecordAny);
    }

    const record: DemoAppSettings = {
      id: "default",
      whopWebhookId: null,
      webhookSecret: null,
      webhookUrl: null,
      zapierWebhookUrl: null,
      enabledProductIds: [],
      registeredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(args.create as Partial<DemoAppSettings>),
    };
    this.store.push(record);
    return thenable(clone(record) as unknown as RecordAny);
  }
}

// ---------------------------------------------------------------------------
// DemoPrismaClient — the main export
// ---------------------------------------------------------------------------

export class DemoPrismaClient {
  user: UserCollection;
  paymentLink: PaymentLinkCollection;
  payment: PaymentCollection;
  webhookEvent: WebhookEventCollection;
  appSettings: AppSettingsCollection;

  constructor() {
    // We need a context object that each collection can use to resolve
    // cross-collection relations.  The getters return the *live* store
    // arrays so that newly-created records are visible immediately.
    const ctx: CollectionContext = {
      users: () => (this.user as unknown as { store: DemoUser[] }).store,
      paymentLinks: () => (this.paymentLink as unknown as { store: DemoPaymentLink[] }).store,
      payments: () => (this.payment as unknown as { store: DemoPayment[] }).store,
      webhookEvents: () => (this.webhookEvent as unknown as { store: DemoWebhookEvent[] }).store,
      appSettings: () => (this.appSettings as unknown as { store: DemoAppSettings[] }).store,
    };

    this.user = new UserCollection(demoUsers, ctx);
    this.paymentLink = new PaymentLinkCollection(demoPaymentLinks, ctx);
    this.payment = new PaymentCollection(demoPayments, ctx);
    this.webhookEvent = new WebhookEventCollection(demoWebhookEvents);
    this.appSettings = new AppSettingsCollection([demoAppSettings]);
  }

  /**
   * No-op $connect / $disconnect for compatibility with code that may call them.
   */
  $connect(): Promise<void> {
    return Promise.resolve();
  }

  $disconnect(): Promise<void> {
    return Promise.resolve();
  }
}
