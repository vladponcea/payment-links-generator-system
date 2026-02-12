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

// ── Webhook handler ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Clone the request so we can read the body after verification
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

    // Log full payload for debugging (safe to remove later)
    console.log("Webhook payload:", JSON.stringify(payload, null, 2));

    // Whop v1 uses "type", but also handle "action" / "event" as fallbacks
    const eventType =
      payload.type || payload.action || payload.event || "unknown";
    console.log("Webhook event type:", eventType);

    // Use payload.id for idempotency; generate a fallback for test webhooks
    const messageId =
      payload.id ||
      `wh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { whopMessageId: messageId },
    });

    if (existingEvent?.processedAt) {
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

    // The event data may be at payload.data or at the top level
    const eventData = payload.data || payload;

    // Process the event — handle both dot and underscore formats
    // (e.g. "payment.succeeded" or "payment_succeeded")
    try {
      switch (eventType) {
        case "payment.succeeded":
        case "payment_succeeded":
          await handlePaymentSucceeded(eventData);
          break;
        case "payment.failed":
        case "payment_failed":
          await handlePaymentFailed(eventData);
          break;
        case "payment.pending":
        case "payment_pending":
          await handlePaymentPending(eventData);
          break;
        case "refund.created":
        case "refund_created":
        case "refund.updated":
        case "refund_updated":
          await handleRefund(eventData);
          break;
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

// ── Event handlers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentSucceeded(data: any) {
  const planId = data.plan?.id;
  if (!planId) return;

  const paymentLink = await prisma.paymentLink.findFirst({
    where: { whopPlanId: planId },
    include: { closer: true },
  });

  if (!paymentLink) return;

  const closer = paymentLink.closer;
  const paymentAmount = data.creator_total || data.amount || 0;

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
      productName: data.product?.title || paymentLink.productName,
      customerEmail: data.user?.email,
      customerName: data.user?.name,
      customerId: data.user?.id,
      membershipId: data.membership?.id,
      amount: paymentAmount,
      currency: data.currency || "usd",
      status: "succeeded",
      paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
      installmentNumber: existingPayments + 1,
      isRecurring: paymentLink.planType !== "one_time",
      commissionAmount,
      whopWebhookData: data,
    },
    update: {
      status: "succeeded",
      paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
      whopWebhookData: data,
    },
  });
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
      amount: data.creator_total || data.amount || 0,
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
      amount: data.creator_total || data.amount || 0,
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
  const paymentId = data.payment?.id;
  if (!paymentId) return;

  await prisma.payment.updateMany({
    where: { whopPaymentId: paymentId },
    data: {
      status: "refunded",
      refundedAt: new Date(),
      refundAmount: data.amount || 0,
    },
  });
}
