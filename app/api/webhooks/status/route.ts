import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });

    const recentEvents = await prisma.webhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        whopMessageId: true,
        eventType: true,
        processedAt: true,
        error: true,
        createdAt: true,
      },
    });

    // Zapier delivery log — recent payments with Zapier status
    const zapierDeliveries = await prisma.payment.findMany({
      where: {
        status: "succeeded",
        zapierStatus: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        whopPaymentId: true,
        customerName: true,
        customerEmail: true,
        productName: true,
        amount: true,
        zapierStatus: true,
        zapierError: true,
        zapierSentAt: true,
        createdAt: true,
      },
    });

    // Count of payments that never had Zapier attempted (legacy/null status)
    const missingZapierCount = await prisma.payment.count({
      where: {
        status: "succeeded",
        zapierStatus: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        isRegistered: !!settings?.whopWebhookId,
        webhookId: settings?.whopWebhookId,
        webhookUrl: settings?.webhookUrl,
        registeredAt: settings?.registeredAt,
        recentEvents,
        zapierDeliveries,
        missingZapierCount,
      },
    });
  } catch (error) {
    console.error("Failed to get webhook status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get webhook status" },
      { status: 500 }
    );
  }
}
