"use client";

import { usePnlMode, setPnlMode } from "@/hooks/usePnlMode";

/**
 * Segmented control for the app-wide P&L lens. Rendered in the header of every
 * money view (Accounting, Billing, Costs, Dashboard); the underlying value is
 * global so all of them stay in sync. See `usePnlMode`.
 */
export function PnlModeToggle({ className = "" }: { className?: string }) {
  const mode = usePnlMode();
  const options = [
    { m: "pnl" as const, label: "Business P&L", title: "Exclude non-P&L costs (owner draws, zakat, personal, etc.) — true business performance" },
    { m: "total" as const, label: "All costs", title: "Include every cost — true cash-out view" },
  ];
  return (
    <div
      className={`inline-flex rounded-lg overflow-hidden border shrink-0 ${className}`}
      style={{ borderColor: "var(--border)" }}
      role="group"
      aria-label="Profit & loss cost view"
    >
      {options.map(({ m, label, title }) => (
        <button
          key={m}
          type="button"
          onClick={() => setPnlMode(m)}
          title={title}
          aria-pressed={mode === m}
          className="px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
          style={{
            background: mode === m ? "var(--accent)" : "var(--card2)",
            color: mode === m ? "#fff" : "var(--muted)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
