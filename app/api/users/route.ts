import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/users — List all users (admin only, enforced by middleware)
export async function GET() {
  try {
    const users = await prisma.user.findMany({
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users — Create a new user (admin only, enforced by middleware)
// For closer role: commission settings are stored directly on the user
export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, commissionType, commissionValue } =
      await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        {
          success: false,
          error: "Email, password, name, and role are required",
        },
        { status: 400 }
      );
    }

    if (!["admin", "closer"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Role must be 'admin' or 'closer'" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    if (role === "closer" && commissionType && !["percentage", "flat"].includes(commissionType)) {
      return NextResponse.json(
        { success: false, error: "Commission type must be 'percentage' or 'flat'" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name,
        role,
        commissionType: role === "closer" ? (commissionType || "percentage") : "percentage",
        commissionValue: role === "closer" ? (commissionValue !== undefined ? Number(commissionValue) : 0) : 0,
      },
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

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 500 }
    );
  }
}
