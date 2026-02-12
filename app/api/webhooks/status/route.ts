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

    return NextResponse.json({
      success: true,
      data: {
        isRegistered: !!settings?.whopWebhookId,
        webhookId: settings?.whopWebhookId,
        webhookUrl: settings?.webhookUrl,
        registeredAt: settings?.registeredAt,
        recentEvents,
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
