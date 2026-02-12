"use client";

import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto rounded-full bg-cyber-red/10 border border-cyber-red/20 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-cyber-red" />
        </div>
        <h2 className="font-[family-name:var(--font-orbitron)] text-lg font-semibold text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-cyber-muted mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  );
}
