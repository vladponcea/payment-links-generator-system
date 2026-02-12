import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getPlanTypeLabel(type: string): string {
  switch (type) {
    case "one_time":
      return "One-Time";
    case "renewal":
      return "Recurring";
    case "split_pay":
      return "Split Pay";
    case "custom_split":
      return "Custom Split";
    default:
      return type;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "succeeded":
      return "green";
    case "failed":
      return "red";
    case "pending":
      return "yellow";
    case "refunded":
      return "purple";
    default:
      return "gray";
  }
}

export function getBillingIntervalLabel(days: number): string {
  switch (days) {
    case 7:
      return "Weekly";
    case 14:
      return "Bi-weekly";
    case 30:
      return "Monthly";
    case 90:
      return "Quarterly";
    case 365:
      return "Yearly";
    default:
      return `Every ${days} days`;
  }
}

// Product display names with emoji prefixes
const PRODUCT_EMOJI_MAP: Record<string, string> = {
  "CareerGrowth Guided": "🤝",
  "CareerGrowth Advanced": "🚀",
  "CareerGrowth VIP": "🎓",
  "CareerGrowth VTO": "🎥",
};

export function displayProductName(name: string | null | undefined): string {
  if (!name) return "Unknown Product";
  for (const [keyword, emoji] of Object.entries(PRODUCT_EMOJI_MAP)) {
    if (name.startsWith(keyword)) {
      return `${emoji} ${name}`;
    }
  }
  return name;
}
