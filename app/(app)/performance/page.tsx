import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { takeSnapshot } from "@/server-actions/performance";

function fmt(n: number) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function pct(n: number) { return (n * 100).toFixed(1) + "%"; }

export default async function PerformancePage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: snapshots }, { data: org }] = await Promise.all([
    supabase
      .from("fact_performance")
      .select("*")
      .eq("org_id", orgId)
      .order("snapshot_date", { ascending: false })
      .limit(24),
    supabase.from("organizations").select("currency, name").eq("id", orgId).single(),
  ]);

  const currency = org?.currency || "ZAR";
  const cur = currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "R";
  const snaps = snapshots || [];

  const kpiKeys: { key: string; label: string; format: (v: number) => string; color: string }[] = [
    { key: "revenue_ytd", label: "Revenue YTD", format: v => `${cur} ${fmt(v)}`, color: "var(--accent)" },
    { key: "total_revenue_yearly", label: "Revenue (12m)", format: v => `${cur} ${fmt(v)}`, color: "var(--cyan-c)" },
    { key: "total_opex", label: "Total OPEX", format: v => `${cur} ${fmt(v)}`, color: "var(--red-c)" },
    { key: "margin", label: "Margin", format: pct, color: "var(--purple-c)" },
    { key: "cashflow", label: "Cashflow", format: v => `${cur} ${fmt(v)}`, color: "var(--accent)" },
    { key: "weighted_pipeline", label: "Pipeline", format: v => `${cur} ${fmt(v)}`, color: "var(--amber-c)" },
    { key: "conversion_rate", label: "Conv. Rate", format: pct, color: "var(--pink)" },
    { key: "open_leads", label: "Open Leads", format: v => String(Math.round(v)), color: "var(--muted)" },
  ];

  const latest = snaps[0];
  const prev = snaps[1];

  function delta(key: string) {
    if (!latest || !prev) return null;
    const a = Number((latest as Record<string, unknown>)[key] || 0);
    const b = Number((prev as Record<string, unknown>)[key] || 0);
    if (!b) return null;
    const d = ((a - b) / b) * 100;
    return { pct: d, up: d >= 0 };
  }

  function avg(key: string) {
    if (snaps.length < 2) return null;
    const vals = snaps.slice(1).map(s => Number((s as Record<string, unknown>)[key] || 0));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Snapshots</h1>
        <form action={takeSnapshot}>
          <button className="px-4 py-2 rounded text-sm font-semibold transition-colors"
            style={{ background: "var(--accent)", color: "#fff" }}>
            📸 Take Snapshot
          </button>
        </form>
      </div>

      {snaps.length === 0 && (
        <div className="rounded-lg p-12 text-center" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
          <p className="text-sm mb-2" style={{ color: "var(--muted2)" }}>No snapshots yet</p>
          <p className="text-xs" style={{ color: "var(--muted2)" }}>Click &ldquo;Take Snapshot&rdquo; to capture current KPIs</p>
        </div>
      )}

      {latest && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {kpiKeys.map(({ key, label, format, color }) => {
              const val = Number((latest as Record<string, unknown>)[key] || 0);
              const d = delta(key);
              const a = avg(key);
              return (
                <div key={key} className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{label}</div>
                  <div className="text-xl font-bold font-mono" style={{ color }}>{format(val)}</div>
                  <div className="flex items-center gap-3 mt-1">
                    {d !== null && (
                      <span className="text-xs" style={{ color: d.up ? "var(--accent)" : "var(--red-c)" }}>
                        {d.up ? "▲" : "▼"} {Math.abs(d.pct).toFixed(1)}% vs prev
                      </span>
                    )}
                    {a !== null && (
                      <span className="text-xs" style={{ color: "var(--muted2)" }}>
                        avg {format(a)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Snapshot History Table */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Snapshot History</h3>
            </div>
            <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                    {["Date", "Revenue YTD", "12m Rev", "OPEX", "Margin", "Cashflow", "Pipeline", "Conv%", "Open Leads"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: "var(--muted2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snaps.map((s, i) => {
                    const row = s as Record<string, unknown>;
                    return (
                      <tr key={i} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--muted)" }}>{String(row.snapshot_date || "")}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--accent)" }}>{cur} {fmt(Number(row.revenue_ytd || 0))}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--cyan-c)" }}>{cur} {fmt(Number(row.total_revenue_yearly || 0))}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--red-c)" }}>{cur} {fmt(Number(row.total_opex || 0))}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--purple-c)" }}>{pct(Number(row.margin || 0))}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--accent)" }}>{cur} {fmt(Number(row.cashflow || 0))}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--amber-c)" }}>{cur} {fmt(Number(row.weighted_pipeline || 0))}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--pink)" }}>{pct(Number(row.conversion_rate || 0))}</td>
                        <td className="px-3 py-2 font-mono" style={{ color: "var(--muted)" }}>{Math.round(Number(row.open_leads || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
