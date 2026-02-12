"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/Badge";
import {
  Webhook,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
  Globe,
  Clock,
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

export default function SettingsPage() {
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

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

  useEffect(() => {
    fetchStatus();
  }, []);

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


  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
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
