import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { whopClient, COMPANY_ID } from "@/lib/whop";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const closerId = searchParams.get("closerId");
    const status = searchParams.get("status");
    const planType = searchParams.get("planType");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    const where: Record<string, unknown> = {};
    if (closerId) where.closerId = closerId;
    if (status) where.status = status;
    if (planType) where.planType = planType;
    if (search) {
      where.OR = [
        { productName: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { closer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [links, total] = await Promise.all([
      prisma.paymentLink.findMany({
        where,
        include: {
          closer: { select: { id: true, name: true, email: true } },
          _count: {
            select: {
              payments: { where: { status: "succeeded" } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.paymentLink.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: links,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Failed to fetch payment links:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payment links" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      closerId,
      productId,
      productName,
      paymentType,
      title,
      description,
      amount,
      renewalPrice,
      billingPeriodDays,
      splitMode,
      totalAmount,
      numberOfPayments,
      initialPrice,
      installmentPrice,
    } = body;

    if (!closerId || !productId || !paymentType) {
      return NextResponse.json(
        { success: false, error: "Closer, product, and payment type are required" },
        { status: 400 }
      );
    }

    // Validate amounts are positive numbers
    const validatePositive = (val: unknown, name: string): string | null => {
      const num = Number(val);
      if (isNaN(num) || num <= 0) return `${name} must be a positive number`;
      return null;
    };

    if (paymentType === "one_time") {
      const err = validatePositive(amount, "Amount");
      if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });
    } else if (paymentType === "renewal") {
      const err = validatePositive(renewalPrice, "Renewal price");
      if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });
      if (!billingPeriodDays || billingPeriodDays < 1) {
        return NextResponse.json({ success: false, error: "Billing period must be at least 1 day" }, { status: 400 });
      }
    } else if (paymentType === "split_pay") {
      if (!numberOfPayments || numberOfPayments < 2 || numberOfPayments > 24) {
        return NextResponse.json({ success: false, error: "Number of payments must be between 2 and 24" }, { status: 400 });
      }
      if (!billingPeriodDays || billingPeriodDays < 1) {
        return NextResponse.json({ success: false, error: "Billing period must be at least 1 day" }, { status: 400 });
      }
      if (splitMode === "custom") {
        const err1 = validatePositive(initialPrice, "Initial price");
        const err2 = validatePositive(installmentPrice, "Installment price");
        if (err1) return NextResponse.json({ success: false, error: err1 }, { status: 400 });
        if (err2) return NextResponse.json({ success: false, error: err2 }, { status: 400 });
      } else {
        const err = validatePositive(totalAmount, "Total amount");
        if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });
      }
    }

    // Verify closer exists
    const closer = await prisma.closer.findUnique({ where: { id: closerId } });
    if (!closer) {
      return NextResponse.json(
        { success: false, error: "Closer not found" },
        { status: 404 }
      );
    }

    // Build plan creation params based on payment type
    const internalNotes: Record<string, unknown> = {
      closer_id: closerId,
      created_via: "closerpay",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planParams: Record<string, any> = {
      company_id: COMPANY_ID,
      product_id: productId,
      currency: "usd",
      visibility: "quick_link",
    };

    if (title) planParams.title = title;

    let dbTotalAmount = 0;
    let dbInitialPrice = 0;
    let dbRenewalPrice: number | null = null;
    let dbBillingPeriodDays: number | null = null;
    let dbSplitPayments: number | null = null;
    let dbPlanType = paymentType;
    let customSplitDesc: string | null = null;

    switch (paymentType) {
      case "one_time": {
        planParams.plan_type = "one_time";
        planParams.initial_price = amount;
        dbTotalAmount = amount;
        dbInitialPrice = amount;
        internalNotes.link_type = "one_time";
        break;
      }
      case "renewal": {
        planParams.plan_type = "renewal";
        planParams.renewal_price = renewalPrice;
        planParams.billing_period = billingPeriodDays;
        dbTotalAmount = renewalPrice; // ongoing, so just the per-period price
        dbInitialPrice = 0;
        dbRenewalPrice = renewalPrice;
        dbBillingPeriodDays = billingPeriodDays;
        internalNotes.link_type = "recurring";
        break;
      }
      case "split_pay": {
        if (splitMode === "custom") {
          // Custom split: different first payment
          planParams.plan_type = "renewal";
          planParams.initial_price = initialPrice;
          planParams.renewal_price = installmentPrice;
          planParams.billing_period = billingPeriodDays;
          planParams.split_pay_required_payments = numberOfPayments;

          const calcTotal =
            initialPrice + installmentPrice * (numberOfPayments - 1);
          dbTotalAmount = calcTotal;
          dbInitialPrice = initialPrice;
          dbRenewalPrice = installmentPrice;
          dbBillingPeriodDays = billingPeriodDays;
          dbSplitPayments = numberOfPayments;
          dbPlanType = "custom_split";

          const breakdown = [
            initialPrice,
            ...Array(numberOfPayments - 1).fill(installmentPrice),
          ];
          customSplitDesc = breakdown
            .map(
              (amt: number, i: number) =>
                `Payment ${i + 1}: $${amt.toFixed(2)}`
            )
            .join(" | ");

          internalNotes.link_type = "custom_split";
          internalNotes.total_amount = calcTotal;
          internalNotes.installments = numberOfPayments;
          internalNotes.split_breakdown = breakdown;
        } else {
          // Equal installments
          const perPayment = totalAmount / numberOfPayments;
          planParams.plan_type = "renewal";
          planParams.renewal_price = perPayment;
          planParams.billing_period = billingPeriodDays;
          planParams.split_pay_required_payments = numberOfPayments;

          dbTotalAmount = totalAmount;
          dbInitialPrice = perPayment;
          dbRenewalPrice = perPayment;
          dbBillingPeriodDays = billingPeriodDays;
          dbSplitPayments = numberOfPayments;

          internalNotes.link_type = "split_pay";
          internalNotes.total_amount = totalAmount;
          internalNotes.installments = numberOfPayments;
        }
        break;
      }
      default:
        return NextResponse.json(
          { success: false, error: "Invalid payment type" },
          { status: 400 }
        );
    }

    planParams.internal_notes = JSON.stringify(internalNotes);

    // Create plan on Whop
    const plan = await whopClient.plans.create(planParams as Parameters<typeof whopClient.plans.create>[0]);

    // Store in database
    const paymentLink = await prisma.paymentLink.create({
      data: {
        closerId,
        whopPlanId: plan.id,
        whopProductId: productId,
        productName: productName || "Unknown Product",
        purchaseUrl: (plan as unknown as Record<string, string>).purchase_url || "",
        planType: dbPlanType,
        totalAmount: dbTotalAmount,
        initialPrice: dbInitialPrice,
        renewalPrice: dbRenewalPrice,
        billingPeriodDays: dbBillingPeriodDays,
        splitPayments: dbSplitPayments,
        customSplitDescription: customSplitDesc,
        title: title || null,
        description: description || null,
        internalNotes: JSON.stringify(internalNotes),
      },
      include: {
        closer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      { success: true, data: paymentLink },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create payment link:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create payment link";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
