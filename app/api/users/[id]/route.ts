import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// PUT /api/users/[id] — Update a user (admin only, enforced by middleware)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email, password, name, role, isActive, commissionType, commissionValue } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Build user update data
    const userData: Record<string, unknown> = {};
    if (email !== undefined) userData.email = email.toLowerCase().trim();
    if (name !== undefined) userData.name = name;
    if (role !== undefined) {
      if (!["admin", "closer"].includes(role)) {
        return NextResponse.json(
          { success: false, error: "Role must be 'admin' or 'closer'" },
          { status: 400 }
        );
      }
      userData.role = role;
    }
    if (isActive !== undefined) userData.isActive = isActive;
    if (commissionType !== undefined) {
      if (!["percentage", "flat"].includes(commissionType)) {
        return NextResponse.json(
          { success: false, error: "Commission type must be 'percentage' or 'flat'" },
          { status: 400 }
        );
      }
      userData.commissionType = commissionType;
    }
    if (commissionValue !== undefined) userData.commissionValue = Number(commissionValue);

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      userData.passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: userData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        commissionType: true,
        commissionValue: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] — Deactivate a user (admin only, enforced by middleware)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Failed to deactivate user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to deactivate user" },
      { status: 500 }
    );
  }
}
