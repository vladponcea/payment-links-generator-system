"use client";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, displayProductName } from "@/lib/utils";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ProductRevenue } from "@/lib/types";

const COLORS = ["#00F0FF", "#A855F7", "#00FF88", "#FFD700", "#FF3366", "#6366F1"];

interface ProductPieChartProps {
  from: string;
  to: string;
  closerId?: string;
}

export function ProductPieChart({ from, to, closerId }: ProductPieChartProps) {
  const [data, setData] = useState<ProductRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (closerId) params.set("closerId", closerId);
    fetch(`/api/analytics/by-product?${params}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data.map((d: ProductRevenue) => ({ ...d, productName: displayProductName(d.productName) })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, closerId]);

  return (
    <Card>
      <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white mb-4">
        Revenue by Product
      </h3>
      {loading ? (
        <Skeleton className="h-[250px] w-full" />
      ) : data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-cyber-muted text-sm">
          No product data yet.
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="60%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={4}
                dataKey="revenue"
                nameKey="productName"
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
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
                formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Revenue"]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {data.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-xs text-cyber-text truncate flex-1">
                  {item.productName}
                </span>
                <span className="text-xs font-[family-name:var(--font-jetbrains)] text-cyber-muted">
                  {formatCurrency(item.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
