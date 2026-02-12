"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDateTime, displayProductName } from "@/lib/utils";
import { Search, Download, X } from "lucide-react";
import toast from "react-hot-toast";
import { useUser } from "@/lib/user-context";

interface Payment {
  id: string;
  whopPaymentId: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  installmentNumber: number | null;
  isRecurring: boolean;
  commissionAmount: number | null;
  productName: string | null;
  whopWebhookData: unknown;
  closer: { id: string; name: string };
  paymentLink: {
    id: string;
    productName: string;
    planType: string;
    splitPayments: number | null;
  } | null;
}

interface Closer {
  id: string;
  name: string;
}

export default function PaymentsPage() {
  const currentUser = useUser();
  const isCloserRole = currentUser?.role === "closer";

  const [payments, setPayments] = useState<Payment[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [closerFilter, setCloserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchPayments = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    // Closer filter is only available for admins; API handles filtering for closer role
    if (closerFilter && !isCloserRole) params.set("closerId", closerFilter);
    if (statusFilter) params.set("status", statusFilter);

    setLoading(true);
    fetch(`/api/payments?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPayments(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPayments();
    if (!isCloserRole) {
      fetch("/api/closers")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setClosers(d.data);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closerFilter, statusFilter]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (closerFilter) params.set("closerId", closerFilter);
    if (statusFilter) params.set("status", statusFilter);
    window.open(`/api/payments/export?${params}`, "_blank");
    toast.success("CSV export started");
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
                onKeyDown={(e) => e.key === "Enter" && fetchPayments()}
              />
            </div>
          </div>
          {!isCloserRole && (
            <Select
              options={[
                { value: "", label: "All Closers" },
                ...closers.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={closerFilter}
              onChange={(e) => setCloserFilter(e.target.value)}
            />
          )}
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
          <Button onClick={fetchPayments} variant="secondary" size="md">
            Search
          </Button>
          <Button onClick={handleExport} variant="ghost" size="md">
            <Download className="w-4 h-4 mr-2" /> Export CSV
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
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Payment ID</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Customer</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Closer</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Product</th>
                <th className="text-right py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Amount</th>
                <th className="text-right py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Commission</th>
                <th className="text-center py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Status</th>
                <th className="text-center py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Installment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={9} />
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-cyber-muted">
                    No payments found.
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
                    <td className="py-3 px-4 font-[family-name:var(--font-jetbrains)] text-xs text-cyber-muted">
                      {payment.whopPaymentId.slice(0, 16)}...
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
                    <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm text-cyber-green">
                      {payment.commissionAmount
                        ? formatCurrency(payment.commissionAmount)
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-[family-name:var(--font-jetbrains)]">
                      {payment.installmentNumber && payment.paymentLink?.splitPayments
                        ? `${payment.installmentNumber}/${payment.paymentLink.splitPayments}`
                        : payment.installmentNumber || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Slide-out */}
      <Modal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Payment Details"
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
                <p className="text-cyber-muted text-xs mb-1">Amount</p>
                <p className="font-[family-name:var(--font-jetbrains)] text-lg text-white">
                  {formatCurrency(selectedPayment.amount)}
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
