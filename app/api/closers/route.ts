import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/closers — Returns users with role "closer" (for dropdowns, generate page, etc.)
export async function GET() {
  try {
    const closers = await prisma.user.findMany({
      where: { role: "closer", isActive: true },
      orderBy: { createdAt: "desc" },
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
