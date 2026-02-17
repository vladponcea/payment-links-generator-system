"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  Webhook,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Package,
  Save,
  UserPlus,
  Users,
  Trash2,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDateTime } from "@/lib/utils";

interface WebhookStatus {
  isRegistered: boolean;
  webhookId: string | null;
  webhookUrl: string | null;
  registeredAt: string | null;
  recentEvents: Array<{
    id: string;
    whopMessageId: string;
    eventType: string;
    processedAt: string | null;
    error: string | null;
    createdAt: string;
  }>;
}

interface WhopProduct {
  id: string;
  title: string;
  description?: string;
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  commissionType: string;
  commissionValue: number;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  // Product selection state
  const [allProducts, setAllProducts] = useState<WhopProduct[]>([]);
  const [enabledProductIds, setEnabledProductIds] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [savingProducts, setSavingProducts] = useState(false);
  const [productsDirty, setProductsDirty] = useState(false);

  // Zapier webhook state
  const [zapierWebhookUrl, setZapierWebhookUrl] = useState("");
  const [loadingZapier, setLoadingZapier] = useState(true);
  const [savingZapier, setSavingZapier] = useState(false);
  const [zapierDirty, setZapierDirty] = useState(false);

  // User management state
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "closer",
    commissionType: "percentage",
    commissionValue: "",
  });

  const fetchStatus = () => {
    setLoading(true);
    fetch("/api/webhooks/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setWebhookStatus(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const [productsRes, settingsRes] = await Promise.all([
        fetch("/api/products?all=true"),
        fetch("/api/settings/products"),
      ]);
      const productsData = await productsRes.json();
      const settingsData = await settingsRes.json();

      if (productsData.success) setAllProducts(productsData.data);
      if (settingsData.success) setEnabledProductIds(settingsData.data.enabledProductIds);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchZapier = async () => {
    setLoadingZapier(true);
    try {
      const res = await fetch("/api/settings/zapier");
      const data = await res.json();
      if (data.success) setZapierWebhookUrl(data.data.zapierWebhookUrl ?? "");
    } catch (error) {
      console.error("Failed to fetch Zapier settings:", error);
    } finally {
      setLoadingZapier(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchProducts();
    fetchUsers();
    fetchZapier();
  }, []);

  const handleSaveZapier = async () => {
    setSavingZapier(true);
    try {
      const res = await fetch("/api/settings/zapier", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zapierWebhookUrl: zapierWebhookUrl || null }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Zapier webhook URL saved!");
        setZapierDirty(false);
      } else {
        toast.error(data.error || "Failed to save Zapier webhook URL");
      }
    } catch {
      toast.error("Failed to save Zapier webhook URL");
    } finally {
      setSavingZapier(false);
    }
  };

  const handleRegisterWebhook = async () => {
    setRegistering(true);
    try {
      const res = await fetch("/api/webhooks/register", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Webhook registered successfully!");
        fetchStatus();
      } else {
        toast.error(data.error || "Failed to register webhook");
      }
    } catch {
      toast.error("Failed to register webhook");
    } finally {
      setRegistering(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setEnabledProductIds((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      return next;
    });
    setProductsDirty(true);
  };

  const toggleAllProducts = () => {
    if (enabledProductIds.length === allProducts.length) {
      setEnabledProductIds([]);
    } else {
      setEnabledProductIds(allProducts.map((p) => p.id));
    }
    setProductsDirty(true);
  };

  const handleSaveProducts = async () => {
    setSavingProducts(true);
    try {
      const res = await fetch("/api/settings/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledProductIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Product selection saved!");
        setProductsDirty(false);
      } else {
        toast.error(data.error || "Failed to save product selection");
      }
    } catch {
      toast.error("Failed to save product selection");
    } finally {
      setSavingProducts(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.role) {
      toast.error("Please fill in all fields");
      return;
    }

    setAddingUser(true);
    try {
      const payload: Record<string, unknown> = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
      };

      if (newUser.role === "closer") {
        payload.commissionType = newUser.commissionType;
        payload.commissionValue = parseFloat(newUser.commissionValue) || 0;
      }

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("User created!");
        setShowAddUser(false);
        setNewUser({
          name: "",
          email: "",
          password: "",
          role: "closer",
          commissionType: "percentage",
          commissionValue: "",
        });
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to create user");
      }
    } catch {
      toast.error("Failed to create user");
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeactivateUser = async (userId: string, userName: string) => {
    if (!confirm(`Deactivate user "${userName}"? They will no longer be able to log in.`)) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("User deactivated");
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to deactivate user");
      }
    } catch {
      toast.error("Failed to deactivate user");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* User Management */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyber-cyan/10 rounded-lg">
              <Users className="w-5 h-5 text-cyber-cyan" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
                User Accounts
              </h3>
              <p className="text-xs text-cyber-muted">
                Manage who can access the dashboard
              </p>
            </div>
          </div>
          <Button onClick={() => setShowAddUser(true)} size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {loadingUsers ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-shimmer rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  user.isActive
                    ? "border-cyber-border bg-cyber-black"
                    : "border-cyber-border/50 bg-cyber-black/50 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-cyber-cyan/20 flex items-center justify-center text-sm font-bold text-cyber-cyan flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{user.name}</p>
                      <Badge variant={user.role === "admin" ? "purple" : "cyan"}>
                        {user.role}
                      </Badge>
                      {!user.isActive && <Badge variant="red">Inactive</Badge>}
                      {user.role === "closer" && (
                        <Badge variant="green">
                          {user.commissionType === "percentage"
                            ? `${user.commissionValue}%`
                            : `$${user.commissionValue}`}{" "}
                          commission
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-cyber-muted truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                {user.isActive && (
                  <button
                    onClick={() => handleDeactivateUser(user.id, user.name)}
                    className="p-2 rounded text-cyber-muted hover:text-cyber-red hover:bg-cyber-red/10 transition-colors flex-shrink-0"
                    title="Deactivate user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-8 text-cyber-muted text-sm">
                No users found.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Add User Modal */}
      <Modal
        open={showAddUser}
        onOpenChange={setShowAddUser}
        title="Add User"
        description="Create a new user account"
        className="max-w-md"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="john@example.com"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min 6 characters"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
          />
          <Select
            label="Role"
            options={[
              { value: "admin", label: "Admin — Full access" },
              { value: "closer", label: "Closer — Limited access" },
            ]}
            value={newUser.role}
            onChange={(e) =>
              setNewUser({ ...newUser, role: e.target.value })
            }
          />
          {newUser.role === "closer" && (
            <div className="space-y-4 p-4 bg-cyber-black rounded-lg border border-cyber-border">
              <p className="text-xs text-cyber-muted uppercase tracking-wider font-medium">
                Commission Settings
              </p>
              <Select
                label="Commission Type"
                options={[
                  { value: "percentage", label: "Percentage (%)" },
                  { value: "flat", label: "Flat ($)" },
                ]}
                value={newUser.commissionType}
                onChange={(e) =>
                  setNewUser({ ...newUser, commissionType: e.target.value })
                }
              />
              <Input
                label={
                  newUser.commissionType === "percentage"
                    ? "Commission (%)"
                    : "Commission ($)"
                }
                type="number"
                placeholder="0"
                prefix={newUser.commissionType === "flat" ? "$" : undefined}
                value={newUser.commissionValue}
                onChange={(e) =>
                  setNewUser({ ...newUser, commissionValue: e.target.value })
                }
                min="0"
                step={newUser.commissionType === "percentage" ? "1" : "0.01"}
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowAddUser(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddUser} loading={addingUser}>
              <UserPlus className="w-4 h-4 mr-2" />
              Create User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Whop Integration */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-cyber-cyan/10 rounded-lg">
            <Shield className="w-5 h-5 text-cyber-cyan" />
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
              Whop Integration
            </h3>
            <p className="text-xs text-cyber-muted">API connection and configuration</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-cyber-black rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-sm text-cyber-muted">API Key Status</span>
            </div>
            <Badge variant="cyan">
              <CheckCircle className="w-3 h-3 mr-1" />
              Configured via env
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-cyber-black rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-sm text-cyber-muted">Company ID</span>
            </div>
            <span className="font-[family-name:var(--font-jetbrains)] text-xs text-cyber-text">
              Set in environment variables
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-cyber-black rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-sm text-cyber-muted">App URL</span>
            </div>
            <span className="font-[family-name:var(--font-jetbrains)] text-xs text-cyber-cyan">
              {process.env.NEXT_PUBLIC_APP_URL || "Not configured"}
            </span>
          </div>
        </div>
      </Card>

      {/* Product Selection */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyber-green/10 rounded-lg">
              <Package className="w-5 h-5 text-cyber-green" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
                Enabled Products
              </h3>
              <p className="text-xs text-cyber-muted">
                Select which Whop products are available for link generation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loadingProducts && allProducts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleAllProducts}>
                {enabledProductIds.length === allProducts.length ? "Deselect All" : "Select All"}
              </Button>
            )}
            <Button
              onClick={handleSaveProducts}
              loading={savingProducts}
              disabled={!productsDirty}
              size="sm"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save
            </Button>
          </div>
        </div>

        {loadingProducts ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-shimmer rounded-lg" />
            ))}
          </div>
        ) : allProducts.length === 0 ? (
          <div className="text-center py-8 text-cyber-muted text-sm">
            No products found on Whop. Make sure your API key and Company ID are configured.
          </div>
        ) : (
          <div className="space-y-2">
            {enabledProductIds.length === 0 && (
              <div className="flex items-center gap-2 text-cyber-yellow text-xs p-3 bg-cyber-yellow/5 border border-cyber-yellow/20 rounded-lg mb-3">
                <span>
                  No products selected — all products will be shown on the Generate page by default.
                </span>
              </div>
            )}
            {allProducts.map((product) => {
              const isEnabled = enabledProductIds.includes(product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left ${
                    isEnabled
                      ? "border-cyber-green/40 bg-cyber-green/5"
                      : "border-cyber-border bg-cyber-black hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isEnabled
                          ? "border-cyber-green bg-cyber-green/20"
                          : "border-cyber-border"
                      }`}
                    >
                      {isEnabled && <CheckCircle className="w-3.5 h-3.5 text-cyber-green" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isEnabled ? "text-white" : "text-cyber-muted"}`}>
                        {product.title}
                      </p>
                      {product.description && (
                        <p className="text-xs text-cyber-muted truncate mt-0.5">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-cyber-muted flex-shrink-0 ml-3">
                    {product.id}
                  </span>
                </button>
              );
            })}
            {enabledProductIds.length > 0 && (
              <div className="pt-2 text-xs text-cyber-muted text-right">
                {enabledProductIds.length} of {allProducts.length} product{allProducts.length !== 1 ? "s" : ""} enabled
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Zapier (outbound webhook) */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyber-yellow/10 rounded-lg">
              <Zap className="w-5 h-5 text-cyber-yellow" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
                Zapier Webhook
              </h3>
              <p className="text-xs text-cyber-muted">
                When a payment succeeds, CloserPay will POST to this URL with client, package, amount, and closer details
              </p>
            </div>
          </div>
          <Button
            onClick={handleSaveZapier}
            loading={savingZapier}
            disabled={!zapierDirty}
            size="sm"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save
          </Button>
        </div>

        {loadingZapier ? (
          <div className="h-12 animate-shimmer rounded-lg" />
        ) : (
          <div className="space-y-2">
            <Input
              label="Webhook URL"
              type="url"
              placeholder="https://hooks.zapier.com/..."
              value={zapierWebhookUrl}
              onChange={(e) => {
                setZapierWebhookUrl(e.target.value);
                setZapierDirty(true);
              }}
            />
            <p className="text-xs text-cyber-muted">
              Paste your Zapier &quot;Catch Hook&quot; URL. Leave empty to disable.
            </p>
          </div>
        )}
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyber-purple/10 rounded-lg">
              <Webhook className="w-5 h-5 text-cyber-purple" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
                Webhook Configuration
              </h3>
              <p className="text-xs text-cyber-muted">
                Receive payment events from Whop
              </p>
            </div>
          </div>
          <Button
            onClick={handleRegisterWebhook}
            loading={registering}
            variant={webhookStatus?.isRegistered ? "secondary" : "primary"}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {webhookStatus?.isRegistered ? "Re-register" : "Register Webhook"}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-shimmer rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-cyber-black rounded-lg">
              <span className="text-sm text-cyber-muted">Status</span>
              {webhookStatus?.isRegistered ? (
                <Badge variant="green">
                  <CheckCircle className="w-3 h-3 mr-1" /> Registered
                </Badge>
              ) : (
                <Badge variant="red">
                  <XCircle className="w-3 h-3 mr-1" /> Not Registered
                </Badge>
              )}
            </div>

            {webhookStatus?.webhookUrl && (
              <div className="flex items-center justify-between p-4 bg-cyber-black rounded-lg">
                <span className="text-sm text-cyber-muted">Webhook URL</span>
                <span className="font-[family-name:var(--font-jetbrains)] text-xs text-cyber-cyan">
                  {webhookStatus.webhookUrl}
                </span>
              </div>
            )}

            {webhookStatus?.webhookId && (
              <div className="flex items-center justify-between p-4 bg-cyber-black rounded-lg">
                <span className="text-sm text-cyber-muted">Webhook ID</span>
                <span className="font-[family-name:var(--font-jetbrains)] text-xs text-cyber-text">
                  {webhookStatus.webhookId}
                </span>
              </div>
            )}

            {webhookStatus?.registeredAt && (
              <div className="flex items-center justify-between p-4 bg-cyber-black rounded-lg">
                <span className="text-sm text-cyber-muted">Registered At</span>
                <span className="font-[family-name:var(--font-jetbrains)] text-xs text-cyber-text">
                  {formatDateTime(webhookStatus.registeredAt)}
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Webhook Event Log */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyber-yellow/10 rounded-lg">
              <Clock className="w-5 h-5 text-cyber-yellow" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
                Webhook Event Log
              </h3>
              <p className="text-xs text-cyber-muted">Recent webhook events for debugging</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchStatus}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>

        {webhookStatus?.recentEvents && webhookStatus.recentEvents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyber-border">
                  <th className="text-left py-2 px-3 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                    Time
                  </th>
                  <th className="text-left py-2 px-3 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                    Event Type
                  </th>
                  <th className="text-left py-2 px-3 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                    Message ID
                  </th>
                  <th className="text-center py-2 px-3 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                    Status
                  </th>
                  <th className="text-left py-2 px-3 text-xs text-cyber-muted uppercase tracking-wider font-medium">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {webhookStatus.recentEvents.map((event, i) => (
                  <tr
                    key={event.id}
                    className={`border-b border-cyber-border/50 ${
                      i % 2 === 0 ? "bg-cyber-dark" : "bg-cyber-black"
                    }`}
                  >
                    <td className="py-2 px-3 text-xs text-cyber-muted font-[family-name:var(--font-jetbrains)]">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        variant={
                          event.eventType.includes("succeeded")
                            ? "green"
                            : event.eventType.includes("failed")
                            ? "red"
                            : "cyan"
                        }
                      >
                        {event.eventType}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 font-[family-name:var(--font-jetbrains)] text-xs text-cyber-muted">
                      {event.whopMessageId.slice(0, 20)}...
                    </td>
                    <td className="py-2 px-3 text-center">
                      {event.processedAt ? (
                        <Badge variant="green">Processed</Badge>
                      ) : event.error ? (
                        <Badge variant="red">Error</Badge>
                      ) : (
                        <Badge variant="yellow">Pending</Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs text-cyber-red max-w-[200px] truncate">
                      {event.error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-cyber-muted text-sm">
            No webhook events received yet.
          </div>
        )}
      </Card>
    </div>
  );
}
