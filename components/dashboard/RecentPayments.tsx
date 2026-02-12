"use client";

import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useEffect, useState } from "react";

interface RecentPayment {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  amount: number;
  status: string;
  paidAt: string | null;
  installmentNumber: number | null;
  closer: { name: string };
  paymentLink: {
    productName: string;
    planType: string;
    splitPayments: number | null;
  } | null;
}

interface RecentPaymentsProps {
  from: string;
  to: string;
}

export function RecentPayments({ from, to }: RecentPaymentsProps) {
  const [payments, setPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "10", from, to });
    fetch(`/api/payments?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPayments(data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <Card className="col-span-full">
      <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white mb-4">
        Recent Payments
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cyber-border">
              <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                Date
              </th>
              <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                Customer
              </th>
              <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                Closer
              </th>
              <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                Product
              </th>
              <th className="text-right py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                Amount
              </th>
              <th className="text-center py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={6} />
              ))
            ) : payments.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-8 text-cyber-muted"
                >
                  No payments yet. Generate payment links and start closing deals!
                </td>
              </tr>
            ) : (
              payments.map((payment, i) => (
                <tr
                  key={payment.id}
                  className={`border-b border-cyber-border/50 hover:bg-cyber-cyan/5 transition-colors ${
                    i % 2 === 0 ? "bg-cyber-dark" : "bg-cyber-black"
                  }`}
                >
                  <td className="py-3 px-4 text-cyber-muted font-[family-name:var(--font-jetbrains)] text-xs">
                    {payment.paidAt
                      ? formatDateTime(payment.paidAt)
                      : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-white text-sm">
                        {payment.customerName || "Unknown"}
                      </p>
                      <p className="text-cyber-muted text-xs">
                        {payment.customerEmail || "—"}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{payment.closer.name}</td>
                  <td className="py-3 px-4 text-sm text-cyber-muted">
                    {payment.paymentLink?.productName || "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm text-white">
                    {formatCurrency(payment.amount)}
                    {payment.installmentNumber &&
                      payment.paymentLink?.splitPayments && (
                        <span className="text-xs text-cyber-muted ml-1">
                          ({payment.installmentNumber}/
                          {payment.paymentLink.splitPayments})
                        </span>
                      )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadge status={payment.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
