import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "cyan" | "purple" | "green" | "red" | "yellow" | "gray";
  children: React.ReactNode;
  className?: string;
}

const variants = {
  cyan: "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20",
  purple: "bg-cyber-purple/10 text-cyber-purple border-cyber-purple/20",
  green: "bg-cyber-green/10 text-cyber-green border-cyber-green/20",
  red: "bg-cyber-red/10 text-cyber-red border-cyber-red/20",
  yellow: "bg-cyber-yellow/10 text-cyber-yellow border-cyber-yellow/20",
  gray: "bg-white/5 text-cyber-muted border-white/10",
};

export function Badge({ variant = "gray", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-medium border rounded-full",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    succeeded: { variant: "green", label: "Succeeded" },
    failed: { variant: "red", label: "Failed" },
    pending: { variant: "yellow", label: "Pending" },
    refunded: { variant: "purple", label: "Refunded" },
    active: { variant: "cyan", label: "Active" },
    expired: { variant: "gray", label: "Expired" },
    completed: { variant: "green", label: "Completed" },
  };

  const { variant, label } = config[status] || { variant: "gray" as const, label: status };

  return <Badge variant={variant}>{label}</Badge>;
}
