"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDateTime, displayProductName } from "@/lib/utils";
import { Search, X } from "lucide-react";

interface DownPayment {
  id: string;
  whopPaymentId: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  commissionAmount: number | null;
  productName: string | null;
  closer: { id: string; name: string };
  paymentLink: {
    id: string;
    productName: string;
    totalAmount: number;
    initialPrice: number;
    planType: string;
  } | null;
}

interface Closer {
  id: string;
  name: string;
}

export default function DownPaymentsPage() {
  const [payments, setPayments] = useState<DownPayment[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [closerFilter, setCloserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<DownPayment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchDownPayments = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (closerFilter) params.set("closerId", closerFilter);
    if (statusFilter) params.set("status", statusFilter);

    setLoading(true);
    fetch(`/api/down-payments?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPayments(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDownPayments();
    fetch("/api/closers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setClosers(d.data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closerFilter, statusFilter]);

  const getPackageTotal = (payment: DownPayment) =>
    payment.paymentLink?.totalAmount ?? 0;

  const getRemaining = (payment: DownPayment) => {
    const pkg = getPackageTotal(payment);
    return pkg > 0 ? pkg - payment.amount : 0;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
              <input
                className="w-full bg-cyber-black border border-cyber-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-cyber-muted/60 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 focus:outline-none"
                placeholder="Search by customer or closer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchDownPayments()}
              />
            </div>
          </div>
          <Select
            options={[
              { value: "", label: "All Closers" },
              ...closers.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={closerFilter}
            onChange={(e) => setCloserFilter(e.target.value)}
          />
          <Select
            options={[
              { value: "", label: "All Statuses" },
              { value: "succeeded", label: "Succeeded" },
              { value: "failed", label: "Failed" },
              { value: "pending", label: "Pending" },
              { value: "refunded", label: "Refunded" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Button onClick={fetchDownPayments} variant="secondary" size="md">
            Search
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyber-border bg-cyber-dark">
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Date</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Customer</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Closer</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Product</th>
                <th className="text-right py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Down Payment</th>
                <th className="text-right py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Package Total</th>
                <th className="text-right py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Remaining</th>
                <th className="text-center py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={8} />
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-cyber-muted">
                    No down payments found.
                  </td>
                </tr>
              ) : (
                payments.map((payment, i) => (
                  <tr
                    key={payment.id}
                    onClick={() => {
                      setSelectedPayment(payment);
                      setDetailOpen(true);
                    }}
                    className={`border-b border-cyber-border/50 hover:bg-cyber-cyan/5 transition-colors cursor-pointer ${
                      i % 2 === 0 ? "bg-cyber-dark" : "bg-cyber-black"
                    }`}
                  >
                    <td className="py-3 px-4 text-xs text-cyber-muted font-[family-name:var(--font-jetbrains)]">
                      {payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-white text-sm">{payment.customerName || "Unknown"}</p>
                        <p className="text-cyber-muted text-xs">{payment.customerEmail || "—"}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{payment.closer.name}</td>
                    <td className="py-3 px-4 text-sm text-cyber-muted">
                      {displayProductName(payment.paymentLink?.productName || payment.productName)}
                    </td>
                    <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm text-white">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm text-cyber-muted">
                      {formatCurrency(getPackageTotal(payment))}
                    </td>
                    <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm text-cyber-yellow">
                      {formatCurrency(getRemaining(payment))}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={payment.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && payments.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-cyber-cyan/30 bg-cyber-dark">
                  <td colSpan={4} className="py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-semibold text-right">
                    Totals ({payments.length} {payments.length === 1 ? "payment" : "payments"})
                  </td>
                  <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold text-white">
                    {formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold text-cyber-muted">
                    {formatCurrency(payments.reduce((sum, p) => sum + getPackageTotal(p), 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold text-cyber-yellow">
                    {formatCurrency(payments.reduce((sum, p) => sum + getRemaining(p), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Down Payment Details"
        className="max-w-lg"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-cyber-muted text-xs mb-1">Payment ID</p>
                <p className="font-[family-name:var(--font-jetbrains)] text-xs text-white break-all">
                  {selectedPayment.whopPaymentId}
                </p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Status</p>
                <StatusBadge status={selectedPayment.status} />
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Customer</p>
                <p className="text-white">{selectedPayment.customerName || "Unknown"}</p>
                <p className="text-cyber-muted text-xs">{selectedPayment.customerEmail}</p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Closer</p>
                <p className="text-white">{selectedPayment.closer.name}</p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Down Payment</p>
                <p className="font-[family-name:var(--font-jetbrains)] text-lg text-white">
                  {formatCurrency(selectedPayment.amount)}
                </p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Package Total</p>
                <p className="font-[family-name:var(--font-jetbrains)] text-lg text-cyber-muted">
                  {formatCurrency(getPackageTotal(selectedPayment))}
                </p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Remaining Balance</p>
                <p className="font-[family-name:var(--font-jetbrains)] text-lg text-cyber-yellow">
                  {formatCurrency(getRemaining(selectedPayment))}
                </p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Commission</p>
                <p className="font-[family-name:var(--font-jetbrains)] text-lg text-cyber-green">
                  {selectedPayment.commissionAmount
                    ? formatCurrency(selectedPayment.commissionAmount)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Product</p>
                <p className="text-white">
                  {displayProductName(selectedPayment.paymentLink?.productName || selectedPayment.productName)}
                </p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Date</p>
                <p className="text-white">
                  {selectedPayment.paidAt
                    ? formatDateTime(selectedPayment.paidAt)
                    : "—"}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-cyber-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailOpen(false)}
              >
                <X className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
