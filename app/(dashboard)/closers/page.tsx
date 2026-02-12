"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, getInitials } from "@/lib/utils";
import { Plus, Edit2, Trash2, Trophy, TrendingUp, DollarSign, Users } from "lucide-react";
import toast from "react-hot-toast";

interface Closer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  commissionType: string;
  commissionValue: number;
  isActive: boolean;
  createdAt: string;
  _count: { paymentLinks: number; payments: number };
}

interface CloserWithStats extends Closer {
  totalRevenue?: number;
  totalCommission?: number;
}

export default function ClosersPage() {
  const [closers, setClosers] = useState<CloserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCloser, setEditingCloser] = useState<CloserWithStats | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCommissionType, setFormCommissionType] = useState("percentage");
  const [formCommissionValue, setFormCommissionValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchClosers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/closers");
      const data = await res.json();
      if (data.success) {
        // Fetch stats for each closer
        const closersWithStats = await Promise.all(
          data.data.map(async (closer: Closer) => {
            try {
              const statsRes = await fetch(`/api/closers/${closer.id}`);
              const statsData = await statsRes.json();
              if (statsData.success) {
                return {
                  ...closer,
                  totalRevenue: statsData.data.totalRevenue,
                  totalCommission: statsData.data.totalCommission,
                };
              }
            } catch {
              // ignore
            }
            return closer;
          })
        );
        setClosers(closersWithStats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosers();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormCommissionType("percentage");
    setFormCommissionValue("");
    setEditingCloser(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (closer: CloserWithStats) => {
    setEditingCloser(closer);
    setFormName(closer.name);
    setFormEmail(closer.email);
    setFormPhone(closer.phone || "");
    setFormCommissionType(closer.commissionType);
    setFormCommissionValue(String(closer.commissionValue));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName || !formEmail) {
      toast.error("Name and email are required");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: formName,
        email: formEmail,
        phone: formPhone || null,
        commissionType: formCommissionType,
        commissionValue: formCommissionValue,
      };

      let res;
      if (editingCloser) {
        res = await fetch(`/api/closers/${editingCloser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/closers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (data.success) {
        toast.success(editingCloser ? "Closer updated" : "Closer added");
        setModalOpen(false);
        resetForm();
        fetchClosers();
      } else {
        toast.error(data.error || "Failed to save closer");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this closer?")) return;
    try {
      const res = await fetch(`/api/closers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Closer deactivated");
        fetchClosers();
      }
    } catch {
      toast.error("Failed to deactivate closer");
    }
  };

  const totalTeamRevenue = closers.reduce(
    (sum, c) => sum + (c.totalRevenue || 0),
    0
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyber-purple/10 rounded-lg">
            <Users className="w-5 h-5 text-cyber-purple" />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-orbitron)] text-base font-semibold text-white">
              Sales Team
            </h2>
            <p className="text-xs text-cyber-muted">
              {closers.filter((c) => c.isActive).length} active closers
            </p>
          </div>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Closer
        </Button>
      </div>

      {/* Leaderboard */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      ) : closers.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="w-12 h-12 text-cyber-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No closers yet</h3>
          <p className="text-cyber-muted text-sm mb-4">
            Add your first sales team member to get started.
          </p>
          <Button onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-2" /> Add Your First Closer
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {closers
            .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
            .map((closer, index) => {
              const revenueShare =
                totalTeamRevenue > 0
                  ? ((closer.totalRevenue || 0) / totalTeamRevenue) * 100
                  : 0;

              return (
                <Card
                  key={closer.id}
                  className={`relative ${
                    !closer.isActive ? "opacity-60" : ""
                  } ${index === 0 && closer.isActive ? "border-cyber-yellow/30" : ""}`}
                >
                  {/* Rank badge */}
                  {index < 3 && closer.isActive && (
                    <div className="absolute -top-2 -right-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0
                            ? "bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/30"
                            : index === 1
                            ? "bg-gray-400/20 text-gray-400 border border-gray-400/30"
                            : "bg-amber-700/20 text-amber-600 border border-amber-700/30"
                        }`}
                      >
                        {index === 0 ? (
                          <Trophy className="w-4 h-4" />
                        ) : (
                          `#${index + 1}`
                        )}
                      </div>
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-cyber-purple/20 border border-cyber-purple/30 flex items-center justify-center">
                      <span className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-cyber-purple">
                        {getInitials(closer.name)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">
                          {closer.name}
                        </h3>
                        {!closer.isActive && (
                          <Badge variant="gray">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-cyber-muted">{closer.email}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(closer)}
                        className="p-1.5 rounded text-cyber-muted hover:text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {closer.isActive && (
                        <button
                          onClick={() => handleDeactivate(closer.id)}
                          className="p-1.5 rounded text-cyber-muted hover:text-cyber-red hover:bg-cyber-red/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <p className="text-xs text-cyber-muted mb-1">Revenue</p>
                      <p className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-white">
                        {formatCurrency(closer.totalRevenue || 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-cyber-muted mb-1">Sales</p>
                      <p className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-white">
                        {closer._count.payments}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-cyber-muted mb-1">Commission</p>
                      <p className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-cyber-green">
                        {formatCurrency(closer.totalCommission || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Revenue share bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-cyber-muted">Revenue Share</span>
                      <span className="font-[family-name:var(--font-jetbrains)] text-cyber-cyan">
                        {revenueShare.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-cyber-black rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-purple rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(revenueShare, 2)}%` }}
                      />
                    </div>
                  </div>

                  {/* Commission info */}
                  <div className="mt-3 flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-cyber-muted" />
                    <span className="text-xs text-cyber-muted">
                      {closer.commissionType === "percentage"
                        ? `${closer.commissionValue}% per sale`
                        : `$${closer.commissionValue} flat per sale`}
                    </span>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
        title={editingCloser ? "Edit Closer" : "Add New Closer"}
        description={
          editingCloser
            ? "Update this closer's information."
            : "Add a new sales team member."
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="John Smith"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="john@example.com"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
          />
          <Input
            label="Phone (optional)"
            type="tel"
            placeholder="+1 555 123 4567"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Commission Type"
              options={[
                { value: "percentage", label: "Percentage (%)" },
                { value: "flat", label: "Flat Amount ($)" },
              ]}
              value={formCommissionType}
              onChange={(e) => setFormCommissionType(e.target.value)}
            />
            <Input
              label="Commission Value"
              type="number"
              placeholder={formCommissionType === "percentage" ? "10" : "50"}
              prefix={formCommissionType === "percentage" ? "%" : "$"}
              value={formCommissionValue}
              onChange={(e) => setFormCommissionValue(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editingCloser ? "Update Closer" : "Add Closer"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
