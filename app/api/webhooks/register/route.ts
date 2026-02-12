import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { whopClient, COMPANY_ID } from "@/lib/whop";

export async function POST() {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { success: false, error: "NEXT_PUBLIC_APP_URL is not configured" },
        { status: 500 }
      );
    }

    const webhookUrl = `${appUrl}/api/webhooks/whop`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webhook = await (whopClient.webhooks as any).create({
      company_id: COMPANY_ID,
      url: webhookUrl,
    });

    // Store webhook info
    await prisma.appSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        whopWebhookId: webhook.id,
        webhookSecret: webhook.webhook_secret || null,
        webhookUrl,
        registeredAt: new Date(),
      },
      update: {
        whopWebhookId: webhook.id,
        webhookSecret: webhook.webhook_secret || null,
        webhookUrl,
        registeredAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        webhookId: webhook.id,
        url: webhookUrl,
        secret: webhook.webhook_secret ? "****" + webhook.webhook_secret.slice(-4) : null,
      },
    });
  } catch (error) {
    console.error("Failed to register webhook:", error);
    const message =
      error instanceof Error ? error.message : "Failed to register webhook";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
