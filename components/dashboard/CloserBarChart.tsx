"use client";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CloserRevenue } from "@/lib/types";

interface CloserBarChartProps {
  from: string;
  to: string;
}

export function CloserBarChart({ from, to }: CloserBarChartProps) {
  const [data, setData] = useState<CloserRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    fetch(`/api/analytics/by-closer?${params}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <Card>
      <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white mb-4">
        Revenue by Closer
      </h3>
      {loading ? (
        <Skeleton className="h-[250px] w-full" />
      ) : data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-cyber-muted text-sm">
          No data yet. Add closers and start generating payment links.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#2A2A3E"
              horizontal={false}
            />
            <XAxis
              type="number"
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) => `$${val.toLocaleString()}`}
            />
            <YAxis
              type="category"
              dataKey="closerName"
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={100}
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
              formatter={(value: number | undefined) => [
                `$${(value ?? 0).toLocaleString()}`,
                "Revenue",
              ]}
            />
            <Bar dataKey="revenue" fill="#00F0FF" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
