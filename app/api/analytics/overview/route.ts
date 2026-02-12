import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build date filter
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

    // Closer filter: closers only see their own data; admins can filter by closerId param
    const closerIdParam = searchParams.get("closerId");
    const closerFilter =
      user?.role === "closer"
        ? { closerId: user.userId }
        : closerIdParam
        ? { closerId: closerIdParam }
        : {};

    // All-time revenue (always unfiltered by date, but filtered by closer)
    const allTimeResult = await prisma.payment.aggregate({
      where: { status: "succeeded", ...closerFilter },
      _sum: { amount: true },
      _count: true,
    });

    // Revenue for selected period
    const periodResult = await prisma.payment.aggregate({
      where: {
        status: "succeeded",
        ...closerFilter,
        ...(hasDateFilter ? { paidAt: dateFilter } : {}),
      },
      _sum: { amount: true },
      _count: true,
    });

    // Calculate comparison period (same duration, immediately prior)
    let prevResult = { _sum: { amount: null as number | null }, _count: 0 };
    if (hasDateFilter && dateFilter.gte) {
      const start = new Date(dateFilter.gte);
      const end = dateFilter.lte ? new Date(dateFilter.lte) : new Date();
      const duration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - duration);
      const prevEnd = new Date(start.getTime() - 1);

      prevResult = await prisma.payment.aggregate({
        where: {
          status: "succeeded",
          ...closerFilter,
          paidAt: { gte: prevStart, lte: prevEnd },
        },
        _sum: { amount: true },
        _count: true,
      });
    }

    // Total commission (all-time, filtered by closer)
    const commissionResult = await prisma.payment.aggregate({
      where: { status: "succeeded", ...closerFilter },
      _sum: { commissionAmount: true },
    });

    const allTimeRevenue = allTimeResult._sum.amount || 0;
    const allTimeSales = allTimeResult._count;
    const periodRevenue = periodResult._sum.amount || 0;
    const periodSales = periodResult._count;
    const prevRevenue = prevResult._sum.amount || 0;
    const prevSales = prevResult._count;
    const totalCommission = commissionResult._sum.commissionAmount || 0;

    const averageDealSize = periodSales > 0 ? periodRevenue / periodSales : 0;

    const revenueChange =
      prevRevenue > 0
        ? ((periodRevenue - prevRevenue) / prevRevenue) * 100
        : periodRevenue > 0
        ? 100
        : 0;

    const salesChange =
      prevSales > 0
        ? ((periodSales - prevSales) / prevSales) * 100
        : periodSales > 0
        ? 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue: allTimeRevenue,
        totalCommission,
        totalSales: hasDateFilter ? periodSales : allTimeSales,
        averageDealSize,
        revenueChange: Math.round(revenueChange * 10) / 10,
        salesChange: Math.round(salesChange * 10) / 10,
      },
    });
  } catch (error) {
    console.error("Failed to fetch analytics overview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
