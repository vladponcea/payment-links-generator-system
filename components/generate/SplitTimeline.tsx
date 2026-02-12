"use client";

import { formatCurrency } from "@/lib/utils";

interface SplitTimelineProps {
  initialPrice: number;
  installmentPrice: number;
  numberOfPayments: number;
  billingPeriodDays: number;
}

export function SplitTimeline({
  initialPrice,
  installmentPrice,
  numberOfPayments,
  billingPeriodDays,
}: SplitTimelineProps) {
  const payments = Array.from({ length: numberOfPayments }, (_, i) => ({
    number: i + 1,
    amount: i === 0 ? initialPrice : installmentPrice,
    day: i * billingPeriodDays,
  }));

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="bg-cyber-black border border-cyber-border rounded-lg p-5">
      <h4 className="font-[family-name:var(--font-orbitron)] text-xs font-semibold text-white mb-4 uppercase tracking-wider">
        Payment Timeline
      </h4>
      <div className="space-y-3">
        {payments.map((payment) => (
          <div key={payment.number} className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  payment.number === 1 ? "bg-cyber-cyan" : "bg-cyber-purple"
                }`}
              />
              {payment.number < numberOfPayments && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-6 bg-cyber-border" />
              )}
            </div>
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm text-cyber-text">
                {payment.day === 0 ? "Today" : `Day ${payment.day}`}
              </span>
              <span className="font-[family-name:var(--font-jetbrains)] text-sm text-white">
                {formatCurrency(payment.amount)}
              </span>
            </div>
            <span className="text-xs text-cyber-muted">
              {payment.number === 1
                ? "(1st payment)"
                : `(${ordinal(payment.number)} payment)`}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-cyber-border flex items-center justify-between">
        <span className="text-sm font-medium text-cyber-text">Total</span>
        <span className="font-[family-name:var(--font-jetbrains)] text-lg font-bold text-cyber-cyan">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
