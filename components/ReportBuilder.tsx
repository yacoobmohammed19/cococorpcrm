"use client";

import { useState, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

type Dim = { id: number; name: string };

type RawInvoice = { id: number; amount: number | null; status: string | null; transaction_date: string | null; customer_id: number | null; payment_type_id: number | null };
type RawLead = { id: number; name: string; status_id: number; lead_date: string | null; opportunity_value: number | null; opportunity_weighted: number | null; weight: number | null; total_revenue: number | null };
type RawCost = { id: number; amount: number | null; transaction_date: string | null; cost_category_id: number | null; include_in_pnl: boolean | null };
type RawCashflow = { id: number; balance: number; record_date: string; account_id: number | null };

type TableKey = "fact_invoices" | "fact_leads" | "fact_costs" | "fact_cashflow";
type AggType = "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
type ChartType = "bar" | "line" | "pie" | "table";

// Per-table: available numeric columns + available dimension foreign keys
const TABLE_META: Record<TableKey, {
  label: string;
  dateCol: string;
  numericCols: { col: string; label: string }[];
  dimLinks: { col: string; label: string; dimKey: "customers" | "statuses" | "costCategories" | "paymentTypes" | "accounts" | "" }[];
}> = {
  fact_invoices: {
    label: "Invoices",
    dateCol: "transaction_date",
    numericCols: [{ col: "amount", label: "Amount" }],
    dimLinks: [
      { col: "customer_id",     label: "Customer",       dimKey: "customers" },
      { col: "payment_type_id", label: "Payment Type",   dimKey: "paymentTypes" },
      { col: "status",          label: "Invoice Status", dimKey: "" },
    ],
  },
  fact_leads: {
    label: "Leads",
    dateCol: "lead_date",
    numericCols: [
      { col: "opportunity_value",    label: "Opportunity Value" },
      { col: "opportunity_weighted", label: "Weighted Pipeline" },
      { col: "total_revenue",        label: "Total Revenue" },
    ],
    dimLinks: [
      { col: "status_id", label: "Lead Status", dimKey: "statuses" },
    ],
  },
  fact_costs: {
    label: "Costs",
    dateCol: "transaction_date",
    numericCols: [{ col: "amount", label: "Amount" }],
    dimLinks: [
      { col: "cost_category_id", label: "Cost Category", dimKey: "costCategories" },
    ],
  },
  fact_cashflow: {
    label: "Cashflow",
    dateCol: "record_date",
    numericCols: [{ col: "balance", label: "Balance" }],
    dimLinks: [
      { col: "account_id", label: "Account", dimKey: "accounts" },
    ],
  },
};

const AGG_LABELS: Record<AggType, string> = {
  SUM: "Sum", AVG: "Average", COUNT: "Count", MIN: "Minimum", MAX: "Maximum",
};

const CHART_COLORS = ["#10b981","#e84393","#8b5cf6","#f59e0b","#06b6d4","#ef4444","#84cc16","#f97316"];
const ORPHAN_COLOR = "#f59e0b";
const TT_STYLE = { background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 };
const TICK_STYLE = { fontSize: 10, fill: "var(--muted2)" };
const GRID_COLOR = "rgba(255,255,255,0.04)";

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function applyDateFilter(records: Record<string, unknown>[], dateCol: string, from: string, to: string) {
  if (!from && !to) return records;
  return records.filter(r => {
    const d = String(r[dateCol] ?? "").slice(0, 10);
    if (!d) return true;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

function aggregate(records: Record<string, unknown>[], metricCol: string, agg: AggType): number {
  const vals = records.map(r => Number(r[metricCol] ?? 0)).filter(v => !isNaN(v));
  if (!vals.length) return 0;
  switch (agg) {
    case "SUM": return vals.reduce((a, b) => a + b, 0);
    case "AVG": return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "COUNT": return records.length;
    case "MIN": return Math.min(...vals);
    case "MAX": return Math.max(...vals);
  }
}

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  rawInvoices: RawInvoice[];
  rawLeads: RawLead[];
  rawCosts: RawCost[];
  rawCashflow: RawCashflow[];
  customers: Dim[];
  statuses: Dim[];
  paymentTypes: Dim[];
  costCategories: Dim[];
  accounts: Dim[];
  currency: string;
};

type Dims = Pick<Props, "customers" | "statuses" | "paymentTypes" | "costCategories" | "accounts">;

function getDimMap(key: keyof Dims | "", dims: Dims): Map<number, string> {
  if (!key) return new Map();
  const list = dims[key as keyof Dims] as Dim[];
  return new Map(list.map(d => [d.id, d.name]));
}

// ── AI Chart Renderer ──────────────────────────────────────────────────────────

type ChartSpec = {
  chartType: "bar" | "line" | "pie";
  title?: string;
  xKey: string;
  yKey: string;
  data: Record<string, unknown>[];
};

function AiChartRenderer({ spec, cur }: { spec: ChartSpec; cur: string }) {
  const fmtVal = (v: unknown) => {
    const n = Number(v);
    if (isNaN(n)) return String(v ?? "");
    return `${cur} ${fmt(n)}`;
  };

  if (spec.chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={spec.data} dataKey={spec.yKey} nameKey={spec.xKey} cx="50%" cy="50%" outerRadius={70}>
            {spec.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => fmtVal(v)} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (spec.chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={spec.data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey={spec.xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => fmtVal(v)} />
          <Line type="monotone" dataKey={spec.yKey} stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={spec.data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey={spec.xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => fmtVal(v)} />
        <Bar dataKey={spec.yKey} fill={CHART_COLORS[0]} radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ReportBuilder({ rawInvoices, rawLeads, rawCosts, rawCashflow, customers, statuses, paymentTypes, costCategories, accounts, currency }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const dims: Dims = { customers, statuses, paymentTypes, costCategories, accounts };

  const [table, setTable] = useState<TableKey>("fact_invoices");
  const [metricCol, setMetricCol] = useState("amount");
  const [agg, setAgg] = useState<AggType>("SUM");
  const [groupByCol, setGroupByCol] = useState<string>("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // AI graph state
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChart, setAiChart] = useState<ChartSpec | null>(null);
  const [aiHtml, setAiHtml] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const meta = TABLE_META[table];

  // Normalise raw data to generic records
  const rawRecords = useMemo((): Record<string, unknown>[] => {
    if (table === "fact_invoices") return rawInvoices as unknown as Record<string, unknown>[];
    if (table === "fact_leads") return rawLeads as unknown as Record<string, unknown>[];
    if (table === "fact_costs") return rawCosts as unknown as Record<string, unknown>[];
    return rawCashflow as unknown as Record<string, unknown>[];
  }, [table, rawInvoices, rawLeads, rawCosts, rawCashflow]);

  const dateFilteredRecords = useMemo(
    () => applyDateFilter(rawRecords, meta.dateCol, dateFrom, dateTo),
    [rawRecords, meta.dateCol, dateFrom, dateTo]
  );

  // Find dim link for the current groupBy column
  const groupByDimLink = useMemo(
    () => meta.dimLinks.find(d => d.col === groupByCol),
    [meta.dimLinks, groupByCol]
  );
  const dimMap = useMemo(
    () => getDimMap(groupByDimLink?.dimKey ?? "", dims),
    [groupByDimLink, dims]
  );

  // ── Aggregated results ──────────────────────────────────────────────────────
  const results = useMemo(() => {
    if (!groupByCol) {
      // No group-by: single aggregate row
      const val = aggregate(dateFilteredRecords, metricCol, agg);
      return [{ _label: "Total", _value: val, _orphaned: false, _count: dateFilteredRecords.length }];
    }

    // Group by the selected column
    const groups = new Map<string, { records: Record<string, unknown>[]; orphaned: boolean }>();
    for (const rec of dateFilteredRecords) {
      const raw = rec[groupByCol];
      let label: string;
      let orphaned = false;

      if (raw == null) {
        label = "— (unset)";
      } else if (groupByDimLink?.dimKey) {
        // FK column — look up dim name
        const name = dimMap.get(Number(raw));
        if (name) {
          label = name;
        } else {
          // Orphaned: FK exists but has no matching dim record
          label = `[orphaned: ${raw}]`;
          orphaned = true;
        }
      } else {
        // Non-FK column (e.g. invoice status string)
        label = String(raw);
      }

      const existing = groups.get(label);
      if (existing) {
        existing.records.push(rec);
      } else {
        groups.set(label, { records: [rec], orphaned });
      }
    }

    return Array.from(groups.entries()).map(([label, { records, orphaned }]) => ({
      _label: label,
      _value: aggregate(records, metricCol, agg),
      _orphaned: orphaned,
      _count: records.length,
    }));
  }, [dateFilteredRecords, groupByCol, metricCol, agg, groupByDimLink, dimMap]);

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => sortDir === "desc" ? b._value - a._value : a._value - b._value),
    [results, sortDir]
  );

  const orphanCount = results.filter(r => r._orphaned).length;
  const metricLabel = meta.numericCols.find(c => c.col === metricCol)?.label ?? metricCol;

  // ── Reset metric col when table changes ────────────────────────────────────
  const handleTableChange = (t: TableKey) => {
    setTable(t);
    setMetricCol(TABLE_META[t].numericCols[0].col);
    setGroupByCol("");
    setAiChart(null);
    setAiHtml(null);
  };

  // ── AI-driven chart generation ─────────────────────────────────────────────
  async function handleAiGraph() {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiChart(null);
    setAiHtml(null);
    setAiError(null);

    // Build a compact data summary to send to AI
    const summary = sortedResults.slice(0, 50).map(r => ({ label: r._label, value: r._value }));

    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "report_graph",
          data: {
            query: aiQuery,
            table: TABLE_META[table].label,
            metric: `${AGG_LABELS[agg]} of ${metricLabel}`,
            groupBy: groupByCol ? (groupByDimLink?.label ?? groupByCol) : "none",
            results: summary,
            currency: currency,
          },
        }),
      });
      const json = await res.json() as { result?: string; error?: string };
      if (json.error) { setAiError(json.error); return; }

      const text = (json.result ?? "").trim();

      // Try to parse as structured chart spec
      const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```|^\s*(\{[\s\S]+\})\s*$/);
      const raw = jsonMatch?.[1] ?? jsonMatch?.[2];
      if (raw) {
        try {
          const spec = JSON.parse(raw) as ChartSpec;
          if (spec.chartType && spec.xKey && spec.yKey && Array.isArray(spec.data)) {
            setAiChart(spec);
            return;
          }
        } catch { /* fall through to HTML */ }
      }

      // HTML fallback
      const htmlMatch = text.match(/```html\s*([\s\S]+?)\s*```/i);
      if (htmlMatch?.[1]) {
        setAiHtml(htmlMatch[1]);
        return;
      }

      // If AI returned something but it's neither JSON nor HTML, treat as error
      setAiError("AI response could not be rendered as a chart. Try rephrasing.");
    } catch {
      setAiError("Request failed — check your connection.");
    } finally {
      setAiLoading(false);
    }
  }

  const inputCls = "px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-[var(--accent)]";
  const inputStyle = { background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
        <div>
          <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>Report Builder</h2>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--muted2)" }}>Slice and dice your fact data · orphaned rows shown in amber</p>
        </div>
        {orphanCount > 0 && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: `${ORPHAN_COLOR}20`, border: `1px solid ${ORPHAN_COLOR}`, color: ORPHAN_COLOR }}>
            ⚠ {orphanCount} orphaned {orphanCount === 1 ? "group" : "groups"}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Config row 1: table + metric + agg */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Table</p>
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              {(Object.keys(TABLE_META) as TableKey[]).map(t => (
                <button key={t} onClick={() => handleTableChange(t)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ background: table === t ? "var(--accent)" : "var(--card2)", color: table === t ? "#fff" : "var(--muted)" }}>
                  {TABLE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Metric</p>
            <div className="flex gap-2">
              <select value={agg} onChange={e => setAgg(e.target.value as AggType)} className={inputCls} style={inputStyle}>
                {(Object.keys(AGG_LABELS) as AggType[]).map(a => (
                  <option key={a} value={a}>{AGG_LABELS[a]}</option>
                ))}
              </select>
              <select value={metricCol} onChange={e => setMetricCol(e.target.value)} className={inputCls} style={inputStyle}>
                {meta.numericCols.map(c => (
                  <option key={c.col} value={c.col}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Group By</p>
            <select value={groupByCol} onChange={e => setGroupByCol(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">— No grouping —</option>
              {meta.dimLinks.map(d => (
                <option key={d.col} value={d.col}>{d.label}</option>
              ))}
              <option value={meta.dateCol}>Date ({meta.dateCol})</option>
            </select>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date Range</p>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} style={{ ...inputStyle, borderColor: dateFrom ? "var(--accent)" : "var(--border)" }} />
              <span className="text-xs" style={{ color: "var(--muted2)" }}>–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} style={{ ...inputStyle, borderColor: dateTo ? "var(--accent)" : "var(--border)" }} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs px-2 py-1.5 rounded" style={{ color: "var(--muted2)" }}>✕</button>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Chart</p>
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              {(["bar","line","pie","table"] as ChartType[]).map(ct => (
                <button key={ct} onClick={() => setChartType(ct)}
                  className="px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors"
                  style={{ background: chartType === ct ? "var(--accent)" : "var(--card2)", color: chartType === ct ? "#fff" : "var(--muted)" }}>
                  {ct}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results summary line */}
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted2)" }}>
          <span>{dateFilteredRecords.length} records</span>
          <span>·</span>
          <span>{results.length} groups</span>
          {orphanCount > 0 && (
            <>
              <span>·</span>
              <span style={{ color: ORPHAN_COLOR }}>⚠ {orphanCount} orphaned (FK not found in dimension table)</span>
            </>
          )}
          <button onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
            className="ml-auto px-2.5 py-1 rounded-lg border text-[10px] font-semibold"
            style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
            Sort {sortDir === "desc" ? "↓ High–Low" : "↑ Low–High"}
          </button>
        </div>

        {/* Chart / Table results */}
        {sortedResults.length > 0 && groupByCol && chartType !== "table" && (
          <div className="rounded-xl p-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            {chartType === "pie" ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sortedResults.slice(0, 12).map(r => ({ name: r._label, value: r._value }))}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {sortedResults.slice(0, 12).map((r, i) => (
                      <Cell key={i} fill={r._orphaned ? ORPHAN_COLOR : CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : chartType === "line" ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sortedResults.slice(0, 30).map(r => ({ name: r._label, [metricLabel]: r._value }))}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                  <Line type="monotone" dataKey={metricLabel} stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, Math.min(sortedResults.length * 28, 340))}>
                <BarChart data={sortedResults.slice(0, 20).map(r => ({ name: r._label, [metricLabel]: r._value, _orphaned: r._orphaned }))}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                  <Bar dataKey={metricLabel} radius={[3,3,0,0]}>
                    {sortedResults.slice(0, 20).map((r, i) => (
                      <Cell key={i} fill={r._orphaned ? ORPHAN_COLOR : CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Data table */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--border)" }}>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
                  {groupByCol ? (groupByDimLink?.label ?? groupByCol) : "All Records"}
                </th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
                  {AGG_LABELS[agg]} {metricLabel}
                </th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Records</th>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Dim Link</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((r, i) => (
                <tr key={i} className="border-b"
                  style={{
                    borderColor: "var(--border)",
                    background: r._orphaned ? `${ORPHAN_COLOR}12` : i % 2 === 1 ? "var(--card)" : "transparent",
                  }}>
                  <td className="px-3 py-2 font-medium" style={{ color: r._orphaned ? ORPHAN_COLOR : "var(--foreground)" }}>
                    {r._orphaned && <span className="mr-1.5 text-[10px]">⚠</span>}
                    {r._label}
                  </td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--accent)" }}>
                    {agg === "COUNT" ? String(r._value) : `${cur} ${fmt(r._value)}`}
                  </td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--muted2)" }}>{r._count}</td>
                  <td className="px-3 py-2">
                    {r._orphaned ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: `${ORPHAN_COLOR}20`, color: ORPHAN_COLOR }}>
                        No dim record
                      </span>
                    ) : groupByDimLink?.dimKey ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(16,185,129,0.12)", color: "var(--accent)" }}>
                        ✓ linked
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {sortedResults.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-xs" style={{ color: "var(--muted2)" }}>No data for selected filters</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* AI Graph request */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm">✦</span>
            <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Ask AI to visualise</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto" style={{ background: "rgba(139,92,246,0.15)", color: "var(--purple-c)", border: "1px solid rgba(139,92,246,0.3)" }}>AI</span>
          </div>
          <div className="flex gap-2">
            <input
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAiGraph()}
              placeholder={`e.g. "Show top 10 customers by revenue as a bar chart"`}
              className="flex-1 px-3 py-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-[var(--purple-c)]"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
            <button
              onClick={handleAiGraph}
              disabled={aiLoading || !aiQuery.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-lg transition-colors"
              style={{ background: "var(--purple-c)", color: "#fff", opacity: aiLoading || !aiQuery.trim() ? 0.5 : 1 }}>
              {aiLoading ? "…" : "Generate"}
            </button>
          </div>
          {aiError && <p className="text-xs" style={{ color: "var(--red-c)" }}>{aiError}</p>}

          {/* Structured chart */}
          {aiChart && (
            <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              {aiChart.title && (
                <p className="text-xs font-semibold px-3 pt-3 pb-1" style={{ color: "var(--foreground)" }}>{aiChart.title}</p>
              )}
              <div className="p-2">
                <AiChartRenderer spec={aiChart} cur={cur} />
              </div>
            </div>
          )}

          {/* HTML chart in sandboxed iframe */}
          {aiHtml && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <iframe
                srcDoc={aiHtml}
                sandbox="allow-scripts"
                className="w-full"
                style={{ height: 340, border: "none", background: "var(--card)" }}
                title="AI-generated chart"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
