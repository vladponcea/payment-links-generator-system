import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const closerId = searchParams.get("closerId");
    const status = searchParams.get("status");
    const dpStatus = searchParams.get("dpStatus");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      paymentLink: {
        planType: "down_payment",
      },
    };

    if (closerId) {
      where.closerId = closerId;
    }
    if (status) {
      where.status = status;
    }
    if (dpStatus === "pending") {
      where.paymentLink.downPaymentStatus = null;
    } else if (dpStatus) {
      where.paymentLink.downPaymentStatus = dpStatus;
    }
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { closer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          closer: { select: { id: true, name: true } },
          paymentLink: {
            select: {
              id: true,
              productName: true,
              totalAmount: true,
              initialPrice: true,
              planType: true,
              downPaymentStatus: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Failed to fetch down payments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch down payments" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentLinkId, downPaymentStatus } = body;

    if (!paymentLinkId) {
      return NextResponse.json(
        { success: false, error: "Payment link ID is required" },
        { status: 400 }
      );
    }

    const validStatuses = ["fully_paid", "cancelled", null];
    if (!validStatuses.includes(downPaymentStatus)) {
      return NextResponse.json(
        { success: false, error: "Invalid status. Must be fully_paid, cancelled, or null" },
        { status: 400 }
      );
    }

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id: paymentLinkId },
      select: { planType: true },
    });

    if (!paymentLink || paymentLink.planType !== "down_payment") {
      return NextResponse.json(
        { success: false, error: "Down payment link not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.paymentLink.update({
      where: { id: paymentLinkId },
      data: { downPaymentStatus },
      select: { id: true, downPaymentStatus: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update down payment status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update status" },
      { status: 500 }
    );
  }
}
