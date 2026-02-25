# CLOSERPAY — Project Reference

## 1. Project Overview

Internal sales operations tool for CareerGrowth. Generates custom Whop checkout links (one-time, recurring, split-pay, down payment), attributes every payment to a closer, and tracks revenue/commissions in real-time via webhooks. Built for high-ticket sales teams using Whop as their payment processor.

- **Language:** TypeScript
- **Framework:** Next.js 16.1.6 (App Router, React 19.2.3)
- **Runtime:** Node.js
- **Package manager:** npm

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js App Router, React 19, Tailwind CSS v4 (custom cyberpunk theme), Recharts 3.7 for charts, Radix UI primitives (dialog, dropdown-menu, popover, select, switch, tabs, tooltip), Lucide React icons, react-hot-toast |
| **Backend** | Next.js API routes (Route Handlers), server components |
| **Database** | PostgreSQL (Neon) via Prisma 7.4.0 with `@prisma/adapter-pg` (pg driver adapter) |
| **Auth** | Custom HMAC-SHA256 token system (Web Crypto API) + bcryptjs password hashing. HTTP-only cookie (`auth_token`), 7-day expiry |
| **Payments** | Whop SDK 0.0.27 (`@whop/sdk`) — plan creation, product listing, webhook registration |
| **Hosting** | Vercel (inferred from config + README) |
| **Outbound integrations** | Zapier webhook (fire-and-forget POST on payment.succeeded) |

## 3. Project Structure

```
app/
├── layout.tsx                         # Root layout: fonts (Inter, Space Grotesk, JetBrains Mono), Toaster, dark mode
├── globals.css                        # Tailwind v4 @theme tokens + cyber animations/effects
├── error.tsx                          # Global error boundary
├── login/page.tsx                     # Login + first-run admin setup
├── (dashboard)/                       # Route group — all authenticated pages
│   ├── layout.tsx                     # Server component: reads cookie, verifies token, wraps children in UserProvider
│   ├── error.tsx                      # Dashboard error boundary
│   ├── page.tsx                       # Dashboard (stats cards, revenue chart, leaderboard, recent payments)
│   ├── generate/page.tsx              # Payment link generator form
│   ├── links/page.tsx                 # Payment links table with filters
│   ├── payments/page.tsx              # Payments table with filters + CSV export
│   ├── down-payments/page.tsx         # Down payment tracking page with aging colors
│   ├── closers/page.tsx               # Closer management cards (admin only)
│   └── settings/page.tsx              # User management, Whop integration, product selection, Zapier webhook, webhook config/log
├── api/
│   ├── auth/{login,logout,me,setup}/  # Authentication endpoints
│   ├── closers/                       # GET list, GET [id] with stats (admin only via middleware)
│   ├── users/                         # GET list, POST create, PUT [id] update, DELETE [id] deactivate (admin only)
│   ├── products/                      # GET — proxies Whop products API, filters by enabled products
│   ├── payment-links/                 # GET list (role-filtered), POST create (creates Whop plan + stores link)
│   ├── payments/                      # GET list (role-filtered), GET [id], GET export (CSV)
│   ├── down-payments/                 # GET list (role-filtered), PATCH update status (admin only)
│   ├── webhooks/                      # POST whop (webhook handler), POST register, GET status (admin only)
│   ├── analytics/                     # GET overview, revenue-over-time, by-closer, by-product (all role-filtered)
│   └── settings/                      # GET/PUT products (enabled IDs), GET/PUT zapier (webhook URL)
components/
├── ui/                                # Badge, Button, Card, Input, Modal, Select, Skeleton
├── layout/                            # Sidebar (collapsible, role-aware nav), TopBar (page title)
├── dashboard/                         # StatsCards, RevenueChart, CloserBarChart, ProductPieChart, RecentPayments, Leaderboard, DateFilter
└── generate/                          # LinkResult (copy/share result), SplitTimeline (visual payment schedule)
lib/
├── auth.ts                            # TokenPayload, AuthUser types; signToken, verifyToken, createTokenPayload, decodeTokenPayload, getUserFromRequest
├── prisma.ts                          # PrismaClient singleton with pg adapter
├── whop.ts                            # Whop SDK client instance + COMPANY_ID export
├── types.ts                           # Shared TS types: CloserFormData, WhopProduct, PaymentLinkFormData, DashboardStats, etc.
├── utils.ts                           # cn(), formatCurrency, formatDate, formatDateTime, getInitials, truncate, getPlanTypeLabel, getStatusColor, getBillingIntervalLabel, displayProductName
└── user-context.tsx                   # React context: UserProvider, useUser(), useIsAdmin()
prisma/
└── schema.prisma                      # 5 models: User, PaymentLink, Payment, WebhookEvent, AppSettings
middleware.ts                          # Auth verification, role-based route blocking, user headers injection
```

**Organization pattern:** Layer-based. API routes under `app/api/` grouped by resource. UI components in `components/` split by concern (ui primitives, layout, feature-specific). Shared logic in `lib/`.

## 4. Architecture & Patterns

**Architecture:** Next.js monolith — server-rendered dashboard layout, client-side pages with API fetches, serverless API routes.

**Request flow:**
1. All requests hit `middleware.ts` first
2. Middleware verifies `auth_token` cookie (HMAC-SHA256), decodes payload, injects `x-user-id`, `x-user-role`, `x-user-email`, `x-user-name` headers
3. Admin-only routes blocked for closer role at middleware level
4. API route handlers call `getUserFromRequest(request)` to read user info from headers
5. Database queries via Prisma singleton (`lib/prisma.ts`)
6. Responses wrapped in `{ success: boolean, data?: T, error?: string }` pattern

**State management:** No global state library. React Context for current user (`UserProvider`). Local `useState` + `fetch` calls per page/component. Dashboard components accept `from`/`to`/`closerId` props and fetch their own data.

**Error handling:** try/catch in API routes → `console.error` + JSON error response. Client-side: `react-hot-toast` for user-facing errors. Error boundaries at root and dashboard level.

**Key patterns:**
- Closers ARE users — a user with `role="closer"` is a closer. No separate model.
- Soft deletes: users → `isActive=false`, payment links → `status="expired"`
- Webhook idempotency via `WebhookEvent.whopMessageId` (unique constraint)
- Role-based data filtering: all list/analytics endpoints auto-filter by `closerId = user.userId` when role is "closer"
- Commission calculation happens in webhook handler at payment creation time

## 5. Database Schema

### User (`users`)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid | |
| email | String | Unique | Normalized to lowercase |
| passwordHash | String | | bcrypt hash (cost 12) |
| name | String | | |
| role | String | Default "closer" | "admin" or "closer" |
| phone | String? | | |
| avatarUrl | String? | | |
| commissionType | String | Default "percentage" | "percentage" or "flat" |
| commissionValue | Float | Default 0 | Percentage rate or flat dollar amount |
| isActive | Boolean | Default true | Soft delete flag |
| createdAt | DateTime | Default now() | |
| updatedAt | DateTime | @updatedAt | |

Relations: `paymentLinks[]`, `payments[]`

### PaymentLink (`payment_links`)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid | |
| closerId | String | FK → User | |
| whopPlanId | String | | Whop plan ID created via API |
| whopProductId | String | | |
| productName | String | | |
| purchaseUrl | String | | Customer-facing checkout URL |
| planType | String | | "one_time", "down_payment", "renewal", "split_pay", "custom_split" |
| totalAmount | Float | | Full package price (or per-period for renewal) |
| initialPrice | Float | | First payment amount |
| renewalPrice | Float? | | Recurring payment amount |
| billingPeriodDays | Int? | | Days between payments |
| splitPayments | Int? | | Total number of split payments (2-24) |
| customSplitDescription | String? | | Human-readable breakdown |
| currency | String | Default "usd" | |
| visibility | String | Default "quick_link" | Whop plan visibility |
| status | String | Default "active" | "active", "expired", "completed" |
| title | String? | | Optional plan title |
| description | String? | | |
| internalNotes | String? | | JSON string with closer_id, link_type, etc. |
| downPaymentStatus | String? | | "fully_paid", "cancelled", or null (pending) |
| createdAt | DateTime | Default now() | |
| updatedAt | DateTime | @updatedAt | |

Relations: `closer` (User), `payments[]`

### Payment (`payments`)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid | |
| whopPaymentId | String | Unique | Whop payment ID — idempotency |
| closerId | String | FK → User | |
| paymentLinkId | String? | FK → PaymentLink | |
| whopPlanId | String? | | |
| whopProductId | String? | | |
| productName | String? | | |
| customerEmail | String? | | |
| customerName | String? | | |
| customerId | String? | | Whop user ID |
| membershipId | String? | | Whop membership ID |
| amount | Float | | |
| currency | String | Default "usd" | |
| status | String | | "succeeded", "failed", "pending", "refunded" |
| paidAt | DateTime? | | |
| refundedAt | DateTime? | | |
| refundAmount | Float? | | |
| installmentNumber | Int? | | Sequential within payment link |
| isRecurring | Boolean | Default false | |
| commissionAmount | Float? | | Calculated at creation |
| whopWebhookData | Json? | | Raw webhook payload |
| createdAt | DateTime | Default now() | |
| updatedAt | DateTime | @updatedAt | |

Relations: `closer` (User), `paymentLink?` (PaymentLink)

### WebhookEvent (`webhook_events`)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid | |
| whopMessageId | String | Unique | Payment/resource ID for idempotency |
| eventType | String | | e.g. "payment.succeeded" |
| payload | Json | | Full webhook payload |
| processedAt | DateTime? | | Set after successful processing |
| error | String? | | Error message if processing failed |
| createdAt | DateTime | Default now() | |

### AppSettings (`app_settings`)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, Default "default" | Singleton row |
| whopWebhookId | String? | | Registered webhook ID |
| webhookSecret | String? | | Webhook verification secret |
| webhookUrl | String? | | Registered webhook URL |
| zapierWebhookUrl | String? | | Outbound Zapier webhook URL |
| enabledProductIds | Json? | Default [] | Array of Whop product IDs |
| registeredAt | DateTime? | | When webhook was registered |
| createdAt | DateTime | Default now() | |
| updatedAt | DateTime | @updatedAt | |

**Migration system:** Prisma with `prisma db push` (no migration files — schema push). Config in `prisma.config.ts` reads `DATABASE_URL` from env.

## 6. API Routes / Endpoints

All routes return `{ success: boolean, data?: T, error?: string }` unless noted. Auth required on all routes except where marked.

### Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | No | Email/password login → sets `auth_token` cookie |
| POST | `/api/auth/logout` | No | Clears `auth_token` cookie |
| GET | `/api/auth/me` | Yes | Returns current user from headers |
| GET | `/api/auth/setup` | No | Returns `{ needsSetup: boolean }` |
| POST | `/api/auth/setup` | No | Creates first admin user (only when 0 users exist) |

### Users (admin only — enforced by middleware)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user (with commission settings for closer role) |
| PUT | `/api/users/[id]` | Update user (name, email, password, role, isActive, commission) |
| DELETE | `/api/users/[id]` | Soft-deactivate user (`isActive=false`) |

### Closers (admin only — enforced by middleware)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/closers` | List active users with role "closer" (for dropdowns) |
| GET | `/api/closers/[id]` | Get closer details + revenue/commission aggregates |

### Products

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/products` | Yes | Fetch Whop products. `?all=true` returns all; otherwise filters by enabled products in AppSettings |

### Payment Links

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/payment-links` | List links | Params: `closerId`, `status`, `planType`, `search`, `page`, `limit`. Closer role auto-filtered. |
| POST | `/api/payment-links` | Create link | Creates Whop plan, stores in DB. Closer role: `closerId` forced to own ID. |
| GET | `/api/payment-links/[id]` | Get link details | Includes closer info + payments |
| DELETE | `/api/payment-links/[id]` | Archive link | Sets `status="expired"` |

### Payments

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/payments` | List payments | Params: `closerId`, `status`, `search`, `from`, `to`, `page`, `limit`. Closer role auto-filtered. |
| GET | `/api/payments/[id]` | Get payment details | |
| GET | `/api/payments/export` | CSV export | Params: `closerId`, `status`, `from`, `to`. Max 10k records. Sanitizes CSV cells against formula injection. |

### Down Payments

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/down-payments` | List down payment records | Filters payments linked to `planType="down_payment"` links. Params: `closerId`, `status`, `dpStatus`, `search`, `page`, `limit`. |
| PATCH | `/api/down-payments` | Update down payment status | Admin only. Body: `{ paymentLinkId, downPaymentStatus }` where status is "fully_paid", "cancelled", or null. |

### Analytics

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/analytics/overview` | Dashboard stats | Returns totalRevenue, totalCommission, totalSales, averageDealSize, revenueChange, salesChange. Compares to previous period. |
| GET | `/api/analytics/revenue-over-time` | Daily revenue time series | Params: `from`, `to`, `days` (default 30, max 365), `closerId`. |
| GET | `/api/analytics/by-closer` | Revenue per closer | `?leaderboard=true` shows all closers regardless of caller role. |
| GET | `/api/analytics/by-product` | Revenue per product | |

### Webhooks

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/webhooks/whop` | Webhook secret header | Whop webhook handler. No cookie auth. Verifies `webhook-secret` header. |
| POST | `/api/webhooks/register` | Admin | Registers webhook with Whop API |
| GET | `/api/webhooks/status` | Admin | Returns webhook registration status + recent 50 events |

### Settings

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/settings/products` | Admin | Get enabled product IDs |
| PUT | `/api/settings/products` | Admin | Update enabled product IDs |
| GET | `/api/settings/zapier` | Admin | Get Zapier webhook URL |
| PUT | `/api/settings/zapier` | Admin | Update Zapier webhook URL |

## 7. Key Files & Entry Points

| File | Purpose |
|---|---|
| `middleware.ts` | Auth verification, role-based route blocking, user header injection |
| `app/layout.tsx` | Root layout — fonts, toast provider, dark mode |
| `app/(dashboard)/layout.tsx` | Dashboard layout — server-side token verification, UserProvider |
| `app/api/webhooks/whop/route.ts` | Core webhook handler — processes Whop payment events, calculates commissions, fires Zapier webhook |
| `app/api/payment-links/route.ts` | Payment link creation — builds Whop plan params, creates plan via API |
| `lib/auth.ts` | All auth utilities — token signing/verification, helpers |
| `lib/prisma.ts` | Prisma singleton with PrismaPg adapter |
| `lib/whop.ts` | Whop SDK client initialization |
| `lib/user-context.tsx` | Client-side user context (UserProvider, useUser, useIsAdmin) |
| `prisma/schema.prisma` | Database schema definition |
| `prisma.config.ts` | Prisma config (schema path, datasource URL) |

### Environment Variables

| Variable | Required | Purpose | Example Format |
|---|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `WHOP_API_KEY` | Yes | Whop Company API key | `apik_xxxxx` |
| `WHOP_COMPANY_ID` | Yes | Whop Company ID | `biz_xxxxx` |
| `APP_PASSWORD` | Yes | Secret for HMAC-SHA256 token signing | Any strong string |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the deployment | `https://your-app.vercel.app` |
| `WHOP_WEBHOOK_SECRET` | No | Fallback webhook secret (used if not stored in DB AppSettings) | String from Whop |

## 8. Authentication & Authorization

### Auth Flow
1. **First run:** Login page checks `GET /api/auth/setup` — if 0 users, shows "Create admin account" form
2. **Login:** `POST /api/auth/login` → finds user by email → `bcrypt.compare` → creates base64-encoded JSON payload (userId, email, name, role, iat) → HMAC-SHA256 signs it → sets `auth_token` HTTP-only cookie (7-day expiry)
3. **Every request:** `middleware.ts` reads cookie → decodes payload → verifies HMAC signature → sets `x-user-*` headers on the request
4. **Invalid/stale cookies:** Middleware clears the cookie and redirects to `/login`

### Token Structure
```
base64(JSON{userId, email, name, role, iat}).hmac_hex_signature
```

### Role System

| Role | Dashboard | Generate | Links | Payments | Down Payments | Closers | Settings |
|---|---|---|---|---|---|---|---|
| **admin** | All data | Select any closer | All links | All payments | All + status mgmt | Full CRUD | Full access |
| **closer** | Own data only | Auto-assigned as closer | Own links only | Own payments only | Own data (read-only status) | Blocked | Blocked |

### Admin-Only Routes (blocked at middleware for closer role)
- Pages: `/closers`, `/settings`
- APIs: `/api/closers`, `/api/users`, `/api/webhooks/register`, `/api/webhooks/status`, `/api/settings/zapier`

### How Auth State Is Accessed
- **Middleware (Edge):** Reads cookie, verifies with Web Crypto API, sets headers
- **API routes:** `getUserFromRequest(request)` reads `x-user-*` headers → returns `AuthUser`
- **Server components:** Dashboard layout reads cookie directly, verifies, passes user to `UserProvider`
- **Client components:** `useUser()` hook from React context, `useIsAdmin()` shortcut

## 9. Third-Party Integrations

### Whop SDK (`@whop/sdk`)
- **Files:** `lib/whop.ts`, `app/api/payment-links/route.ts`, `app/api/products/route.ts`, `app/api/webhooks/register/route.ts`
- **Usage:** `whopClient.plans.create()` to create payment plans, `whopClient.products.list()` to fetch products, `whopClient.webhooks.create()` to register webhooks
- **Key detail:** Plan `internal_notes` field stores JSON with closer_id, closer_email, link_type for attribution

### Whop Webhooks
- **Handler:** `app/api/webhooks/whop/route.ts`
- **Events handled:** `payment.succeeded`, `payment.failed`, `payment.pending`, `refund.created`, `refund.updated`
- **Verification:** `webhook-secret` header compared against DB-stored or env fallback secret (timing-safe)
- **Idempotency:** Payment ID stored as `WebhookEvent.whopMessageId` with unique constraint
- **Payload:** Whop v2 format — `{ action, data: { id, plan, user, membership, total, paid_at, ... } }`
- **Amount parsing:** Uses `data.total` (string) as source of truth, falls back to `data.final_amount`
- **Timestamps:** Whop sends Unix seconds; handler converts to JS milliseconds via `× 1000`

### Zapier (outbound webhook)
- **Configured in:** Settings page → `AppSettings.zapierWebhookUrl`
- **Triggered by:** `handlePaymentSucceeded` in webhook handler (fire-and-forget)
- **Payload sent:** `{ client_name, client_email, package, amount_collected, total_to_be_collected, payment_type, closer_first_name, closer_last_name }`

## 10. Type System & Shared Types

All in `lib/types.ts`:
- `CloserFormData` — name, email, phone?, commissionType, commissionValue
- `WhopProduct` — id, title, description?, created_at?
- `PaymentType` — `"one_time" | "down_payment" | "renewal" | "split_pay"`
- `SplitMode` — `"equal" | "custom"`
- `PaymentLinkFormData` — all fields for link creation form
- `DashboardStats` — totalRevenue, totalCommission, totalSales, averageDealSize, revenueChange, salesChange
- `RevenueDataPoint` — date, revenue
- `CloserRevenue` — closerId, closerName, revenue, sales, commission
- `ProductRevenue` — productName, productId, revenue, sales
- `ApiResponse<T>` — `{ success: boolean, data?: T, error?: string }`
- `UserRole` — `"admin" | "closer"`
- `UserFormData` — name, email, password, role

Auth types in `lib/auth.ts`:
- `TokenPayload` — userId, email, name, role, iat
- `AuthUser` — userId, email, name, role

## 11. Scripts & Commands

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start development server |
| `build` | `prisma generate && next build` | Generate Prisma client + build Next.js |
| `postinstall` | `prisma generate` | Auto-generate Prisma client after install |
| `db:push` | `prisma db push` | Push schema to database (no migrations) |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Run ESLint |

### Dev Setup
1. `npm install`
2. Copy `.env.local.example` to `.env.local`, fill in values
3. `npm run db:push` (push schema to Neon PostgreSQL)
4. `npm run dev`
5. First visit: create admin account via setup form on `/login`
6. Go to Settings → Register Webhook (requires public URL)

## 12. Testing

N/A — No test framework, test files, or test configuration found in the codebase.

## 13. CI/CD & Deployment

- **Platform:** Vercel (inferred)
- **Build command:** `prisma generate && next build` (handled by `npm run build`)
- **Post-deploy:** Update `NEXT_PUBLIC_APP_URL` env var, then register webhook via Settings page
- **No CI/CD pipeline files** (no `.github/workflows`, no `vercel.json`, etc.)

## 14. Coding Conventions

### Naming
- **Files:** kebab-case for routes (`payment-links`), PascalCase for components (`StatsCards.tsx`), camelCase for lib files (`user-context.tsx`)
- **Components:** PascalCase, exported as named exports (not default) for reusable components; `export default` for page components
- **Variables/functions:** camelCase
- **Database columns:** camelCase in Prisma, mapped to snake_case in DB via `@map()`
- **CSS classes:** Tailwind utility classes with custom `cyber-*` theme tokens

### Import Patterns
- Path alias `@/*` maps to project root
- Typical order: Next.js imports → third-party → `@/components` → `@/lib` → types

### API Response Pattern
```ts
// Success
return NextResponse.json({ success: true, data: result });
// Error
return NextResponse.json({ success: false, error: "message" }, { status: 4xx });
// Paginated
return NextResponse.json({ success: true, data, pagination: { page, limit, total, pages } });
```

### Pagination
- Default: 20 items per page, max 100
- Query params: `page` (1-based), `limit`

### Date Filtering
- Query params: `from`, `to` (ISO 8601 strings)
- Dashboard default: 30-day range

### Linting
- ESLint 9 with `eslint-config-next` (core-web-vitals + TypeScript)
- Several `eslint-disable` comments for `@typescript-eslint/no-explicit-any` on Prisma where clauses

### Styling
- Tailwind CSS v4 with inline `@theme` block in `globals.css`
- Custom color tokens: `cyber-black`, `cyber-dark`, `cyber-card`, `cyber-border`, `cyber-cyan`, `cyber-purple`, `cyber-green`, `cyber-red`, `cyber-yellow`, `cyber-text`, `cyber-muted`
- Custom animations: `animate-pulse-glow`, `animate-fade-in`, `animate-shimmer`, `animate-count-up`
- Fonts: Space Grotesk (headings as `--font-orbitron`), Inter (body), JetBrains Mono (monospace)
- Number inputs: scroll disabled via `onWheel` handler in Input component, spinners hidden via CSS

## 15. Gotchas & Non-Obvious Behavior

1. **Font variable naming mismatch:** Space Grotesk font is loaded but assigned to CSS variable `--font-orbitron` (`app/layout.tsx:12`). The heading font is Space Grotesk, not Orbitron, despite the variable name.

2. **Closers are users:** There is no separate Closer model. A user with `role="closer"` IS a closer. The `/api/closers` endpoint just queries users with `role: "closer"`. Commission settings live on the User model.

3. **Down payment is a Whop one-time plan:** Down payment links create a `plan_type: "one_time"` on Whop (only charging the down payment amount). The full package amount is tracked only in the local DB (`PaymentLink.totalAmount`). The remaining balance is not collected automatically.

4. **Custom split uses trial period trick:** For custom splits (different first payment), the API sets `trial_period_days = billingPeriodDays` so Whop charges only `initial_price` on day 1 instead of `initial_price + first renewal` (`app/api/payment-links/route.ts:218-219`).

5. **Webhook secret fallback:** Webhook verification checks DB-stored secret first, falls back to `WHOP_WEBHOOK_SECRET` env var. If neither exists, verification is skipped with a warning (`app/api/webhooks/whop/route.ts:32-33`).

6. **APP_PASSWORD is the token signing secret:** Despite the name, `APP_PASSWORD` is used as the HMAC secret for signing auth tokens, not as a user-facing password. If not set, falls back to `"fallback-never-use-this"` (`middleware.ts:4`).

7. **Whop timestamps are in seconds:** The webhook handler converts them to JS milliseconds (`× 1000`). The `whopDate()` helper handles this.

8. **Auto-copy on link generation:** When a payment link is generated, `LinkResult` auto-copies the URL to clipboard on mount (`useEffect` with `handleCopy`).

9. **CSV formula injection protection:** The export endpoint prefixes dangerous characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single quote to prevent spreadsheet formula injection.

10. **Closers page vs Settings:** The `/closers` page exists for closer card management but closers are primarily managed through Settings → User Accounts. Both pages interact with similar APIs.

11. **Leaderboard bypasses role filter:** The `/api/analytics/by-closer?leaderboard=true` endpoint shows ALL closers regardless of the caller's role, allowing closer-role users to see the full leaderboard while their other analytics are filtered to their own data.

12. **Down payment aging colors:** The down-payments page colors rows based on age — red for 30+ days old pending, orange for 14+ days, normal otherwise. Fully paid/cancelled rows are always normal color.

13. **No database migrations:** Project uses `prisma db push` instead of migration files. Schema changes are pushed directly. The `prisma.config.ts` references a migrations path but no migration files exist.
