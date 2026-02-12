import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: "succeeded" },
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
