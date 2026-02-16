"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, prefix, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-cyber-text"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted text-sm font-[family-name:var(--font-jetbrains)]">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              "w-full bg-cyber-black border border-cyber-border rounded-lg px-4 py-2.5 text-sm text-white",
              "placeholder:text-cyber-muted/60",
              "focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 focus:outline-none",
              "transition-all duration-200",
              "font-[family-name:var(--font-inter)]",
              prefix && "pl-8",
              error && "border-cyber-red focus:border-cyber-red focus:ring-cyber-red/50",
              className
            )}
            {...props}
            onWheel={props.type === "number" ? (e) => (e.target as HTMLInputElement).blur() : props.onWheel}
          />
        </div>
        {error && (
          <p className="text-xs text-cyber-red">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
