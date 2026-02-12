"use client";

import { StatsCards } from "@/components/dashboard/StatsCards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CloserBarChart } from "@/components/dashboard/CloserBarChart";
import { ProductPieChart } from "@/components/dashboard/ProductPieChart";
import { RecentPayments } from "@/components/dashboard/RecentPayments";

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueChart />
        <CloserBarChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentPayments />
        </div>
        <ProductPieChart />
      </div>
    </div>
  );
}
