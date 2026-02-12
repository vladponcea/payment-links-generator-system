import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const closers = await prisma.closer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        payments: {
          where: { status: "succeeded" },
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
