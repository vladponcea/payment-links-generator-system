import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const link = await prisma.paymentLink.findUnique({
      where: { id },
      include: {
        closer: { select: { id: true, name: true, email: true } },
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!link) {
      return NextResponse.json(
        { success: false, error: "Payment link not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: link });
  } catch (error) {
    console.error("Failed to fetch payment link:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payment link" },
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
    await prisma.paymentLink.update({
      where: { id },
      data: { status: "expired" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to archive payment link:", error);
    return NextResponse.json(
      { success: false, error: "Failed to archive payment link" },
      { status: 500 }
    );
  }
}
