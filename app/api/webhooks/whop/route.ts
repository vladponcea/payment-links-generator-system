import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── Standard Webhooks signature verification ────────────────────────
// Whop follows the Standard Webhooks spec:
//   Headers: webhook-id, webhook-signature, webhook-timestamp
//   Signature: HMAC-SHA256(secret, "${msg_id}.${timestamp}.${body}")
//   Format: "v1,<base64>"

const encoder = new TextEncoder();

async function verifyWebhookSignature(
  body: string,
  headers: {
    id: string | null;
    signature: string | null;
    timestamp: string | null;
  }
): Promise<boolean> {
  const secret =
    (await prisma.appSettings
      .findUnique({ where: { id: "default" } })
      .then((s) => s?.webhookSecret)) || process.env.WHOP_WEBHOOK_SECRET;

  if (!secret) {
    console.warn(
      "No webhook secret configured — skipping signature verification"
    );
    return true;
  }

  const { id, signature, timestamp } = headers;
  if (!id || !signature || !timestamp) {
    console.error("Missing webhook headers:", { id: !!id, signature: !!signature, timestamp: !!timestamp });
    return false;
  }

  // Reject old timestamps (tolerance: 5 minutes)
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    console.error("Webhook timestamp out of tolerance");
    return false;
  }

  // The signed content is: "${msg_id}.${timestamp}.${body}"
  const signedContent = `${id}.${timestamp}.${body}`;

  // The secret from Whop is the raw key string.
  // Import as HMAC-SHA256 key.
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(signedContent)
  );

  const expectedBase64 = btoa(
    String.fromCharCode(...new Uint8Array(sig))
  );

  // The webhook-signature header can contain multiple signatures:
  // "v1,<base64> v1,<base64>"
  // We check if any match.
  const signatures = signature.split(" ");
  for (const s of signatures) {
    const parts = s.split(",");
    if (parts.length < 2) continue;
    const version = parts[0];
    const sigValue = parts.slice(1).join(","); // base64 can't have commas, but be safe

    if (version !== "v1") continue;

    // Constant-time comparison
    if (sigValue.length !== expectedBase64.length) continue;
    let mismatch = 0;
    for (let i = 0; i < sigValue.length; i++) {
      mismatch |= sigValue.charCodeAt(i) ^ expectedBase64.charCodeAt(i);
    }
    if (mismatch === 0) return true;
  }

  console.error("Webhook signature mismatch");
  return false;
}

// ── Webhook handler ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Standard Webhooks headers
    const webhookId = request.headers.get("webhook-id");
    const webhookSignature = request.headers.get("webhook-signature");
    const webhookTimestamp = request.headers.get("webhook-timestamp");

    const isValid = await verifyWebhookSignature(body, {
      id: webhookId,
      signature: webhookSignature,
      timestamp: webhookTimestamp,
    });

    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { status: "error", message: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);

    // Use webhook-id header for idempotency (more reliable than payload.id)
    const messageId = webhookId || payload.id;
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

  // Find our payment link
  const paymentLink = await prisma.paymentLink.findFirst({
    where: { whopPlanId: planId },
    include: { closer: true },
  });

  if (!paymentLink) return;

  const closer = paymentLink.closer;
  const paymentAmount = data.creator_total || data.amount || 0;

  // Calculate commission
  let commissionAmount = 0;
  if (closer.commissionType === "percentage") {
    commissionAmount = paymentAmount * (closer.commissionValue / 100);
  } else {
    commissionAmount = closer.commissionValue;
  }

  // Determine installment number
  const existingPayments = await prisma.payment.count({
    where: { paymentLinkId: paymentLink.id, status: "succeeded" },
  });

  // Use upsert to prevent race condition on duplicate webhooks
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
