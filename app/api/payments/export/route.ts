import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Sanitize CSV cell values to prevent formula injection
function sanitizeCell(value: string): string {
  const dangerous = ["=", "+", "-", "@", "\t", "\r"];
  if (dangerous.some((char) => value.startsWith(char))) {
    return `'${value}`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const closerId = searchParams.get("closerId");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (closerId) where.closerId = closerId;
    if (status) where.status = status;
    if (from || to) {
      where.paidAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) where.paidAt.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) where.paidAt.lte = toDate;
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        closer: { select: { name: true, email: true } },
        paymentLink: { select: { productName: true, planType: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 10000, // Cap export to 10k records
    });

    // Build CSV
    const headers = [
      "Payment ID",
      "Date",
      "Customer Name",
      "Customer Email",
      "Closer",
      "Product",
      "Type",
      "Amount",
      "Commission",
      "Status",
      "Installment",
    ];

    const rows = payments.map((p) => [
      p.whopPaymentId,
      p.paidAt ? new Date(p.paidAt).toISOString() : "",
      p.customerName || "",
      p.customerEmail || "",
      p.closer.name,
      p.paymentLink?.productName || p.productName || "",
      p.paymentLink?.planType || "",
      p.amount.toFixed(2),
      (p.commissionAmount || 0).toFixed(2),
      p.status,
      p.installmentNumber ? `${p.installmentNumber}` : "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const safe = sanitizeCell(String(cell));
            return `"${safe.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="careergrowth-payments-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to export payments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export payments" },
      { status: 500 }
    );
  }
}
