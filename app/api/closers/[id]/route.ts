import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const closer = await prisma.closer.findUnique({
      where: { id },
      include: {
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, commissionType, commissionValue, isActive } = body;

    const closer = await prisma.closer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(commissionType !== undefined && { commissionType }),
        ...(commissionValue !== undefined && {
          commissionValue: parseFloat(commissionValue),
        }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, data: closer });
  } catch (error) {
    console.error("Failed to update closer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update closer" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.closer.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete closer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete closer" },
      { status: 500 }
    );
  }
}
