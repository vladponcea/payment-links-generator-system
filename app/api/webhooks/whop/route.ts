import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Webhook } from "standardwebhooks";

// ── Webhook handler ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Log all headers for debugging (safe to remove later)
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = key.toLowerCase().includes("secret") ? "[REDACTED]" : value;
    });
    console.log("Webhook headers received:", JSON.stringify(allHeaders, null, 2));

    // Get the webhook secret
    const settings = await prisma.appSettings
      .findUnique({ where: { id: "default" } })
      .catch(() => null);
    const secret = settings?.webhookSecret || process.env.WHOP_WEBHOOK_SECRET;

    if (!secret) {
      console.warn("No webhook secret configured — skipping verification");
    } else {
      // The standardwebhooks library expects a base64-encoded key.
      // Whop's SDK does: btoa(process.env.WHOP_WEBHOOK_SECRET)
      const base64Key = btoa(secret);

      const wh = new Webhook(base64Key);

      // Build headers object from request
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      try {
        wh.verify(body, headers);
      } catch (err) {
        console.error("Webhook verification failed:", err);
        return NextResponse.json(
          { status: "error", message: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(body);

    // Use webhook-id header for idempotency, fall back to payload.id
    const messageId =
      request.headers.get("webhook-id") ||
      request.headers.get("svix-id") ||
      payload.id;

    if (!messageId) {
      return NextResponse.json(
        { status: "error", message: "Missing message ID" },
        { status: 400 }
      );
    }

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
        eventType: payload.type || "unknown",
        payload: payload,
      },
      update: {},
    });

    // Process the event
    try {
      switch (payload.type) {
        case "payment.succeeded":
          await handlePaymentSucceeded(payload.data);
          break;
        case "payment.failed":
          await handlePaymentFailed(payload.data);
          break;
        case "payment.pending":
          await handlePaymentPending(payload.data);
          break;
        case "refund.created":
        case "refund.updated":
          await handleRefund(payload.data);
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
