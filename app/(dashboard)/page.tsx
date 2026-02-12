"use client";

import { useState, useEffect } from "react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CloserBarChart } from "@/components/dashboard/CloserBarChart";
import { ProductPieChart } from "@/components/dashboard/ProductPieChart";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import {
  DateFilter,
  getDefaultDateRange,
  type DateRange,
} from "@/components/dashboard/DateFilter";
import { Select } from "@/components/ui/Select";
import { useUser } from "@/lib/user-context";

interface Closer {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [closerFilter, setCloserFilter] = useState("");
  const [closers, setClosers] = useState<Closer[]>([]);
  const currentUser = useUser();
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/closers")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setClosers(d.data);
        })
        .catch(console.error);
    }
  }, [isAdmin]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <div className="flex items-center justify-end gap-3">
        {isAdmin && closers.length > 0 && (
          <Select
            options={[
              { value: "", label: "All Closers" },
              ...closers.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={closerFilter}
            onChange={(e) => setCloserFilter(e.target.value)}
          />
        )}
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      <StatsCards
        from={dateRange.from}
        to={dateRange.to}
        closerId={closerFilter || undefined}
      />

      {isAdmin ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RevenueChart from={dateRange.from} to={dateRange.to} closerId={closerFilter || undefined} />
          <CloserBarChart from={dateRange.from} to={dateRange.to} closerId={closerFilter || undefined} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RevenueChart from={dateRange.from} to={dateRange.to} />
          <Leaderboard from={dateRange.from} to={dateRange.to} />
        </div>
      )}

      {isAdmin && (
        <Leaderboard from={dateRange.from} to={dateRange.to} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentPayments from={dateRange.from} to={dateRange.to} closerId={closerFilter || undefined} />
        </div>
        <ProductPieChart from={dateRange.from} to={dateRange.to} closerId={closerFilter || undefined} />
      </div>
    </div>
  );
}
