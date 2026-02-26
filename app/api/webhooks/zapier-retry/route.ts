import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "paymentId is required" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        paymentLink: { include: { closer: true } },
        closer: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 }
      );
    }

    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
      select: { zapierWebhookUrl: true },
    });
    const zapierUrl = settings?.zapierWebhookUrl?.trim();

    if (!zapierUrl) {
      return NextResponse.json(
        { success: false, error: "No Zapier webhook URL configured" },
        { status: 400 }
      );
    }

    const closer = payment.closer;
    const paymentLink = payment.paymentLink;
    const webhookData = (payment.whopWebhookData as Record<string, unknown>) || {};

    const hasTotal = paymentLink && (
      paymentLink.planType === "down_payment" ||
      paymentLink.planType === "split_pay" ||
      paymentLink.planType === "custom_split"
    );
    const nameParts = (closer.name || "").trim().split(/\s+/);
    const closerFirstName = nameParts[0] ?? "";
    const closerLastName = nameParts.slice(1).join(" ") ?? "";

    const whopUser = webhookData.user as Record<string, unknown> | undefined;
    const whopMembership = webhookData.membership as Record<string, unknown> | undefined;
    const whopProduct = webhookData.product as Record<string, unknown> | undefined;

    const payload = {
      client_name:
        whopUser?.name || whopMembership?.name || paymentLink?.clientName || payment.customerEmail,
      client_email: payment.customerEmail,
      package:
        whopProduct?.title || whopProduct?.name || payment.productName || null,
      amount_collected: payment.amount,
      total_to_be_collected: hasTotal ? paymentLink?.totalAmount : null,
      payment_type: paymentLink?.planType || "unknown",
      closer_first_name: closerFirstName,
      closer_last_name: closerLastName,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(zapierUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.ok) {
        await prisma.payment.update({
          where: { id: paymentId },
          data: { zapierStatus: "sent", zapierSentAt: new Date(), zapierError: null },
        });
        return NextResponse.json({ success: true, data: { status: "sent" } });
      }

      const errText = await res.text().catch(() => "");
      const errMsg = `HTTP ${res.status}: ${errText}`.slice(0, 500);

      await prisma.payment.update({
        where: { id: paymentId },
        data: { zapierStatus: "failed", zapierError: errMsg },
      });

      return NextResponse.json(
        { success: false, error: `Zapier returned ${res.status}` },
        { status: 502 }
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      await prisma.payment.update({
        where: { id: paymentId },
        data: { zapierStatus: "failed", zapierError: errMsg.slice(0, 500) },
      }).catch(() => {});

      return NextResponse.json(
        { success: false, error: errMsg },
        { status: 500 }
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
