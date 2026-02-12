import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total revenue (all time)
    const totalRevenueResult = await prisma.payment.aggregate({
      where: { status: "succeeded" },
      _sum: { amount: true },
      _count: true,
    });

    // This month's revenue
    const monthlyRevenueResult = await prisma.payment.aggregate({
      where: {
        status: "succeeded",
        paidAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Last month's revenue (for comparison)
    const lastMonthRevenueResult = await prisma.payment.aggregate({
      where: {
        status: "succeeded",
        paidAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { amount: true },
      _count: true,
    });

    const totalRevenue = totalRevenueResult._sum.amount || 0;
    const totalSales = totalRevenueResult._count;
    const monthlyRevenue = monthlyRevenueResult._sum.amount || 0;
    const monthlySales = monthlyRevenueResult._count;
    const lastMonthRevenue = lastMonthRevenueResult._sum.amount || 0;
    const lastMonthSales = lastMonthRevenueResult._count;

    const averageDealSize = totalSales > 0 ? totalRevenue / totalSales : 0;

    const revenueChange =
      lastMonthRevenue > 0
        ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : monthlyRevenue > 0
        ? 100
        : 0;

    const salesChange =
      lastMonthSales > 0
        ? ((monthlySales - lastMonthSales) / lastMonthSales) * 100
        : monthlySales > 0
        ? 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        monthlyRevenue,
        totalSales,
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
