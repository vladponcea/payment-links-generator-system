import { NextRequest, NextResponse } from "next/server";
import { whopClient, COMPANY_ID } from "@/lib/whop";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.WHOP_API_KEY || !COMPANY_ID) {
      return NextResponse.json(
        { success: false, error: "Whop API key or Company ID not configured" },
        { status: 500 }
      );
    }

    // Check if caller wants all products (for settings page) or only enabled ones
    const all = request.nextUrl.searchParams.get("all") === "true";

    const products: Array<{ id: string; title: string; description?: string; created_at?: string }> = [];

    for await (const product of whopClient.products.list({
      company_id: COMPANY_ID,
    })) {
      const p = product as unknown as Record<string, unknown>;
      products.push({
        id: product.id,
        title: (p.title as string) || product.id,
        description: p.description as string | undefined,
        created_at: p.created_at as string | undefined,
      });
    }

    // If not requesting all, filter by enabled products (if any are configured)
    if (!all) {
      const settings = await prisma.appSettings.findUnique({
        where: { id: "default" },
        select: { enabledProductIds: true },
      });

      const enabledIds = settings?.enabledProductIds as string[] | null;

      if (enabledIds && enabledIds.length > 0) {
        const enabledSet = new Set(enabledIds);
        const filtered = products.filter((p) => enabledSet.has(p.id));
        return NextResponse.json({ success: true, data: filtered });
      }
    }

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch products from Whop";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
