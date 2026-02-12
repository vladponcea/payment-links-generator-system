import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30") || 30));

    // Determine date range
    let startDate: Date;
    let endDate: Date;

    if (from) {
      startDate = new Date(from);
      if (isNaN(startDate.getTime())) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
      }
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    if (to) {
      endDate = new Date(to);
      if (isNaN(endDate.getTime())) endDate = new Date();
    } else {
      endDate = new Date();
    }

    // Closer filter: closers only see their own data; admins can filter by closerId param
    const closerIdParam = searchParams.get("closerId");
    const closerFilter =
      user?.role === "closer"
        ? { closerId: user.userId }
        : closerIdParam
        ? { closerId: closerIdParam }
        : {};

    const payments = await prisma.payment.findMany({
      where: {
        status: "succeeded",
        paidAt: { gte: startDate, lte: endDate },
        ...closerFilter,
      },
      select: {
        amount: true,
        paidAt: true,
      },
      orderBy: { paidAt: "asc" },
    });

    // Group by date
    const revenueByDate: Record<string, number> = {};

    // Fill all dates in range with 0
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      revenueByDate[key] = 0;
    }

    // Sum payments per date
    for (const payment of payments) {
      if (payment.paidAt) {
        const key = new Date(payment.paidAt).toISOString().split("T")[0];
        revenueByDate[key] = (revenueByDate[key] || 0) + payment.amount;
      }
    }

    const data = Object.entries(revenueByDate).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue * 100) / 100,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to fetch revenue data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
