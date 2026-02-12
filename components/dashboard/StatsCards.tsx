"use client";

import { Card } from "@/components/ui/Card";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Target,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { DashboardStats } from "@/lib/types";

interface StatsCardsProps {
  from: string;
  to: string;
  label: string;
}

export function StatsCards({ from, to, label }: StatsCardsProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    fetch(`/api/analytics/overview?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setStats(data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: "cyber-cyan",
      change: stats.revenueChange,
    },
    {
      title: `Revenue (${label})`,
      value: formatCurrency(stats.monthlyRevenue),
      icon: TrendingUp,
      color: "cyber-green",
      change: stats.revenueChange,
    },
    {
      title: "Total Sales",
      value: stats.totalSales.toString(),
      icon: ShoppingCart,
      color: "cyber-purple",
      change: stats.salesChange,
    },
    {
      title: "Avg Deal Size",
      value: formatCurrency(stats.averageDealSize),
      icon: Target,
      color: "cyber-yellow",
      change: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <Card
            key={i}
            className="animate-fade-in"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-cyber-muted uppercase tracking-wider mb-1">
                  {card.title}
                </p>
                <p className="text-2xl font-bold font-[family-name:var(--font-jetbrains)] text-white animate-count-up">
                  {card.value}
                </p>
                {card.change !== null && (
                  <div className="flex items-center gap-1 mt-2">
                    {card.change >= 0 ? (
                      <ArrowUp className="w-3 h-3 text-cyber-green" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-cyber-red" />
                    )}
                    <span
                      className={`text-xs font-[family-name:var(--font-jetbrains)] ${
                        card.change >= 0 ? "text-cyber-green" : "text-cyber-red"
                      }`}
                    >
                      {Math.abs(card.change)}%
                    </span>
                    <span className="text-xs text-cyber-muted">vs prev period</span>
                  </div>
                )}
              </div>
              <div className="relative p-2 rounded-lg">
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{
                    backgroundColor: `var(--color-${card.color})`,
                    opacity: 0.15,
                  }}
                />
                <Icon
                  className="w-5 h-5 relative"
                  style={{ color: `var(--color-${card.color})` }}
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
