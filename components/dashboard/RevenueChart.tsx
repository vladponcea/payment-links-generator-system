"use client";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RevenueDataPoint } from "@/lib/types";

interface RevenueChartProps {
  from: string;
  to: string;
  closerId?: string;
}

export function RevenueChart({ from, to, closerId }: RevenueChartProps) {
  const [data, setData] = useState<RevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (closerId) params.set("closerId", closerId);
    fetch(`/api/analytics/revenue-over-time?${params}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, closerId]);

  return (
    <Card className="col-span-2">
      <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white mb-4">
        Revenue Over Time
      </h3>
      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : data.length === 0 || data.every((d) => d.revenue === 0) ? (
        <div className="h-[300px] flex items-center justify-center text-cyber-muted text-sm">
          No revenue data yet. Start generating payment links and closing deals.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#A855F7" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#2A2A3E"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: string) => {
                const d = new Date(val);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) => `$${val.toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#12121A",
                border: "1px solid #2A2A3E",
                borderRadius: "8px",
                color: "#E0E0E0",
                fontFamily: "JetBrains Mono",
                fontSize: "12px",
              }}
              itemStyle={{ color: "#E0E0E0" }}
              labelStyle={{ color: "#9CA3AF" }}
              formatter={(value: number | undefined) => [
                `$${(value ?? 0).toLocaleString()}`,
                "Revenue",
              ]}
              labelFormatter={(label) => {
                const d = new Date(String(label));
                return d.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#00F0FF"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
