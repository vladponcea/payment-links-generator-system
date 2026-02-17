import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
      select: { zapierWebhookUrl: true },
    });

    return NextResponse.json({
      success: true,
      data: { zapierWebhookUrl: settings?.zapierWebhookUrl ?? null },
    });
  } catch (error) {
    console.error("Failed to fetch Zapier settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Zapier settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const zapierWebhookUrl = body.zapierWebhookUrl;

    if (zapierWebhookUrl !== null && zapierWebhookUrl !== undefined) {
      const url = typeof zapierWebhookUrl === "string" ? zapierWebhookUrl.trim() : "";
      if (url && !/^https?:\/\//i.test(url)) {
        return NextResponse.json(
          { success: false, error: "URL must start with http:// or https://" },
          { status: 400 }
        );
      }
    }

    const value =
      typeof zapierWebhookUrl === "string"
        ? zapierWebhookUrl.trim() || null
        : null;

    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: { zapierWebhookUrl: value },
      create: { id: "default", zapierWebhookUrl: value },
    });

    return NextResponse.json({ success: true, data: { zapierWebhookUrl: value } });
  } catch (error) {
    console.error("Failed to update Zapier settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update Zapier settings" },
      { status: 500 }
    );
  }
}
