"use client";

import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

interface SelectProps {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  value,
  onChange,
  onValueChange,
  disabled = false,
  className,
  id,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const handleSelect = useCallback(
    (val: string) => {
      onChange?.({ target: { value: val } });
      onValueChange?.(val);
      setOpen(false);
    },
    [onChange, onValueChange]
  );

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape, keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          setOpen(false);
          break;
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : options.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            handleSelect(options[highlightedIndex].value);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, highlightedIndex, options, handleSelect]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightedIndex]) {
      (items[highlightedIndex] as HTMLElement).scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, open]);

  // Reset highlight when opening
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  return (
    <div className={cn("space-y-1.5 relative", className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-cyber-text"
        >
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between bg-cyber-black border border-cyber-border rounded-lg px-4 py-2.5 text-sm text-left",
          "focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 focus:outline-none",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open && "border-cyber-cyan ring-1 ring-cyber-cyan/50",
          error && "border-cyber-red focus:border-cyber-red focus:ring-cyber-red/50",
          selectedOption ? "text-white" : "text-cyber-muted/60"
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder || "Select..."}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-cyber-muted flex-shrink-0 ml-2 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          className={cn(
            "absolute z-50 w-full mt-1 bg-cyber-dark border border-cyber-border rounded-lg shadow-xl shadow-black/40",
            "max-h-60 overflow-y-auto",
            "animate-fade-in"
          )}
          role="listbox"
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-cyber-muted">
              No options available
            </div>
          ) : (
            options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors",
                    isHighlighted && "bg-cyber-cyan/10",
                    isSelected
                      ? "text-cyber-cyan"
                      : "text-cyber-text hover:text-white",
                    index === 0 && "rounded-t-lg",
                    index === options.length - 1 && "rounded-b-lg"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-cyber-cyan flex-shrink-0 ml-2" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {error && <p className="text-xs text-cyber-red mt-1">{error}</p>}
    </div>
  );
}
