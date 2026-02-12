import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/closers/[id] — Get a closer (user with role "closer") by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const closer = await prisma.user.findUnique({
      where: { id, role: "closer" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        commissionType: true,
        commissionValue: true,
        isActive: true,
        createdAt: true,
        payments: {
          where: { status: "succeeded" },
          orderBy: { paidAt: "desc" },
          take: 20,
        },
        _count: {
          select: {
            paymentLinks: true,
            payments: { where: { status: "succeeded" } },
          },
        },
      },
    });

    if (!closer) {
      return NextResponse.json(
        { success: false, error: "Closer not found" },
        { status: 404 }
      );
    }

    const totalRevenue = await prisma.payment.aggregate({
      where: { closerId: id, status: "succeeded" },
      _sum: { amount: true },
    });

    const totalCommission = await prisma.payment.aggregate({
      where: { closerId: id, status: "succeeded" },
      _sum: { commissionAmount: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...closer,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalCommission: totalCommission._sum.commissionAmount || 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch closer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch closer" },
      { status: 500 }
    );
  }
}
