"use client";

import { useState } from "react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CloserBarChart } from "@/components/dashboard/CloserBarChart";
import { ProductPieChart } from "@/components/dashboard/ProductPieChart";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import {
  DateFilter,
  getDefaultDateRange,
  type DateRange,
} from "@/components/dashboard/DateFilter";

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Date filter */}
      <div className="flex items-center justify-end">
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      <StatsCards from={dateRange.from} to={dateRange.to} label={dateRange.label} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueChart from={dateRange.from} to={dateRange.to} />
        <CloserBarChart from={dateRange.from} to={dateRange.to} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentPayments from={dateRange.from} to={dateRange.to} />
        </div>
        <ProductPieChart from={dateRange.from} to={dateRange.to} />
      </div>
    </div>
  );
}
