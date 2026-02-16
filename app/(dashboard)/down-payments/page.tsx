"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDateTime, displayProductName } from "@/lib/utils";
import { Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { useUser } from "@/lib/user-context";

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
    downPaymentStatus: string | null;
  } | null;
}

interface Closer {
  id: string;
  name: string;
}

type AgeCategory = "red" | "orange" | "normal";

function getAgeCategory(paidAt: string | null, dpStatus: string | null): AgeCategory {
  if (dpStatus === "fully_paid" || dpStatus === "cancelled") return "normal";
  if (!paidAt) return "normal";
  const daysSince = Math.floor((Date.now() - new Date(paidAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince >= 30) return "red";
  if (daysSince >= 14) return "orange";
  return "normal";
}

function getAgeSortPriority(category: AgeCategory): number {
  switch (category) {
    case "red": return 0;
    case "orange": return 1;
    case "normal": return 2;
  }
}

function getRowClassName(category: AgeCategory, index: number): string {
  switch (category) {
    case "red":
      return "border-b border-cyber-red/30 bg-cyber-red/10 hover:bg-cyber-red/15 transition-colors cursor-pointer";
    case "orange":
      return "border-b border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/15 transition-colors cursor-pointer";
    default:
      return `border-b border-cyber-border/50 hover:bg-cyber-cyan/5 transition-colors cursor-pointer ${
        index % 2 === 0 ? "bg-cyber-dark" : "bg-cyber-black"
      }`;
  }
}

function getDpStatusLabel(status: string | null): string {
  switch (status) {
    case "fully_paid": return "Fully Paid";
    case "cancelled": return "Cancelled";
    default: return "Pending";
  }
}

export default function DownPaymentsPage() {
  const currentUser = useUser();
  const isAdmin = currentUser?.role === "admin";

  const [payments, setPayments] = useState<DownPayment[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [closerFilter, setCloserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<DownPayment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchDownPayments = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (closerFilter) params.set("closerId", closerFilter);
    if (statusFilter) params.set("dpStatus", statusFilter);

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
    if (isAdmin) {
      fetch("/api/closers")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setClosers(d.data);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closerFilter, statusFilter]);

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => {
      const catA = getAgeCategory(a.paidAt, a.paymentLink?.downPaymentStatus ?? null);
      const catB = getAgeCategory(b.paidAt, b.paymentLink?.downPaymentStatus ?? null);
      const priorityDiff = getAgeSortPriority(catA) - getAgeSortPriority(catB);
      if (priorityDiff !== 0) return priorityDiff;
      const dateA = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const dateB = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return dateA - dateB;
    });
  }, [payments]);

  const getPackageTotal = (payment: DownPayment) =>
    payment.paymentLink?.totalAmount ?? 0;

  const getRemaining = (payment: DownPayment) => {
    const pkg = getPackageTotal(payment);
    return pkg > 0 ? pkg - payment.amount : 0;
  };

  const handleStatusChange = async (paymentLinkId: string, newStatus: string) => {
    setUpdatingId(paymentLinkId);
    try {
      const res = await fetch("/api/down-payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentLinkId,
          downPaymentStatus: newStatus === "pending" ? null : newStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPayments((prev) =>
          prev.map((p) =>
            p.paymentLink?.id === paymentLinkId
              ? {
                  ...p,
                  paymentLink: {
                    ...p.paymentLink!,
                    downPaymentStatus: newStatus === "pending" ? null : newStatus,
                  },
                }
              : p
          )
        );
        toast.success(`Status updated to ${getDpStatusLabel(newStatus === "pending" ? null : newStatus)}`);
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
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
          {isAdmin && (
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
              { value: "pending", label: "Pending" },
              { value: "fully_paid", label: "Fully Paid" },
              { value: "cancelled", label: "Cancelled" },
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
              ) : sortedPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-cyber-muted">
                    No down payments found.
                  </td>
                </tr>
              ) : (
                sortedPayments.map((payment, i) => {
                  const ageCategory = getAgeCategory(payment.paidAt, payment.paymentLink?.downPaymentStatus ?? null);
                  const dpStatus = payment.paymentLink?.downPaymentStatus ?? "pending";

                  return (
                    <tr
                      key={payment.id}
                      className={getRowClassName(ageCategory, i)}
                    >
                      <td
                        className="py-3 px-4 text-xs text-cyber-muted font-[family-name:var(--font-jetbrains)]"
                        onClick={() => { setSelectedPayment(payment); setDetailOpen(true); }}
                      >
                        {payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
                      </td>
                      <td
                        className="py-3 px-4"
                        onClick={() => { setSelectedPayment(payment); setDetailOpen(true); }}
                      >
                        <div>
                          <p className="text-white text-sm">{payment.customerName || "Unknown"}</p>
                          <p className="text-cyber-muted text-xs">{payment.customerEmail || "—"}</p>
                        </div>
                      </td>
                      <td
                        className="py-3 px-4 text-sm"
                        onClick={() => { setSelectedPayment(payment); setDetailOpen(true); }}
                      >
                        {payment.closer.name}
                      </td>
                      <td
                        className="py-3 px-4 text-sm text-cyber-muted"
                        onClick={() => { setSelectedPayment(payment); setDetailOpen(true); }}
                      >
                        {displayProductName(payment.paymentLink?.productName || payment.productName)}
                      </td>
                      <td
                        className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm text-white"
                        onClick={() => { setSelectedPayment(payment); setDetailOpen(true); }}
                      >
                        {formatCurrency(payment.amount)}
                      </td>
                      <td
                        className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm text-cyber-muted"
                        onClick={() => { setSelectedPayment(payment); setDetailOpen(true); }}
                      >
                        {formatCurrency(getPackageTotal(payment))}
                      </td>
                      <td
                        className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm text-cyber-yellow"
                        onClick={() => { setSelectedPayment(payment); setDetailOpen(true); }}
                      >
                        {formatCurrency(getRemaining(payment))}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {isAdmin ? (
                          <select
                            value={dpStatus}
                            onChange={(e) => {
                              if (payment.paymentLink?.id) {
                                handleStatusChange(payment.paymentLink.id, e.target.value);
                              }
                            }}
                            disabled={updatingId === payment.paymentLink?.id}
                            className={`text-xs font-medium rounded-full px-3 py-1 border cursor-pointer focus:outline-none focus:ring-1 transition-all appearance-none text-center ${
                              dpStatus === "fully_paid"
                                ? "bg-cyber-green/15 text-cyber-green border-cyber-green/30 focus:ring-cyber-green/50"
                                : dpStatus === "cancelled"
                                ? "bg-cyber-red/15 text-cyber-red border-cyber-red/30 focus:ring-cyber-red/50"
                                : "bg-cyber-yellow/15 text-cyber-yellow border-cyber-yellow/30 focus:ring-cyber-yellow/50"
                            } ${updatingId === payment.paymentLink?.id ? "opacity-50" : ""}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="fully_paid">Fully Paid</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        ) : (
                          <span className={`inline-block text-xs font-medium rounded-full px-3 py-1 border ${
                            dpStatus === "fully_paid"
                              ? "bg-cyber-green/15 text-cyber-green border-cyber-green/30"
                              : dpStatus === "cancelled"
                              ? "bg-cyber-red/15 text-cyber-red border-cyber-red/30"
                              : "bg-cyber-yellow/15 text-cyber-yellow border-cyber-yellow/30"
                          }`}>
                            {getDpStatusLabel(dpStatus === "pending" ? null : dpStatus)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && sortedPayments.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-cyber-cyan/30 bg-cyber-dark">
                  <td colSpan={4} className="py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-semibold text-right">
                    Totals ({sortedPayments.length} {sortedPayments.length === 1 ? "payment" : "payments"})
                  </td>
                  <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold text-white">
                    {formatCurrency(sortedPayments.reduce((sum, p) => sum + p.amount, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold text-cyber-muted">
                    {formatCurrency(sortedPayments.reduce((sum, p) => sum + getPackageTotal(p), 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold text-cyber-yellow">
                    {formatCurrency(sortedPayments.reduce((sum, p) => sum + getRemaining(p), 0))}
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
                <p className="text-cyber-muted text-xs mb-1">Payment Status</p>
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
              <div className="col-span-2">
                <p className="text-cyber-muted text-xs mb-1">Deal Status</p>
                <span className={`inline-block text-xs font-medium rounded-full px-3 py-1 border ${
                  selectedPayment.paymentLink?.downPaymentStatus === "fully_paid"
                    ? "bg-cyber-green/15 text-cyber-green border-cyber-green/30"
                    : selectedPayment.paymentLink?.downPaymentStatus === "cancelled"
                    ? "bg-cyber-red/15 text-cyber-red border-cyber-red/30"
                    : "bg-cyber-yellow/15 text-cyber-yellow border-cyber-yellow/30"
                }`}>
                  {getDpStatusLabel(selectedPayment.paymentLink?.downPaymentStatus ?? null)}
                </span>
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
