"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate, truncate, getPlanTypeLabel, getBillingIntervalLabel } from "@/lib/utils";
import { SplitTimeline } from "@/components/generate/SplitTimeline";
import { Copy, Check, ExternalLink, Search, Trash2, Eye } from "lucide-react";
import toast from "react-hot-toast";

interface PaymentLink {
  id: string;
  closerId: string;
  productName: string;
  purchaseUrl: string;
  planType: string;
  totalAmount: number;
  initialPrice: number;
  renewalPrice: number | null;
  billingPeriodDays: number | null;
  splitPayments: number | null;
  customSplitDescription: string | null;
  status: string;
  title: string | null;
  createdAt: string;
  closer: { id: string; name: string; email: string };
  _count: { payments: number };
}

interface Closer {
  id: string;
  name: string;
}

export default function PaymentLinksPage() {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [closerFilter, setCloserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [linkDetails, setLinkDetails] = useState<Record<string, unknown> | null>(null);

  const fetchLinks = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (closerFilter) params.set("closerId", closerFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("planType", typeFilter);

    setLoading(true);
    fetch(`/api/payment-links?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setLinks(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLinks();
    fetch("/api/closers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setClosers(d.data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closerFilter, statusFilter, typeFilter]);

  const handleSearch = () => fetchLinks();

  const handleCopy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success("Link copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Archive this payment link?")) return;
    try {
      const res = await fetch(`/api/payment-links/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Link archived");
        fetchLinks();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Failed to archive link");
    }
  };

  const handleViewDetails = async (link: PaymentLink) => {
    setSelectedLink(link);
    setDetailModalOpen(true);
    try {
      const res = await fetch(`/api/payment-links/${link.id}`);
      const data = await res.json();
      if (data.success) setLinkDetails(data.data);
    } catch {
      console.error("Failed to load details");
    }
  };

  const getPlanTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "one_time": return "cyan" as const;
      case "renewal": return "purple" as const;
      case "split_pay": return "green" as const;
      case "custom_split": return "yellow" as const;
      default: return "gray" as const;
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
                placeholder="Search by product or closer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
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
              { value: "active", label: "Active" },
              { value: "expired", label: "Expired" },
              { value: "completed", label: "Completed" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Select
            options={[
              { value: "", label: "All Types" },
              { value: "one_time", label: "One-Time" },
              { value: "renewal", label: "Recurring" },
              { value: "split_pay", label: "Split Pay" },
              { value: "custom_split", label: "Custom Split" },
            ]}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
          <Button onClick={handleSearch} variant="secondary" size="md">
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
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Created</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Closer</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Product</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Type</th>
                <th className="text-right py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Amount</th>
                <th className="text-center py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Payments</th>
                <th className="text-center py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Status</th>
                <th className="text-left py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Link</th>
                <th className="text-center py-3 px-4 text-xs text-cyber-muted uppercase tracking-wider font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={9} />
                ))
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-cyber-muted">
                    No payment links found. Generate your first link!
                  </td>
                </tr>
              ) : (
                links.map((link, i) => (
                  <tr
                    key={link.id}
                    className={`border-b border-cyber-border/50 hover:bg-cyber-cyan/5 transition-colors ${
                      i % 2 === 0 ? "bg-cyber-dark" : "bg-cyber-black"
                    }`}
                  >
                    <td className="py-3 px-4 text-xs text-cyber-muted font-[family-name:var(--font-jetbrains)]">
                      {formatDate(link.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-sm">{link.closer.name}</td>
                    <td className="py-3 px-4 text-sm text-cyber-text">{link.productName}</td>
                    <td className="py-3 px-4">
                      <Badge variant={getPlanTypeBadgeVariant(link.planType)}>
                        {getPlanTypeLabel(link.planType)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-[family-name:var(--font-jetbrains)] text-sm">
                      {formatCurrency(link.totalAmount)}
                      {link.billingPeriodDays && link.planType === "renewal" && (
                        <span className="text-xs text-cyber-muted block">
                          /{getBillingIntervalLabel(link.billingPeriodDays).toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-[family-name:var(--font-jetbrains)]">
                      {link.splitPayments
                        ? `${link._count.payments}/${link.splitPayments}`
                        : link._count.payments || "0"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={link.status} />
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-cyber-muted font-[family-name:var(--font-jetbrains)]">
                        {truncate(link.purchaseUrl, 30)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleCopy(link.purchaseUrl, link.id)}
                          className="p-1.5 rounded text-cyber-muted hover:text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors"
                          title="Copy link"
                        >
                          {copiedId === link.id ? (
                            <Check className="w-3.5 h-3.5 text-cyber-green" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={link.purchaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded text-cyber-muted hover:text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors"
                          title="Open link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleViewDetails(link)}
                          className="p-1.5 rounded text-cyber-muted hover:text-cyber-purple hover:bg-cyber-purple/10 transition-colors"
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(link.id)}
                          className="p-1.5 rounded text-cyber-muted hover:text-cyber-red hover:bg-cyber-red/10 transition-colors"
                          title="Archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Modal */}
      <Modal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        title="Payment Link Details"
        className="max-w-2xl"
      >
        {selectedLink && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-cyber-muted text-xs mb-1">Closer</p>
                <p className="text-white">{selectedLink.closer.name}</p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Product</p>
                <p className="text-white">{selectedLink.productName}</p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Type</p>
                <Badge variant={getPlanTypeBadgeVariant(selectedLink.planType)}>
                  {getPlanTypeLabel(selectedLink.planType)}
                </Badge>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Status</p>
                <StatusBadge status={selectedLink.status} />
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Total Amount</p>
                <p className="font-[family-name:var(--font-jetbrains)] text-white">
                  {formatCurrency(selectedLink.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-cyber-muted text-xs mb-1">Created</p>
                <p className="text-white">{formatDate(selectedLink.createdAt)}</p>
              </div>
            </div>

            {selectedLink.splitPayments && selectedLink.splitPayments >= 2 && selectedLink.billingPeriodDays && (
              <SplitTimeline
                initialPrice={selectedLink.planType === "custom_split" ? selectedLink.initialPrice : (selectedLink.renewalPrice ?? selectedLink.totalAmount / selectedLink.splitPayments)}
                installmentPrice={selectedLink.renewalPrice ?? selectedLink.totalAmount / selectedLink.splitPayments}
                numberOfPayments={selectedLink.splitPayments}
                billingPeriodDays={selectedLink.billingPeriodDays}
              />
            )}

            <div>
              <p className="text-cyber-muted text-xs mb-1">Purchase URL</p>
              <div className="bg-cyber-black rounded-lg p-3 flex items-center justify-between gap-2">
                <p className="font-[family-name:var(--font-jetbrains)] text-xs text-cyber-cyan break-all">
                  {selectedLink.purchaseUrl}
                </p>
                <button
                  onClick={() => handleCopy(selectedLink.purchaseUrl, selectedLink.id)}
                  className="flex-shrink-0 p-1.5 rounded text-cyber-muted hover:text-cyber-cyan"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Payments against this link */}
            {linkDetails && (linkDetails as { payments?: Array<{ id: string; amount: number; status: string; paidAt: string; installmentNumber: number | null }> }).payments && (
              <div>
                <p className="text-cyber-muted text-xs mb-2 uppercase tracking-wider">Payments Received</p>
                <div className="space-y-2">
                  {((linkDetails as { payments: Array<{ id: string; amount: number; status: string; paidAt: string; installmentNumber: number | null; customerEmail?: string }> }).payments).map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm bg-cyber-black rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={p.status} />
                        <span className="text-cyber-muted text-xs">
                          {p.installmentNumber && `#${p.installmentNumber}`}
                        </span>
                      </div>
                      <span className="font-[family-name:var(--font-jetbrains)] text-white">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
