import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-cyber-dark border border-cyber-border rounded-xl p-6 transition-all duration-300",
          "hover:border-cyber-cyan/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.08)]",
          glow && "border-cyber-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
