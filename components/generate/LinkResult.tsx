"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Check, Copy, ExternalLink, RotateCcw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface LinkResultProps {
  url: string;
  onReset: () => void;
}

export function LinkResult({ url, onReset }: LinkResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [url]);

  useEffect(() => {
    handleCopy();
  }, [handleCopy]);

  return (
    <Card glow className="animate-fade-in text-center max-w-xl mx-auto">
      <div className="mb-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-cyber-green/10 border border-cyber-green/20 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-cyber-green" />
        </div>
        <h3 className="font-[family-name:var(--font-orbitron)] text-lg font-semibold text-white">
          Payment Link Generated!
        </h3>
        <p className="text-sm text-cyber-muted mt-1">
          Share this link with your customer to collect payment.
        </p>
      </div>

      <div className="bg-cyber-black border border-cyber-border rounded-lg p-4 mb-4">
        <p className="font-[family-name:var(--font-jetbrains)] text-sm text-cyber-cyan break-all">
          {url}
        </p>
      </div>

      <div className="flex items-center gap-3 justify-center">
        <Button
          onClick={handleCopy}
          variant="primary"
          size="lg"
          className="animate-pulse-glow"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" /> Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" /> Copy Link
            </>
          )}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="w-4 h-4 mr-2" /> Open
        </Button>
      </div>

      <div className="mt-6 pt-4 border-t border-cyber-border">
        <Button variant="ghost" onClick={onReset}>
          <RotateCcw className="w-4 h-4 mr-2" /> Generate Another Link
        </Button>
      </div>
    </Card>
  );
}
