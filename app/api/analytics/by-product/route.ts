import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) dateFilter.lte = d;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const payments = await prisma.payment.findMany({
      where: {
        status: "succeeded",
        ...(hasDateFilter ? { paidAt: dateFilter } : {}),
      },
      select: {
        amount: true,
        productName: true,
        whopProductId: true,
      },
    });

    const productMap: Record<
      string,
      { productName: string; productId: string; revenue: number; sales: number }
    > = {};

    for (const payment of payments) {
      const key = payment.whopProductId || payment.productName || "Unknown";
      if (!productMap[key]) {
        productMap[key] = {
          productName: payment.productName || "Unknown Product",
          productId: payment.whopProductId || "",
          revenue: 0,
          sales: 0,
        };
      }
      productMap[key].revenue += payment.amount;
      productMap[key].sales += 1;
    }

    const data = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to fetch product analytics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch product analytics" },
      { status: 500 }
    );
  }
}
