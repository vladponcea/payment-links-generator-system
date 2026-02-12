import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
      select: { enabledProductIds: true },
    });

    const enabledProductIds = (settings?.enabledProductIds as string[] | null) ?? [];

    return NextResponse.json({ success: true, data: { enabledProductIds } });
  } catch (error) {
    console.error("Failed to fetch product settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch product settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { enabledProductIds } = body;

    if (!Array.isArray(enabledProductIds)) {
      return NextResponse.json(
        { success: false, error: "enabledProductIds must be an array" },
        { status: 400 }
      );
    }

    // Validate all IDs are strings
    if (!enabledProductIds.every((id: unknown) => typeof id === "string")) {
      return NextResponse.json(
        { success: false, error: "All product IDs must be strings" },
        { status: 400 }
      );
    }

    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: { enabledProductIds },
      create: { id: "default", enabledProductIds },
    });

    return NextResponse.json({ success: true, data: { enabledProductIds } });
  } catch (error) {
    console.error("Failed to update product settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update product settings" },
      { status: 500 }
    );
  }
}
