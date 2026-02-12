"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/generate": "Generate Payment Link",
  "/links": "Payment Links",
  "/payments": "Payments",
  "/closers": "Closers",
  "/settings": "Settings",
};

export function TopBar() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "CareerGrowth";

  return (
    <header className="h-16 bg-cyber-dark border-b border-cyber-border flex items-center px-6">
      <h1 className="font-[family-name:var(--font-orbitron)] text-lg font-semibold text-white tracking-wide">
        {title}
      </h1>
    </header>
  );
}
