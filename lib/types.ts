export interface CloserFormData {
  name: string;
  email: string;
  phone?: string;
  commissionType: "percentage" | "flat";
  commissionValue: number;
}

export interface WhopProduct {
  id: string;
  title: string;
  description?: string;
  created_at?: string;
}

export type PaymentType = "one_time" | "renewal" | "split_pay";
export type SplitMode = "equal" | "custom";

export interface PaymentLinkFormData {
  closerId: string;
  productId: string;
  productName: string;
  paymentType: PaymentType;
  title?: string;
  description?: string;

  // One-time
  amount?: number;

  // Recurring
  renewalPrice?: number;
  billingPeriodDays?: number;

  // Split pay
  splitMode?: SplitMode;
  totalAmount?: number;
  numberOfPayments?: number;
  initialPrice?: number;
  installmentPrice?: number;
}

export interface DashboardStats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalSales: number;
  averageDealSize: number;
  revenueChange: number;
  salesChange: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
}

export interface CloserRevenue {
  closerId: string;
  closerName: string;
  revenue: number;
  sales: number;
  commission: number;
}

export interface ProductRevenue {
  productName: string;
  productId: string;
  revenue: number;
  sales: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
