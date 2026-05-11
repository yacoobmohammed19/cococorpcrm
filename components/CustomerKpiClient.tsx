"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type KpiRow = {
  id: number;
  name: string;
  status: string;
  ltv: number;
  cac: number;
  invoiceCount: number;
  aov: number;
  netValue: number;
  firstInvoice: string | null;
  lastInvoice: string | null;
  purchaseFreqDays: number | null;
  pendingAmount: number;
};

type Props = {
  rows: KpiRow[];
  currency: string;
};

function fmt(n: number) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}

type SortKey = keyof KpiRow;

const METRICS = [
  { key: "ltv" as SortKey, label: "LTV", desc: "Lifetime Value (completed invoices)", color: "var(--accent)" },
  { key: "cac" as SortKey, label: "CAC", desc: "Customer Acquisition Cost (allocated costs)", color: "var(--red-c)" },
  { key: "netValue" as SortKey, label: "Net Value", desc: "LTV minus CAC", color: "var(--purple-c)" },
  { key: "aov" as SortKey, label: "AOV", desc: "Average Order Value", color: "var(--cyan-c)" },
  { key: "invoiceCount" as SortKey, label: "Invoices", desc: "Total invoice count", color: "var(--amber-c)" },
];

export function CustomerKpiClient({ rows, currency }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ltv");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(row => row.name.toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => {
      const av = a[sortKey] as number | string | null;
      const bv = b[sortKey] as number | string | null;
      const diff = (av ?? 0) > (bv ?? 0) ? 1 : (av ?? 0) < (bv ?? 0) ? -1 : 0;
      return sortAsc ? diff : -diff;
    });
  }, [rows, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  const totals = useMemo(() => ({
    ltv: rows.reduce((s, r) => s + r.ltv, 0),
    cac: rows.reduce((s, r) => s + r.cac, 0),
    netValue: rows.reduce((s, r) => s + r.netValue, 0),
    pending: rows.reduce((s, r) => s + r.pendingAmount, 0),
    avgAov: rows.length ? rows.reduce((s, r) => s + r.aov, 0) / rows.length : 0,
  }), [rows]);

  const SortArrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span className="ml-1">{sortAsc ? "↑" : "↓"}</span> : null;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer KPIs</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
            {rows.length} customers · LTV, CAC, AOV and net value per customer
          </p>
        </div>
        <Link
          href="/customers"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg"
          style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}
        >
          ← Customers
        </Link>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total LTV", value: totals.ltv, color: "var(--accent)", sub: "Collected revenue" },
          { label: "Total CAC", value: totals.cac, color: "var(--red-c)", sub: "Allocated costs" },
          { label: "Net Value", value: totals.netValue, color: totals.netValue >= 0 ? "var(--accent)" : "var(--red-c)", sub: "LTV minus CAC" },
          { label: "Avg AOV", value: totals.avgAov, color: "var(--cyan-c)", sub: "Avg invoice size" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted2)" }}>{label}</p>
            <p className="text-xl font-bold font-mono" style={{ color }}>{cur} {fmt(value)}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--muted2)" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Metric sort buttons */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search customers…"
          className="px-3 py-2 text-sm rounded-lg border outline-none flex-1 min-w-0 max-w-xs"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <span className="text-xs ml-2" style={{ color: "var(--muted2)" }}>Sort by:</span>
        {METRICS.map(m => (
          <button key={m.key} onClick={() => toggleSort(m.key)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
            style={{
              background: sortKey === m.key ? `color-mix(in srgb, ${m.color} 15%, var(--card2))` : "var(--card2)",
              border: `1px solid ${sortKey === m.key ? m.color : "var(--border)"}`,
              color: sortKey === m.key ? m.color : "var(--muted)",
            }}>
            {m.label}{sortKey === m.key ? (sortAsc ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {filtered.map(row => (
          <div key={row.id} className="rounded-2xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <Link href={`/customers/${row.id}`} className="font-bold text-base hover:underline" style={{ color: "var(--accent)" }}>{row.name}</Link>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>{row.invoiceCount} invoice{row.invoiceCount !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: "LTV", value: row.ltv, color: "var(--accent)" },
                { label: "CAC", value: row.cac, color: "var(--red-c)" },
                { label: "Net Value", value: row.netValue, color: row.netValue >= 0 ? "var(--accent)" : "var(--red-c)" },
                { label: "AOV", value: row.aov, color: "var(--cyan-c)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-2.5" style={{ background: "var(--card)" }}>
                  <p className="text-xs mb-0.5" style={{ color: "var(--muted2)" }}>{label}</p>
                  <p className="font-bold font-mono text-sm" style={{ color }}>{cur} {fmt(value)}</p>
                </div>
              ))}
            </div>
            {row.purchaseFreqDays != null && (
              <p className="text-xs" style={{ color: "var(--muted2)" }}>
                Avg {Math.round(row.purchaseFreqDays)}d between purchases · Last: {fdate(row.lastInvoice)}
              </p>
            )}
            {row.pendingAmount > 0 && (
              <p className="text-xs mt-1 font-semibold" style={{ color: "var(--amber-c)" }}>
                {cur} {fmt(row.pendingAmount)} pending
              </p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: "var(--muted2)" }}>No customers found.</div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted2)" }}>Customer</th>
                {[
                  { key: "ltv" as SortKey, label: "LTV" },
                  { key: "cac" as SortKey, label: "CAC" },
                  { key: "netValue" as SortKey, label: "Net Value" },
                  { key: "aov" as SortKey, label: "AOV" },
                  { key: "invoiceCount" as SortKey, label: "Invoices" },
                  { key: "pendingAmount" as SortKey, label: "Pending" },
                ].map(({ key, label }) => (
                  <th key={key}
                    onClick={() => toggleSort(key)}
                    className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest cursor-pointer select-none hover:opacity-80 whitespace-nowrap"
                    style={{ color: sortKey === key ? "var(--accent)" : "var(--muted2)" }}>
                    {label}<SortArrow k={key} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted2)" }}>Freq</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted2)" }}>Last Invoice</th>
              </tr>
            </thead>
            <tbody style={{ background: "var(--card)" }}>
              {filtered.map((row, i) => (
                <tr key={row.id} className="transition-colors hover:bg-[var(--card2)]"
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td className="px-4 py-3">
                    <Link href={`/customers/${row.id}`} className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>{row.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "var(--accent)" }}>{cur} {fmt(row.ltv)}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--red-c)" }}>{row.cac > 0 ? `${cur} ${fmt(row.cac)}` : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: row.netValue >= 0 ? "var(--accent)" : "var(--red-c)" }}>{cur} {fmt(row.netValue)}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--cyan-c)" }}>{row.invoiceCount > 0 ? `${cur} ${fmt(row.aov)}` : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--muted)" }}>{row.invoiceCount}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: row.pendingAmount > 0 ? "var(--amber-c)" : "var(--muted2)" }}>
                    {row.pendingAmount > 0 ? `${cur} ${fmt(row.pendingAmount)}` : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--muted2)" }}>
                    {row.purchaseFreqDays != null ? `${Math.round(row.purchaseFreqDays)}d` : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(row.lastInvoice)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: "var(--muted2)" }}>No customers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
