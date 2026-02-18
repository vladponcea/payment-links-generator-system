import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── Webhook verification ────────────────────────────────────────────
// Whop sends the webhook secret in the "webhook-secret" header.
// We verify by comparing it against our stored secret.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifyWebhook(request: NextRequest): Promise<boolean> {
  const receivedSecret = request.headers.get("webhook-secret");
  if (!receivedSecret) {
    console.error("Missing webhook-secret header");
    return false;
  }

  const settings = await prisma.appSettings
    .findUnique({ where: { id: "default" } })
    .catch(() => null);
  const expectedSecret =
    settings?.webhookSecret || process.env.WHOP_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.warn("No webhook secret configured — skipping verification");
    return true;
  }

  return timingSafeEqual(receivedSecret, expectedSecret);
}

// ── Whop v2 Webhook Payload Types ───────────────────────────────────
//
// Real payload shape (v2):
// {
//   "action": "payment.succeeded",
//   "api_version": "v2",
//   "data": {
//     "id": "pay_xxx",
//     "product": { "id": "prod_xxx", "title": "...", "name": "..." },
//     "plan": { "id": "plan_xxx", "internal_notes": "{...}", ... },
//     "user": { "id": "user_xxx", "name": "...", "email": "..." },
//     "membership": { "id": "mem_xxx", "email": "...", ... },
//     "final_amount": 100,
//     "total": "100.0",
//     "currency": "usd",
//     "status": "paid",
//     "paid_at": 1770890631,          // Unix timestamp (seconds)
//     "created_at": 1770890625,       // Unix timestamp (seconds)
//     "refunded_amount": 0,
//     "refunded_at": null,
//     "last4": "2750",
//     "card_brand": "visa",
//     "billing_reason": "one_time",
//     ...
//   }
// }

// ── Webhook handler ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const isValid = await verifyWebhook(request);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { status: "error", message: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);

    // Whop v2 uses "action" for the event type
    const eventType = payload.action || payload.type || "unknown";
    const eventData = payload.data || {};

    console.log("Webhook event:", eventType, "| Payment ID:", eventData.id);

    // Use the payment/resource ID for idempotency
    const messageId =
      eventData.id ||
      payload.id ||
      `wh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Check if already processed
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { whopMessageId: messageId },
    });

    if (existingEvent?.processedAt) {
      console.log("Already processed:", messageId);
      return NextResponse.json({ status: "already_processed" });
    }

    // Store raw event
    await prisma.webhookEvent.upsert({
      where: { whopMessageId: messageId },
      create: {
        whopMessageId: messageId,
        eventType: eventType,
        payload: payload,
      },
      update: {},
    });

    // Process the event
    try {
      switch (eventType) {
        case "payment.succeeded":
          await handlePaymentSucceeded(eventData);
          break;
        case "payment.failed":
          await handlePaymentFailed(eventData);
          break;
        case "payment.pending":
          await handlePaymentPending(eventData);
          break;
        case "refund.created":
        case "refund.updated":
          await handleRefund(eventData);
          break;
        default:
          console.log("Unhandled event type:", eventType);
      }

      await prisma.webhookEvent.update({
        where: { whopMessageId: messageId },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      console.error("Webhook processing error:", error);
      await prisma.webhookEvent.update({
        where: { whopMessageId: messageId },
        data: { error: String(error) },
      });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Convert a Whop Unix timestamp (seconds) to a JS Date */
function whopDate(ts: number | string | null | undefined): Date {
  if (!ts) return new Date();
  const n = typeof ts === "string" ? parseInt(ts, 10) : ts;
  // Whop timestamps are in seconds; JS Date expects milliseconds
  return new Date(n * 1000);
}

/** Parse the amount from Whop — use "total" (string) as source of truth */
function whopAmount(data: Record<string, unknown>): number {
  if (typeof data.total === "string") return parseFloat(data.total) || 0;
  if (typeof data.total === "number") return data.total;
  if (typeof data.final_amount === "number") return data.final_amount;
  if (typeof data.subtotal === "number") return data.subtotal;
  return 0;
}

// ── Event handlers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentSucceeded(data: any) {
  const planId = data.plan?.id;
  if (!planId) {
    console.warn("payment.succeeded: no plan.id in payload");
    return;
  }

  const paymentLink = await prisma.paymentLink.findFirst({
    where: { whopPlanId: planId },
    include: { closer: true },
  });

  if (!paymentLink) {
    console.warn("payment.succeeded: no payment link found for plan", planId);
    return;
  }

  const closer = paymentLink.closer;
  const paymentAmount = whopAmount(data);

  let commissionAmount = 0;
  if (closer.commissionType === "percentage") {
    commissionAmount = paymentAmount * (closer.commissionValue / 100);
  } else {
    commissionAmount = closer.commissionValue;
  }

  const existingPayments = await prisma.payment.count({
    where: { paymentLinkId: paymentLink.id, status: "succeeded" },
  });

  await prisma.payment.upsert({
    where: { whopPaymentId: data.id },
    create: {
      whopPaymentId: data.id,
      closerId: paymentLink.closerId,
      paymentLinkId: paymentLink.id,
      whopPlanId: planId,
      whopProductId: data.product?.id,
      productName:
        data.product?.title || data.product?.name || paymentLink.productName,
      customerEmail: data.user?.email || data.membership?.email,
      customerName: data.user?.name,
      customerId: data.user?.id,
      membershipId: data.membership?.id,
      amount: paymentAmount,
      currency: data.currency || "usd",
      status: "succeeded",
      paidAt: whopDate(data.paid_at),
      installmentNumber: existingPayments + 1,
      isRecurring: paymentLink.planType !== "one_time",
      commissionAmount,
      whopWebhookData: data,
    },
    update: {
      status: "succeeded",
      paidAt: whopDate(data.paid_at),
      whopWebhookData: data,
    },
  });

  console.log(
    `Payment recorded: $${paymentAmount} from ${data.user?.name || "unknown"} via plan ${planId}`
  );

  // Forward to Zapier webhook if configured (fire-and-forget)
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { zapierWebhookUrl: true },
  });
  const zapierUrl = settings?.zapierWebhookUrl?.trim();
  if (zapierUrl) {
    const hasTotal =
      paymentLink.planType === "down_payment" ||
      paymentLink.planType === "split_pay" ||
      paymentLink.planType === "custom_split";
    const nameParts = (closer.name || "").trim().split(/\s+/);
    const closerFirstName = nameParts[0] ?? "";
    const closerLastName = nameParts.slice(1).join(" ") ?? "";
    const payload = {
      client_name: data.user?.name ?? data.membership?.email ?? null,
      client_email: data.user?.email ?? data.membership?.email ?? null,
      package:
        data.product?.title ||
        data.product?.name ||
        paymentLink.productName ||
        null,
      amount_collected: paymentAmount,
      total_to_be_collected: hasTotal ? paymentLink.totalAmount : null,
      payment_type: paymentLink.planType,
      closer_first_name: closerFirstName,
      closer_last_name: closerLastName,
    };
    fetch(zapierUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) =>
      console.error("Zapier webhook forward failed:", err)
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(data: any) {
  const planId = data.plan?.id;
  if (!planId) return;

  const paymentLink = await prisma.paymentLink.findFirst({
    where: { whopPlanId: planId },
  });

  if (!paymentLink) return;

  await prisma.payment.upsert({
    where: { whopPaymentId: data.id },
    create: {
      whopPaymentId: data.id,
      closerId: paymentLink.closerId,
      paymentLinkId: paymentLink.id,
      whopPlanId: planId,
      amount: whopAmount(data),
      status: "failed",
      whopWebhookData: data,
    },
    update: {
      status: "failed",
      whopWebhookData: data,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentPending(data: any) {
  const planId = data.plan?.id;
  if (!planId) return;

  const paymentLink = await prisma.paymentLink.findFirst({
    where: { whopPlanId: planId },
  });

  if (!paymentLink) return;

  await prisma.payment.upsert({
    where: { whopPaymentId: data.id },
    create: {
      whopPaymentId: data.id,
      closerId: paymentLink.closerId,
      paymentLinkId: paymentLink.id,
      whopPlanId: planId,
      amount: whopAmount(data),
      status: "pending",
      whopWebhookData: data,
    },
    update: {
      status: "pending",
      whopWebhookData: data,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRefund(data: any) {
  // For refunds, the payment ID may be at data.payment.id or data.id
  const paymentId = data.payment?.id || data.id;
  if (!paymentId) return;

  const refundAmount =
    typeof data.refunded_amount === "number"
      ? data.refunded_amount
      : typeof data.amount === "number"
        ? data.amount
        : 0;

  await prisma.payment.updateMany({
    where: { whopPaymentId: paymentId },
    data: {
      status: "refunded",
      refundedAt: data.refunded_at ? whopDate(data.refunded_at) : new Date(),
      refundAmount,
    },
  });
}
