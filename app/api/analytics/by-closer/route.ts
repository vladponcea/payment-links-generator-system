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

    const closers = await prisma.closer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        payments: {
          where: {
            status: "succeeded",
            ...(hasDateFilter ? { paidAt: dateFilter } : {}),
          },
          select: {
            amount: true,
            commissionAmount: true,
          },
        },
      },
    });

    const data = closers
      .map((closer) => ({
        closerId: closer.id,
        closerName: closer.name,
        revenue: closer.payments.reduce((sum, p) => sum + p.amount, 0),
        sales: closer.payments.length,
        commission: closer.payments.reduce(
          (sum, p) => sum + (p.commissionAmount || 0),
          0
        ),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to fetch closer analytics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch closer analytics" },
      { status: 500 }
    );
  }
}
