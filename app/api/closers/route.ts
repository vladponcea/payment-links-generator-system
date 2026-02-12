import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const closers = await prisma.closer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            paymentLinks: true,
            payments: { where: { status: "succeeded" } },
          },
        },
      },
    });
    return NextResponse.json({ success: true, data: closers });
  } catch (error) {
    console.error("Failed to fetch closers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch closers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, commissionType, commissionValue } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Name and email are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.closer.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A closer with this email already exists" },
        { status: 409 }
      );
    }

    const closer = await prisma.closer.create({
      data: {
        name,
        email,
        phone: phone || null,
        commissionType: commissionType || "percentage",
        commissionValue: commissionValue ? parseFloat(commissionValue) : 0,
      },
    });

    return NextResponse.json({ success: true, data: closer }, { status: 201 });
  } catch (error) {
    console.error("Failed to create closer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create closer" },
      { status: 500 }
    );
  }
}
