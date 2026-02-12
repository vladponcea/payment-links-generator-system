"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

type PresetKey = "7d" | "30d" | "mtd" | "qtd" | "ytd" | "custom";

interface DateFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

// ── helpers ──────────────────────────────────────────────────────────

function getPresetRange(key: PresetKey): DateRange {
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );
  let from: Date;

  switch (key) {
    case "7d":
      from = new Date(today);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: today.toISOString(), label: "7 Days" };
    case "30d":
      from = new Date(today);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: today.toISOString(), label: "30 Days" };
    case "mtd":
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { from: from.toISOString(), to: today.toISOString(), label: "MTD" };
    case "qtd": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), quarterMonth, 1, 0, 0, 0);
      return { from: from.toISOString(), to: today.toISOString(), label: "QTD" };
    }
    case "ytd":
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      return { from: from.toISOString(), to: today.toISOString(), label: "YTD" };
    default:
      from = new Date(today);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: today.toISOString(), label: "30 Days" };
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "mtd", label: "MTD" },
  { key: "qtd", label: "QTD" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom Range" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLabel(from: Date, to: Date): string {
  const fy = from.getFullYear();
  const ty = to.getFullYear();
  const fromStr = from.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(fy !== ty ? { year: "numeric" } : {}) });
  const toStr = to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fromStr} – ${toStr}`;
}

function same(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function between(d: Date, start: Date, end: Date) {
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

function daysIn(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function monStart(d: Date) {
  return (d.getDay() + 6) % 7;
}

export function getDefaultDateRange(): DateRange {
  return getPresetRange("30d");
}

// ── Calendar Grid ───────────────────────────────────────────────────

function CalendarGrid({
  from,
  to,
  picking,
  onSelect,
}: {
  from: Date | null;
  to: Date | null;
  picking: "from" | "to";
  onSelect: (d: Date) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const total = daysIn(year, month);
  const pad = monStart(new Date(year, month, 1));
  const cells: (number | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="select-none">
      {/* Nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1.5 rounded-md hover:bg-cyber-card text-cyber-muted hover:text-white transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-white tracking-wide">
          {MONTHS[month]} {year}
        </span>
        <button onClick={next} className="p-1.5 rounded-md hover:bg-cyber-card text-cyber-muted hover:text-white transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-[10px] text-cyber-muted text-center font-medium leading-6">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="h-8" />;

          const date = new Date(year, month, day);
          const isToday = same(date, today);
          const isFrom = from && same(date, from);
          const isTo = to && same(date, to);
          const isEnd = isFrom || isTo;
          const inRange = from && to && between(date, from, to) && !isEnd;

          return (
            <button
              key={`d-${i}`}
              onClick={() => onSelect(date)}
              className={[
                "h-8 rounded-md text-xs font-[family-name:var(--font-jetbrains)] transition-all duration-100",
                isEnd
                  ? "bg-cyber-cyan text-cyber-black font-bold"
                  : inRange
                  ? "bg-cyber-cyan/15 text-cyber-cyan"
                  : isToday
                  ? "ring-1 ring-cyber-cyan/40 text-cyber-cyan"
                  : "text-cyber-text hover:bg-cyber-card hover:text-white",
              ].join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function DateFilter({ value, onChange }: DateFilterProps) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>("30d");
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [picking, setPicking] = useState<"from" | "to">("from");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handlePreset(key: PresetKey) {
    if (key === "custom") {
      setShowCustom(true);
      setActivePreset("custom");
      setCustomFrom(new Date(value.from));
      setCustomTo(new Date(value.to));
      setPicking("from");
      return;
    }
    setShowCustom(false);
    setActivePreset(key);
    onChange(getPresetRange(key));
    setOpen(false);
  }

  const handleDayClick = useCallback(
    (date: Date) => {
      if (picking === "from") {
        setCustomFrom(date);
        if (customTo && date > customTo) setCustomTo(null);
        setPicking("to");
      } else {
        if (customFrom && date < customFrom) {
          setCustomTo(customFrom);
          setCustomFrom(date);
        } else {
          setCustomTo(date);
        }
        setPicking("from");
      }
    },
    [picking, customFrom, customTo]
  );

  function apply() {
    if (!customFrom || !customTo) return;
    const f = new Date(customFrom.getFullYear(), customFrom.getMonth(), customFrom.getDate(), 0, 0, 0);
    const t = new Date(customTo.getFullYear(), customTo.getMonth(), customTo.getDate(), 23, 59, 59);
    onChange({ from: f.toISOString(), to: t.toISOString(), label: formatLabel(f, t) });
    setActivePreset("custom");
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-cyber-dark border border-cyber-border rounded-lg text-sm text-cyber-text hover:border-cyber-cyan/50 hover:text-white transition-all duration-200 group"
      >
        <Calendar className="w-4 h-4 text-cyber-cyan group-hover:drop-shadow-[0_0_4px_var(--color-cyber-cyan)]" />
        <span className="font-[family-name:var(--font-jetbrains)] text-xs">
          {value.label}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-cyber-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-cyber-dark border border-cyber-border rounded-xl shadow-2xl shadow-black/50 animate-fade-in">
          <div className={showCustom ? "flex" : ""}>
            {/* Presets */}
            <div className={`p-2 space-y-0.5 ${showCustom ? "w-[150px] border-r border-cyber-border" : "w-[180px]"}`}>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all duration-100 ${
                    activePreset === p.key
                      ? "bg-cyber-cyan/10 text-cyber-cyan"
                      : "text-cyber-text hover:bg-cyber-card hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Calendar panel */}
            {showCustom && (
              <div className="p-4 w-[280px]">
                {/* Range pills */}
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setPicking("from")}
                    className={`flex-1 text-center py-1.5 rounded-lg text-xs font-[family-name:var(--font-jetbrains)] transition-colors ${
                      picking === "from"
                        ? "bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30"
                        : "bg-cyber-black text-cyber-muted border border-cyber-border hover:text-cyber-text"
                    }`}
                  >
                    {customFrom ? shortDate(customFrom) : "Start"}
                  </button>
                  <span className="text-cyber-muted text-xs">to</span>
                  <button
                    onClick={() => setPicking("to")}
                    className={`flex-1 text-center py-1.5 rounded-lg text-xs font-[family-name:var(--font-jetbrains)] transition-colors ${
                      picking === "to"
                        ? "bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30"
                        : "bg-cyber-black text-cyber-muted border border-cyber-border hover:text-cyber-text"
                    }`}
                  >
                    {customTo ? shortDate(customTo) : "End"}
                  </button>
                </div>

                {/* Calendar */}
                <CalendarGrid
                  from={customFrom}
                  to={customTo}
                  picking={picking}
                  onSelect={handleDayClick}
                />

                {/* Apply */}
                <button
                  onClick={apply}
                  disabled={!customFrom || !customTo}
                  className="w-full mt-4 px-3 py-2 rounded-lg text-xs font-semibold transition-colors bg-cyber-cyan/15 border border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/25 disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  Apply Range
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
