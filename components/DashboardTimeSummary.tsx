// Server component — read-only "Time Invested" review block for the dashboard.
// Data is pre-aggregated by the dashboard page; this only presents it.

type BreakdownRow = { label: string; type: "lead" | "rd_project"; minutes: number };

function formatDuration(min: number): string {
  if (!min) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

export function DashboardTimeSummary({
  leadMinutes, rdMinutes, monthMinutes, breakdown,
}: {
  leadMinutes: number;
  rdMinutes: number;
  monthMinutes: number;
  breakdown: BreakdownRow[];
}) {
  const total = leadMinutes + rdMinutes;
  const maxMin = breakdown.reduce((m, r) => Math.max(m, r.minutes), 0) || 1;

  const cards = [
    { label: "Total logged", value: formatDuration(total), color: "var(--foreground)" },
    { label: "On Leads", value: formatDuration(leadMinutes), color: "var(--accent)" },
    { label: "On R&D", value: formatDuration(rdMinutes), color: "var(--purple-c)" },
    { label: "This month", value: formatDuration(monthMinutes), color: "var(--amber-c)" },
  ];

  return (
    <div className="rounded-xl p-5 mt-6" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Time Invested</h2>
        <span className="text-xs" style={{ color: "var(--muted2)" }}>Leads &amp; R&amp;D</span>
      </div>

      {total === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: "var(--muted2)" }}>
          No time logged yet. Log time on a lead or R&amp;D project — or just tell Coco what you did.
        </p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {cards.map(c => (
              <div key={c.label} className="rounded-lg p-3 text-center" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{c.label}</div>
                <div className="text-lg font-bold font-mono" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Per-entity breakdown */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Where time went (top {breakdown.length})</div>
            {breakdown.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{
                  background: r.type === "lead" ? "rgba(236,72,153,.12)" : "rgba(139,92,246,.14)",
                  color: r.type === "lead" ? "var(--accent)" : "var(--purple-c)",
                }}>
                  {r.type === "lead" ? "Lead" : "R&D"}
                </span>
                <span className="text-sm flex-1 min-w-0 truncate">{r.label}</span>
                <div className="hidden sm:block w-32 h-2 rounded-full overflow-hidden shrink-0" style={{ background: "var(--card3)" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${Math.round((r.minutes / maxMin) * 100)}%`,
                    background: r.type === "lead" ? "var(--accent)" : "var(--purple-c)",
                  }} />
                </div>
                <span className="text-sm font-mono font-semibold shrink-0 w-16 text-right">{formatDuration(r.minutes)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
