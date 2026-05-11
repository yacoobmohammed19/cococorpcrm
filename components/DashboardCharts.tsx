"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { saveDashboardSettings } from "@/server-actions/settings";

// ── Types ────────────────────────────────────────────────────────────────────

type RawLead = {
  id: number; name: string; status_id: number; lead_date: string | null;
  opportunity_value: number | null; opportunity_weighted: number | null; weight: number | null;
  last_follow_up: string | null; contacted: boolean | null; responded: boolean | null;
  developed: boolean | null; completed: boolean | null; created_at: string | null;
  total_revenue: number | null;
};
type RawInvoice = {
  id: number; amount: number | null; status: string | null; transaction_date: string | null;
  customer_id: number | null; payment_type_id: number | null; due_date: string | null;
};
type RawCost = { id: number; amount: number | null; transaction_date: string | null; cost_category_id: number | null };
type RawCashflow = { id: number; balance: number; record_date: string; account_id: number | null };
type Dim = { id: number; name: string };

type Props = {
  rawLeads: RawLead[]; rawInvoices: RawInvoice[]; rawCosts: RawCost[]; rawCashflow: RawCashflow[];
  customers: Dim[]; statuses: Dim[]; paymentTypes: Dim[]; costCategories: Dim[]; accounts: Dim[];
  currency: string; orgName: string; bankBalance: number; bankLastDate: string | null;
  fiscalYearStart?: number;
  savedDashboardSettings: Record<string, unknown>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = ["#10b981", "#e84393", "#8b5cf6", "#f59e0b", "#06b6d4", "#ef4444", "#84cc16", "#f97316"];
const LS_SECTION_ORDER = "crm_dash_section_order";
const LS_CUSTOM_KPIS = "crm_dash_custom_kpis";
const LS_KPI_HIDDEN = "crm_dash_kpi_hidden";

type TableKey = "fact_leads" | "fact_invoices" | "fact_costs";
type AggType = "SUM" | "AVG" | "COUNT" | "COUNTDISTINCT" | "MIN" | "MAX";
type FormatType = "currency" | "number" | "percentage";
type CustomKpi = { id: string; name: string; table: TableKey; agg: AggType; column: string; filterCol: string; filterVals: string[]; format: FormatType; color: string; desc: string; };

const TABLE_LABELS: Record<TableKey, string> = { fact_leads: "Leads", fact_invoices: "Invoices", fact_costs: "Costs" };
const AGG_LABELS: Record<AggType, string> = { SUM: "Sum (total)", AVG: "Average", COUNT: "Count (rows)", COUNTDISTINCT: "Distinct Count", MIN: "Minimum", MAX: "Maximum" };
const KPI_COLOR_MAP: Record<string, string> = { green: "var(--accent)", cyan: "var(--cyan-c)", blue: "var(--cyan-c)", purple: "var(--purple-c)", amber: "var(--amber-c)", red: "var(--red-c)", pink: "var(--pink)" };

const DEFAULT_SECTIONS = ["summary", "revenue", "pipeline", "costs", "cashflow", "alerts"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDec = (n: number) => Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthLabel = (m: string) => {
  const [yr, mo] = m.split("-");
  return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mo] + " " + yr.slice(2);
};
const isCompleted = (status: string | null) => status === "Completed" || status === "Paid";
const isPending = (status: string | null) => status === "Pending";

function dateInRange(dateStr: string | null, from: string, to: string) {
  if (!dateStr) return true;
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function calcCustomMetric(kpi: Pick<CustomKpi, "table" | "agg" | "column" | "filterCol" | "filterVals">, tableMap: Record<TableKey, Record<string, unknown>[]>): number {
  let data = tableMap[kpi.table] || [];
  if (kpi.filterCol && kpi.filterVals?.length) data = data.filter(r => kpi.filterVals.includes(String(r[kpi.filterCol])));
  const vals = data.map(r => Number(r[kpi.column])).filter(v => !isNaN(v));
  switch (kpi.agg) {
    case "SUM": return vals.reduce((a, b) => a + b, 0);
    case "AVG": return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    case "COUNT": return data.length;
    case "MIN": return vals.length ? Math.min(...vals) : 0;
    case "MAX": return vals.length ? Math.max(...vals) : 0;
    case "COUNTDISTINCT": return new Set(data.map(r => r[kpi.column]).filter(v => v !== null && v !== undefined && v !== "")).size;
    default: return 0;
  }
}
function fmtCustomKpi(v: number, format: FormatType, cur: string): string {
  if (format === "currency") return `${cur} ${fmt(v)}`;
  if (format === "percentage") return `${(v * 100).toFixed(1)}%`;
  return fmt(v);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, onClick }: { label: string; value: string; sub?: string; color: string; onClick?: () => void }) {
  return (
    <div
      className={`rounded-xl p-4 transition-all ${onClick ? "cursor-pointer hover:scale-[1.02] hover:shadow-md" : ""}`}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderTop: `3px solid ${color}`,
        boxShadow: "var(--shadow-sm)",
      }}
      onClick={onClick}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted2)" }}>{label}</div>
      <div className="text-xl font-bold font-mono truncate leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] mt-1.5" style={{ color: "var(--muted2)" }}>{sub}</div>}
    </div>
  );
}

function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
      <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted2)" }}>{title}</h3>
      {children}
    </div>
  );
}

function Section({ id, title, children, order, totalSections, onMove, defaultOpen = true, action }: {
  id: string; title: string; children: React.ReactNode; order: number; totalSections: number;
  onMove: (id: string, dir: -1 | 1) => void; defaultOpen?: boolean; action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3">
      <div className="flex items-center rounded-xl text-sm font-semibold"
        style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <button onClick={() => setOpen(!open)}
          className="flex-1 flex justify-between items-center px-4 py-3 text-left"
          style={{ color: "var(--muted)" }}>
          <span>{title}</span>
          <span style={{ color: "var(--muted2)", fontSize: 10, transform: open ? "rotate(0)" : "rotate(-90deg)", display: "inline-block", transition: "transform .2s" }}>▼</span>
        </button>
        <div className="flex items-center gap-1 pr-2 shrink-0">
          {action}
          <button onClick={() => onMove(id, -1)} disabled={order === 0}
            className="w-6 h-6 rounded text-xs flex items-center justify-center disabled:opacity-30"
            style={{ color: "var(--muted2)", background: "var(--card3)" }}>▲</button>
          <button onClick={() => onMove(id, 1)} disabled={order === totalSections - 1}
            className="w-6 h-6 rounded text-xs flex items-center justify-center disabled:opacity-30"
            style={{ color: "var(--muted2)", background: "var(--card3)" }}>▼</button>
        </div>
      </div>
      {open && <div className="pt-3">{children}</div>}
    </div>
  );
}

// ── AI Insight Card ───────────────────────────────────────────────────────────

type InsightData = {
  revenue: number; opex: number; profit: number; margin: number; pending: number;
  overdueCount: number; overdueAmount: number; staleLeads: number; totalLeads: number; wonLeads: number; cur: string;
};

function AiInsightCard({ data }: { data: InsightData }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef(false);

  const fetchInsight = useCallback(async (force = false) => {
    const cacheKey = "crm_dash_insight_v2";
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) { setText(cached); return; }
      } catch { /* ignore */ }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dashboard",
          data: { revenue: data.revenue, opex: data.opex, profit: data.profit, margin: data.margin, pending: data.pending, overdueCount: data.overdueCount, overdueAmount: data.overdueAmount, staleLeads: data.staleLeads, totalLeads: data.totalLeads, wonLeads: data.wonLeads, currency: data.cur },
        }),
      });
      const json = await res.json() as { result?: string; error?: string };
      if (json.result) {
        setText(json.result);
        try { sessionStorage.setItem(cacheKey, json.result); } catch { /* ignore */ }
      } else {
        setError(json.error || "Could not generate insight");
      }
    } catch {
      setError("Could not reach AI service");
    } finally {
      setLoading(false);
    }
  }, [data.revenue, data.opex, data.profit, data.margin, data.pending, data.overdueCount, data.overdueAmount, data.staleLeads, data.totalLeads, data.wonLeads, data.cur]);

  useEffect(() => {
    if (!fetched.current) { fetched.current = true; fetchInsight(); }
  }, [fetchInsight]);

  return (
    <div className="rounded-xl p-4 mb-3" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", borderLeft: "3px solid var(--accent)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 14 }}>✨</span>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>AI Business Insight</span>
        </div>
        <button
          onClick={() => fetchInsight(true)}
          disabled={loading}
          title="Refresh insight"
          className="text-xs px-2 py-0.5 rounded transition-opacity hover:opacity-80"
          style={{ color: "var(--muted2)", border: "1px solid var(--border)", background: "var(--card3)", opacity: loading ? 0.5 : 1 }}
        >
          {loading ? "…" : "↻ Refresh"}
        </button>
      </div>
      {loading && (
        <div className="space-y-1.5">
          {[100, 85, 60].map(w => (
            <div key={w} className="h-3.5 rounded animate-pulse" style={{ background: "var(--card3)", width: `${w}%` }} />
          ))}
        </div>
      )}
      {!loading && text && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{text}</p>
      )}
      {!loading && error && (
        <p className="text-xs" style={{ color: "var(--red-c)" }}>{error}</p>
      )}
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

type Filters = {
  dateFrom: string; dateTo: string;
  statusIds: number[];
  customerIds: number[];
  costCategoryIds: number[];
  accountIds: number[];
  invoiceStatuses: string[];
  paymentTypeIds: number[];
};
const EMPTY_FILTERS: Filters = {
  dateFrom: "", dateTo: "", statusIds: [],
  customerIds: [], costCategoryIds: [], accountIds: [],
  invoiceStatuses: [], paymentTypeIds: [],
};

function FilterBar({ filters, setFilters, statuses, customers, costCategories, accounts, paymentTypes, fiscalYearStart }: {
  filters: Filters; setFilters: (f: Filters) => void;
  statuses: Dim[]; customers: Dim[]; costCategories: Dim[]; accounts: Dim[]; paymentTypes: Dim[];
  fiscalYearStart?: number;
}) {
  const set = (partial: Partial<Filters>) => setFilters({ ...filters, ...partial });
  const clear = () => setFilters(EMPTY_FILTERS);

  const activeCount = [
    filters.dateFrom || filters.dateTo,
    filters.statusIds.length > 0,
    filters.customerIds.length > 0,
    filters.costCategoryIds.length > 0,
    filters.accountIds.length > 0,
    filters.invoiceStatuses.length > 0,
    filters.paymentTypeIds.length > 0,
  ].filter(Boolean).length;

  const now = new Date();
  const fyMonth = (fiscalYearStart ?? 3) - 1;
  const getFyStart = () => {
    const y = now.getMonth() >= fyMonth ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(y, fyMonth, 1).toISOString().slice(0, 10);
  };
  const presets: { key: string; label: string; from: string; to: string }[] = [
    { key: "30d", label: "30d", from: (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })(), to: "" },
    { key: "90d", label: "90d", from: (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })(), to: "" },
    { key: "12M", label: "12M", from: (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })(), to: "" },
    { key: "YTD", label: "YTD", from: `${now.getFullYear()}-01-01`, to: "" },
    { key: "FY",  label: "FY",  from: getFyStart(), to: "" },
    { key: "All", label: "All", from: "", to: "" },
  ];

  return (
    <div className="mb-4 space-y-2">
      {/* Row 1 — date presets + custom date range */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Period</span>
        <div className="flex rounded overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {presets.map(p => {
            const active = p.key === "All"
              ? !filters.dateFrom && !filters.dateTo
              : filters.dateFrom === p.from && filters.dateTo === p.to;
            return (
              <button key={p.key} onClick={() => set({ dateFrom: p.from, dateTo: p.to })}
                className="px-2.5 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: active ? "var(--accent)" : "var(--card2)", color: active ? "#fff" : "var(--muted2)" }}>
                {p.label}
              </button>
            );
          })}
        </div>
        <input type="date" value={filters.dateFrom} onChange={e => set({ dateFrom: e.target.value })}
          className="px-2 py-1.5 rounded text-xs border outline-none"
          style={{ background: "var(--card2)", borderColor: filters.dateFrom ? "var(--accent)" : "var(--border)", color: "var(--foreground)" }} />
        <span className="text-xs" style={{ color: "var(--muted2)" }}>→</span>
        <input type="date" value={filters.dateTo} onChange={e => set({ dateTo: e.target.value })}
          className="px-2 py-1.5 rounded text-xs border outline-none"
          style={{ background: "var(--card2)", borderColor: filters.dateTo ? "var(--accent)" : "var(--border)", color: "var(--foreground)" }} />
        {activeCount > 0 && (
          <button onClick={clear} className="px-2 py-1.5 rounded text-xs font-semibold"
            style={{ color: "var(--muted2)", border: "1px solid var(--border)" }}>
            ✕ Clear{activeCount > 1 ? ` (${activeCount})` : ""}
          </button>
        )}
      </div>

      {/* Row 2 — dimension multiselects, always visible */}
      <div className="flex flex-wrap items-center gap-2">
        {customers.length > 0 && (
          <MultiSelect label="Customer" options={customers.map(c => ({ label: c.name, value: String(c.id) }))}
            value={filters.customerIds.map(String)} onChange={vals => set({ customerIds: vals.map(Number) })} minWidth={180} />
        )}
        <MultiSelect label="Invoice Status"
          options={[
            { label: "Completed", value: "Completed", color: "var(--accent)" },
            { label: "Pending", value: "Pending", color: "var(--amber-c)" },
            { label: "Written Off", value: "Written Off", color: "var(--red-c)" },
          ]}
          value={filters.invoiceStatuses} onChange={vals => set({ invoiceStatuses: vals })} />
        {statuses.length > 0 && (
          <MultiSelect label="Lead Status" options={statuses.map(s => ({ label: s.name, value: String(s.id) }))}
            value={filters.statusIds.map(String)} onChange={vals => set({ statusIds: vals.map(Number) })} />
        )}
        {paymentTypes.length > 0 && (
          <MultiSelect label="Pay Type" options={paymentTypes.map(p => ({ label: p.name, value: String(p.id) }))}
            value={filters.paymentTypeIds.map(String)} onChange={vals => set({ paymentTypeIds: vals.map(Number) })} />
        )}
        {costCategories.length > 0 && (
          <MultiSelect label="Cost Category" options={costCategories.map(c => ({ label: c.name, value: String(c.id) }))}
            value={filters.costCategoryIds.map(String)} onChange={vals => set({ costCategoryIds: vals.map(Number) })} />
        )}
        {accounts.length > 0 && (
          <MultiSelect label="Account" options={accounts.map(a => ({ label: a.name, value: String(a.id) }))}
            value={filters.accountIds.map(String)} onChange={vals => set({ accountIds: vals.map(Number) })} />
        )}
      </div>
    </div>
  );
}

// ── Custom KPI Builder ────────────────────────────────────────────────────────

function CustomKpiBuilder({ onClose, onSave, tableMap, dimMaps, cur }: {
  onClose: () => void;
  onSave: (kpi: CustomKpi) => void;
  tableMap: Record<TableKey, Record<string, unknown>[]>;
  dimMaps: Record<string, Record<number, string>>;
  cur: string;
}) {
  const [name, setName] = useState("");
  const [table, setTable] = useState<TableKey>("fact_invoices");
  const [agg, setAgg] = useState<AggType>("SUM");
  const [column, setColumn] = useState("");
  const [filterCol, setFilterCol] = useState("");
  const [filterVals, setFilterVals] = useState<string[]>([]);
  const [format, setFormat] = useState<FormatType>("currency");
  const [color, setColor] = useState("green");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    const data = tableMap[table] || [];
    const cols = data.length ? Object.keys(data[0]) : [];
    const numericCols = cols.filter(c => {
      const sample = data.find(r => r[c] !== null && r[c] !== "" && r[c] !== undefined);
      return sample !== undefined && !isNaN(Number(sample[c]));
    });
    setColumn(numericCols[0] || "");
    setFilterCol("");
    setFilterVals([]);
  }, [table, tableMap]);

  const tableData = tableMap[table] || [];
  const allCols = tableData.length ? Object.keys(tableData[0]) : [];
  const numCols = allCols.filter(c => {
    const sample = tableData.find(r => r[c] !== null && r[c] !== "" && r[c] !== undefined);
    return sample !== undefined && !isNaN(Number(sample[c]));
  });
  const colOptions = (agg === "COUNT" || agg === "COUNTDISTINCT") ? allCols : numCols;

  const availFilterVals = filterCol
    ? [...new Set(tableData.map(r => { const v = r[filterCol]; return v === null || v === undefined || v === "" ? null : String(v); }).filter((v): v is string => v !== null))].sort()
    : [];

  const previewVal = useMemo(() =>
    column ? calcCustomMetric({ table, agg, column, filterCol, filterVals }, tableMap) : 0,
    [table, agg, column, filterCol, filterVals, tableMap]
  );

  const inp = { background: "var(--card3)", border: "1px solid var(--border)", color: "var(--foreground)" } as const;
  const lbl = { color: "var(--muted2)" } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold text-sm">Add Dashboard Metric</h2>
          <button onClick={onClose} style={{ color: "var(--muted2)" }}>✕</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Step 1 */}
          <div>
            <p className="text-xs font-bold mb-1.5" style={lbl}>1. Name your metric</p>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Total Monthly Revenue"
              className="w-full px-3 py-2 rounded text-sm" style={inp} />
          </div>
          {/* Step 2 */}
          <div>
            <p className="text-xs font-bold mb-1.5" style={lbl}>2. Choose data source</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] mb-1 font-semibold uppercase" style={lbl}>Table</label>
                <select value={table} onChange={e => setTable(e.target.value as TableKey)} className="w-full px-2 py-2 rounded text-xs" style={inp}>
                  {(Object.keys(TABLE_LABELS) as TableKey[]).map(k => <option key={k} value={k}>{TABLE_LABELS[k]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] mb-1 font-semibold uppercase" style={lbl}>Calculation</label>
                <select value={agg} onChange={e => setAgg(e.target.value as AggType)} className="w-full px-2 py-2 rounded text-xs" style={inp}>
                  {(Object.keys(AGG_LABELS) as AggType[]).map(k => <option key={k} value={k}>{AGG_LABELS[k]}</option>)}
                </select>
              </div>
            </div>
          </div>
          {/* Step 3 */}
          <div>
            <p className="text-xs font-bold mb-1.5" style={lbl}>3. Choose column</p>
            <select value={column} onChange={e => setColumn(e.target.value)} className="w-full px-2 py-2 rounded text-xs" style={inp}>
              {colOptions.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          {/* Step 4 */}
          <div>
            <p className="text-xs font-bold mb-1.5" style={lbl}>4. Filter (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] mb-1 font-semibold uppercase" style={lbl}>Filter Column</label>
                <select value={filterCol} onChange={e => { setFilterCol(e.target.value); setFilterVals([]); }} className="w-full px-2 py-2 rounded text-xs" style={inp}>
                  <option value="">No filter</option>
                  {allCols.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] mb-1 font-semibold uppercase" style={lbl}>Filter Values</label>
                {filterCol ? (
                  <MultiSelect
                    label="Any"
                    options={(() => {
                      const dm = dimMaps[filterCol];
                      return availFilterVals.map(v => ({
                        label: dm ? String(dm[Number(v)] ?? v) : v,
                        value: v,
                      }));
                    })()}
                    value={filterVals}
                    onChange={setFilterVals}
                  />
                ) : (
                  <div className="px-2 py-2 rounded text-xs" style={{ ...inp, opacity: 0.4 }}>— select column first —</div>
                )}
              </div>
            </div>
          </div>
          {/* Step 5 */}
          <div>
            <p className="text-xs font-bold mb-1.5" style={lbl}>5. Display</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-[10px] mb-1 font-semibold uppercase" style={lbl}>Format</label>
                <select value={format} onChange={e => setFormat(e.target.value as FormatType)} className="w-full px-2 py-2 rounded text-xs" style={inp}>
                  <option value="currency">Currency</option>
                  <option value="number">Number</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] mb-1 font-semibold uppercase" style={lbl}>Color</label>
                <select value={color} onChange={e => setColor(e.target.value)} className="w-full px-2 py-2 rounded text-xs" style={inp}>
                  {Object.keys(KPI_COLOR_MAP).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] mb-1 font-semibold uppercase" style={lbl}>Subtitle</label>
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="optional" className="w-full px-2 py-2 rounded text-xs" style={inp} />
              </div>
            </div>
            {/* Live preview */}
            <div className="rounded-lg p-3 text-center" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
              <div className="text-lg font-bold font-mono" style={{ color: KPI_COLOR_MAP[color] || "var(--accent)" }}>
                {fmtCustomKpi(previewVal, format, cur)}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>
                {agg} of {(column || "—").replace(/_/g, " ")}
                {filterCol && filterVals.length > 0 ? ` where ${filterCol.replace(/_/g, " ")} in [${filterVals.length}]` : filterCol ? ` (no filter value — all rows)` : ""}
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 pt-2 flex gap-2 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="flex-1 py-2 rounded text-sm font-semibold"
            style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
          <button onClick={() => { if (!name.trim() || !column) return; onSave({ id: Date.now().toString(), name, table, agg, column, filterCol, filterVals, format, color, desc }); onClose(); }}
            disabled={!name.trim() || !column}
            className="flex-1 py-2 rounded text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}>Add Metric</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}

export function DashboardCharts({
  rawLeads, rawInvoices, rawCosts, rawCashflow,
  customers, statuses, paymentTypes, costCategories, accounts,
  currency, orgName, bankBalance, bankLastDate, fiscalYearStart,
  savedDashboardSettings,
}: Props) {
  const cur = currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "R";

  // ── Persisted state — DB is source of truth for customKpis ───────────────
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => readLS(LS_SECTION_ORDER, DEFAULT_SECTIONS));
  const [customKpis, setCustomKpis] = useState<CustomKpi[]>(() => {
    const fromDb = savedDashboardSettings?.customKpis;
    if (Array.isArray(fromDb) && fromDb.length > 0) return fromDb as CustomKpi[];
    return readLS(LS_CUSTOM_KPIS, [] as CustomKpi[]);
  });
  const [hiddenKpis, setHiddenKpis] = useState<string[]>(() => readLS(LS_KPI_HIDDEN, [] as string[]));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showKpiConfig, setShowKpiConfig] = useState(false);
  const [showKpiBuilder, setShowKpiBuilder] = useState(false);
  const [nowMs] = useState(() => Date.now());

  // Reactive theme detection so recharts colours update when user toggles theme
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const TT_STYLE = isDark
    ? { background: "#171535", border: "1px solid #2D2860", borderRadius: 6, color: "#f0f0fc", fontSize: 11 }
    : { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6, color: "#0F172A", fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" };
  const TICK_STYLE = { fill: isDark ? "#8a84b0" : "#94A3B8", fontSize: 10 };
  const GRID_COLOR = isDark ? "#1e1b45" : "#E2E8F0";
  const LEGEND_STYLE = { fontSize: 10, color: isDark ? "#8a84b0" : "#94A3B8" };

  const saveCustomKpis = (kpis: CustomKpi[]) => {
    setCustomKpis(kpis);
    try { localStorage.setItem(LS_CUSTOM_KPIS, JSON.stringify(kpis)); } catch { /* ignore */ }
    // Debounce DB save so rapid adds/removes don't hammer the server
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const next = { ...savedDashboardSettings, customKpis: kpis };
      saveDashboardSettings(next).catch(() => { /* silent — localStorage still has it */ });
    }, 800);
  };
  const toggleKpiHidden = (key: string) => {
    const next = hiddenKpis.includes(key) ? hiddenKpis.filter(k => k !== key) : [...hiddenKpis, key];
    setHiddenKpis(next);
    try { localStorage.setItem(LS_KPI_HIDDEN, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const moveSection = useCallback((id: string, dir: -1 | 1) => {
    setSectionOrder(prev => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      try { localStorage.setItem(LS_SECTION_ORDER, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Dimension lookups ────────────────────────────────────────────────────
  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c.name])), [customers]);
  const statusMap = useMemo(() => Object.fromEntries(statuses.map(s => [s.id, s.name])), [statuses]);
  const payTypeMap = useMemo(() => Object.fromEntries(paymentTypes.map(p => [p.id, p.name])), [paymentTypes]);
  const catMap = useMemo(() => Object.fromEntries(costCategories.map(c => [c.id, c.name])), [costCategories]);


  const wonStatusId = statuses.find(s => s.name === "Closed Won")?.id ?? 3;
  const lostStatusId = statuses.find(s => s.name === "Closed Lost")?.id ?? 4;

  // ── Filtered data ────────────────────────────────────────────────────────
  const fLeads = useMemo(() => rawLeads.filter(l => {
    if (filters.statusIds.length > 0 && !filters.statusIds.includes(l.status_id)) return false;
    if (!dateInRange(l.lead_date, filters.dateFrom, filters.dateTo)) return false;
    return true;
  }), [rawLeads, filters]);

  const fInvoices = useMemo(() => rawInvoices.filter(inv => {
    if (!dateInRange(inv.transaction_date, filters.dateFrom, filters.dateTo)) return false;
    if (filters.customerIds.length > 0 && !filters.customerIds.includes(inv.customer_id!)) return false;
    if (filters.invoiceStatuses.length > 0 && !filters.invoiceStatuses.includes(inv.status!)) return false;
    if (filters.paymentTypeIds.length > 0 && !filters.paymentTypeIds.includes(inv.payment_type_id!)) return false;
    return true;
  }), [rawInvoices, filters]);

  const fCosts = useMemo(() => rawCosts.filter(c => {
    if (!dateInRange(c.transaction_date, filters.dateFrom, filters.dateTo)) return false;
    if (filters.costCategoryIds.length > 0 && !filters.costCategoryIds.includes(c.cost_category_id!)) return false;
    return true;
  }), [rawCosts, filters]);

  const fCashflow = useMemo(() => {
    if (filters.accountIds.length === 0) return rawCashflow;
    return rawCashflow.filter(e => filters.accountIds.includes(e.account_id!));
  }, [rawCashflow, filters]);

  // ── Derived KPIs ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const completedInv = fInvoices.filter(i => isCompleted(i.status));
    const pendingInv = fInvoices.filter(i => isPending(i.status));
    const revenue = completedInv.reduce((s, i) => s + Number(i.amount || 0), 0);
    const pending = pendingInv.reduce((s, i) => s + Number(i.amount || 0), 0);
    const opex = fCosts.reduce((s, c) => s + Number(c.amount || 0), 0);
    const profit = revenue - opex;
    const margin_pct = revenue > 0 ? profit / revenue * 100 : 0;
    const wonLeads = fLeads.filter(l => l.status_id === wonStatusId);
    const openLeads = fLeads.filter(l => l.status_id !== wonStatusId && l.status_id !== lostStatusId && l.status_id !== 5);
    // pipelineValue = ALL filtered leads' weighted opportunity (matches index.html)
    const pipeline = fLeads.reduce((s, l) => s + Number(l.opportunity_weighted || 0), 0);
    // avgDeal uses total_revenue across all filtered leads ÷ won count (matches index.html)
    const totalRevenue = fLeads.reduce((s, l) => s + Number(l.total_revenue || 0), 0);
    const avg_deal = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0;
    const conversion_pct = fLeads.length > 0 ? wonLeads.length / fLeads.length * 100 : 0;

    // Cashflow: latest per account (filtered)
    const latestByAcct: Record<string, number> = {};
    for (const e of fCashflow) {
      const key = String(e.account_id ?? "unassigned");
      if (!latestByAcct[key]) latestByAcct[key] = e.balance;
    }
    const bank_balance_filtered = Object.values(latestByAcct).reduce((s, b) => s + b, 0);

    return {
      revenue, opex, profit, margin_pct, pipeline, avg_deal, pending,
      total_leads: fLeads.length, won_leads: wonLeads.length, open_leads: openLeads.length,
      conversion_pct, total_customers: customers.length, total_invoices: fInvoices.length,
      bank_balance: filters.accountIds.length > 0 ? bank_balance_filtered : bankBalance,
      completedInv, pendingInv, openLeads, wonLeads,
    };
  }, [fLeads, fInvoices, fCosts, fCashflow, wonStatusId, lostStatusId, customers, bankBalance, filters]);

  // ── Custom KPI evaluation (table-based, matches index.html calcMetric) ───
  const tableMap = useMemo<Record<TableKey, Record<string, unknown>[]>>(() => ({
    fact_leads: rawLeads as Record<string, unknown>[],
    fact_invoices: rawInvoices as Record<string, unknown>[],
    fact_costs: rawCosts as Record<string, unknown>[],
  }), [rawLeads, rawInvoices, rawCosts]);

  const dimMaps = useMemo(() => ({
    status_id: statusMap as Record<number, string>,
    payment_type_id: payTypeMap as Record<number, string>,
    cost_category_id: catMap as Record<number, string>,
    customer_id: customerMap as Record<number, string>,
  }), [statusMap, payTypeMap, catMap, customerMap]);

  // ── Chart data ───────────────────────────────────────────────────────────
  const months12 = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (11 - i));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }), []);

  const monthlyData = useMemo(() => {
    const rev: Record<string, number> = {};
    const cost: Record<string, number> = {};
    months12.forEach(m => { rev[m] = 0; cost[m] = 0; });
    metrics.completedInv.forEach(inv => {
      const m = inv.transaction_date?.slice(0, 7);
      if (m && rev[m] !== undefined) rev[m] += Number(inv.amount || 0);
    });
    fCosts.forEach(c => {
      const m = c.transaction_date?.slice(0, 7);
      if (m && cost[m] !== undefined) cost[m] += Number(c.amount || 0);
    });
    return months12.map(m => ({
      month: monthLabel(m), fullMonth: m,
      Revenue: rev[m], Costs: cost[m], Profit: rev[m] - cost[m],
    }));
  }, [metrics.completedInv, fCosts, months12]);

  const leadsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    fLeads.forEach(l => {
      const name = statusMap[l.status_id] || "Unknown";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [fLeads, statusMap]);

  const costsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    fCosts.forEach(c => {
      const name = c.cost_category_id ? (catMap[c.cost_category_id] || `Cat ${c.cost_category_id}`) : "Uncategorised";
      map[name] = (map[name] || 0) + Number(c.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fCosts, catMap]);

  const revenueByCustomer = useMemo(() => {
    const map: Record<number, number> = {};
    metrics.completedInv.forEach(inv => {
      if (inv.customer_id) map[inv.customer_id] = (map[inv.customer_id] || 0) + Number(inv.amount || 0);
    });
    return Object.entries(map)
      .map(([id, value]) => ({ name: customerMap[+id] || `#${id}`, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [metrics.completedInv, customerMap]);

  const revenueByPayType = useMemo(() => {
    const map: Record<string, number> = {};
    metrics.completedInv.forEach(inv => {
      const name = inv.payment_type_id ? (payTypeMap[inv.payment_type_id] || `Type ${inv.payment_type_id}`) : "Unspecified";
      map[name] = (map[name] || 0) + Number(inv.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [metrics.completedInv, payTypeMap]);

  const cashflowTrend = useMemo(() => {
    const byDate: Record<string, number> = {};
    [...fCashflow].reverse().forEach(e => {
      const d = e.record_date?.slice(0, 10) || "";
      byDate[d] = (byDate[d] || 0) + Number(e.balance);
    });
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
      .slice(-30).map(([date, balance]) => ({ date: date.slice(5), balance }));
  }, [fCashflow]);

  const pipelineByStatus = useMemo(() => {
    const map: Record<string, { count: number; weighted: number; value: number }> = {};
    metrics.openLeads.forEach(l => {
      const name = statusMap[l.status_id] || "Unknown";
      if (!map[name]) map[name] = { count: 0, weighted: 0, value: 0 };
      map[name].count++;
      map[name].weighted += Number(l.opportunity_weighted || 0);
      map[name].value += Number(l.opportunity_value || 0);
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d }));
  }, [metrics.openLeads, statusMap]);

  const funnel = useMemo(() => [
    { name: "Contacted", value: fLeads.filter(l => l.contacted).length },
    { name: "Responded", value: fLeads.filter(l => l.responded).length },
    { name: "Developed", value: fLeads.filter(l => l.developed).length },
    { name: "Completed", value: fLeads.filter(l => l.completed).length },
    { name: "Won", value: metrics.won_leads },
  ], [fLeads, metrics.won_leads]);
  const funnelMax = Math.max(1, ...funnel.map(f => f.value));

  // ── Alerts ───────────────────────────────────────────────────────────────
  const overdueInvoices = useMemo(() => metrics.pendingInv
    .filter(inv => {
      const d = inv.due_date || inv.transaction_date;
      if (!d) return false;
      return (nowMs - new Date(d).getTime()) / 86400000 > 30;
    })
    .map(inv => ({
      id: inv.id, amount: Number(inv.amount || 0),
      customerName: customerMap[inv.customer_id!] || "Unknown",
      days: Math.floor((nowMs - new Date(inv.due_date || inv.transaction_date || "").getTime()) / 86400000),
    }))
    .sort((a, b) => b.days - a.days).slice(0, 10),
  [metrics.pendingInv, customerMap, nowMs]);

  const staleLeads = useMemo(() => metrics.openLeads
    .filter(l => !l.last_follow_up || (nowMs - new Date(l.last_follow_up).getTime()) / 86400000 > 7)
    .map(l => ({ id: l.id, name: l.name, days: l.last_follow_up ? Math.floor((nowMs - new Date(l.last_follow_up).getTime()) / 86400000) : null }))
    .slice(0, 10),
  [metrics.openLeads, nowMs]);

  // ── Monthly table ────────────────────────────────────────────────────────
  const monthlyTable = [...monthlyData].reverse().map((row, i, arr) => {
    const prevRev = arr[i + 1]?.Revenue ?? null;
    const mom = prevRev !== null && prevRev > 0 ? ((row.Revenue - prevRev) / prevRev * 100) : null;
    return { ...row, mom };
  });

  // ── Standard KPI cards ───────────────────────────────────────────────────
  const profitColor = metrics.profit >= 0 ? "var(--accent)" : "var(--red-c)";
  const convColor = metrics.conversion_pct >= 10 ? "var(--accent)" : "var(--amber-c)";

  // KPI order matches index.html KPI_DEFS exactly
  const builtinKpis = [
    { key: "total_leads", label: "Total Leads", value: String(metrics.total_leads), sub: `${metrics.open_leads} open`, color: "var(--cyan-c)" },
    { key: "won_leads", label: "Won", value: String(metrics.won_leads), sub: `of ${metrics.total_leads}`, color: "var(--accent)" },
    { key: "conversion_pct", label: "Conversion", value: `${metrics.conversion_pct.toFixed(1)}%`, sub: `${metrics.won_leads}/${metrics.total_leads}`, color: convColor },
    { key: "revenue", label: "Revenue", value: `${cur} ${fmt(metrics.revenue)}`, sub: `${cur} ${fmt(metrics.pending)} pending`, color: "var(--accent)" },
    { key: "opex", label: "OPEX", value: `${cur} ${fmt(metrics.opex)}`, sub: "", color: "var(--red-c)" },
    { key: "profit", label: "Profit", value: `${cur} ${fmt(metrics.profit)}`, sub: `Margin: ${metrics.margin_pct.toFixed(1)}%`, color: profitColor },
    { key: "pipeline", label: "Pipeline", value: `${cur} ${fmt(metrics.pipeline)}`, sub: "", color: "var(--purple-c)" },
    { key: "avg_deal", label: "Avg Deal", value: `${cur} ${fmt(metrics.avg_deal)}`, sub: `${metrics.won_leads} deals`, color: "var(--amber-c)" },
    { key: "total_customers", label: "Customers", value: String(metrics.total_customers), sub: `${metrics.total_invoices} inv`, color: "var(--cyan-c)" },
    // Extended KPIs (hidden by default in configure panel — users can toggle)
    { key: "pending", label: "Pending", value: `${cur} ${fmt(metrics.pending)}`, sub: "awaiting payment", color: "var(--amber-c)" },
    { key: "bank_balance", label: "Bank Balance", value: metrics.bank_balance > 0 ? `${cur} ${fmt(metrics.bank_balance)}` : "—", sub: bankLastDate ? new Date(bankLastDate).toLocaleDateString("en-ZA") : "", color: metrics.bank_balance > 0 ? "var(--accent)" : "var(--muted2)" },
  ];
  const visibleKpis = builtinKpis.filter(k => !hiddenKpis.includes(k.key));

  // ── Section render helpers ───────────────────────────────────────────────
  const sProps = (id: string, i: number) => ({
    id, order: i, totalSections: sectionOrder.length, onMove: moveSection,
  });

  const calcCashflow = metrics.revenue - metrics.opex;
  const cfVariance = bankBalance - calcCashflow;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--card2)", color: "var(--muted2)", border: "1px solid var(--border)" }}>
          {orgName}
        </span>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} setFilters={setFilters}
        statuses={statuses} customers={customers} costCategories={costCategories} accounts={accounts} paymentTypes={paymentTypes}
        fiscalYearStart={fiscalYearStart} />

      {/* Sections in order */}
      {sectionOrder.map((sectionId, idx) => {
        if (sectionId === "summary") return (
          <Section key="summary" title="📊 Executive Summary" {...sProps("summary", idx)}
            action={
              <button onClick={() => setShowKpiConfig(true)}
                className="px-2 py-1 rounded text-xs font-semibold mr-1"
                style={{ background: "var(--card3)", color: "var(--muted2)", border: "1px solid var(--border)" }}>
                ⚙ Configure
              </button>
            }>
            {visibleKpis.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 mb-3">
                {visibleKpis.map(k => <KpiCard key={k.key} label={k.label} value={k.value} sub={k.sub} color={k.color} />)}
              </div>
            )}
            {/* Custom KPIs */}
            {customKpis.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 mb-3">
                {customKpis.map(kpi => {
                  const val = calcCustomMetric(kpi, tableMap);
                  const formatted = fmtCustomKpi(val, kpi.format ?? "number", cur);
                  return (
                    <div key={kpi.id} className="relative group">
                      <KpiCard label={kpi.name} value={formatted}
                        sub={kpi.desc || kpi.agg}
                        color={KPI_COLOR_MAP[kpi.color] || "var(--pink)"} />
                      <button
                        onClick={() => saveCustomKpis(customKpis.filter(k => k.id !== kpi.id))}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full text-xs items-center justify-center hidden group-hover:flex"
                        style={{ background: "var(--red-c)", color: "#fff" }}
                        title="Remove metric">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => setShowKpiBuilder(true)}
              className="px-3 py-1.5 rounded text-xs font-semibold"
              style={{ background: "rgba(232,67,147,.1)", color: "var(--pink)", border: "1px solid var(--pink)" }}>
              + Add Metric
            </button>
            <div className="mt-3">
              <AiInsightCard data={{
                revenue: metrics.revenue, opex: metrics.opex, profit: metrics.profit,
                margin: metrics.margin_pct, pending: metrics.pending,
                overdueCount: overdueInvoices.length,
                overdueAmount: overdueInvoices.reduce((s, i) => s + i.amount, 0),
                staleLeads: staleLeads.length,
                totalLeads: metrics.total_leads, wonLeads: metrics.won_leads,
                cur,
              }} />
            </div>
          </Section>
        );

        if (sectionId === "revenue") return (
          <Section key="revenue" title="📈 Revenue & Costs" {...sProps("revenue", idx)}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <ChartBox title="Monthly Revenue vs Costs (12 months)">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis dataKey="month" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                    <Bar dataKey="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Costs" fill="rgba(239,68,68,.5)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
              <ChartBox title="Monthly Profit">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis dataKey="month" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                    <Area dataKey="Profit" stroke="#8b5cf6" fill="rgba(139,92,246,.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartBox>
              <ChartBox title="Revenue by Customer (Top 8)">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revenueByCustomer} layout="vertical" margin={{ left: 0 }}>
                    <XAxis type="number" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} width={90} />
                    <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                    <Bar dataKey="value" fill="rgba(16,185,129,.7)" radius={3} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
              <ChartBox title="Revenue by Payment Type">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={revenueByPayType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                      {revenueByPayType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                    <Legend iconSize={8} wrapperStyle={LEGEND_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>
            {/* Monthly table */}
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Monthly Performance</h3>
              </div>
              <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
                      {["Month", "Revenue", "Costs", "Profit", "Margin", "MoM %"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTable.map(row => {
                      const margin = row.Revenue > 0 ? row.Profit / row.Revenue * 100 : 0;
                      return (
                        <tr key={row.fullMonth} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                          <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: "var(--muted)" }}>{row.month}</td>
                          <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: "var(--accent)" }}>{cur} {fmt(row.Revenue)}</td>
                          <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: "var(--red-c)" }}>{cur} {fmt(row.Costs)}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold whitespace-nowrap" style={{ color: row.Profit >= 0 ? "var(--accent)" : "var(--red-c)" }}>{cur} {fmt(row.Profit)}</td>
                          <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: margin >= 0 ? "var(--accent)" : "var(--red-c)" }}>{fmtDec(margin)}%</td>
                          <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: row.mom === null ? "var(--muted2)" : row.mom >= 0 ? "var(--accent)" : "var(--red-c)" }}>
                            {row.mom === null ? "—" : `${row.mom >= 0 ? "+" : ""}${row.mom.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        );

        if (sectionId === "pipeline") return (
          <Section key="pipeline" title="🔻 Sales Funnel & Pipeline" {...sProps("pipeline", idx)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <ChartBox title="Sales Funnel">
                {funnel.map(({ name, value }, i) => (
                  <div key={name} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-right w-20 shrink-0" style={{ color: "var(--muted2)" }}>{name}</span>
                    <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: "var(--card3)" }}>
                      <div className="h-full rounded flex items-center px-2 text-xs font-semibold text-white transition-all"
                        style={{ width: `${Math.max(value / funnelMax * 100, 4)}%`, background: COLORS[i % COLORS.length] }}>
                        {value}
                      </div>
                    </div>
                    <span className="text-xs w-8 text-right font-mono shrink-0" style={{ color: "var(--muted2)" }}>
                      {funnelMax > 0 ? Math.round(value / funnel[0].value * 100) : 0}%
                    </span>
                  </div>
                ))}
              </ChartBox>
              <ChartBox title="Leads by Status">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={leadsByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                      {leadsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TT_STYLE} />
                    <Legend iconSize={8} wrapperStyle={LEGEND_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>
            {/* Pipeline by status */}
            {pipelineByStatus.length > 0 && (
              <ChartBox title="Pipeline Weighted Value by Status">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={pipelineByStatus} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                    <Bar dataKey="weighted" name="Weighted" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="value" name="Total Value" fill="rgba(139,92,246,.3)" radius={[3, 3, 0, 0]} />
                    <Legend iconSize={8} wrapperStyle={LEGEND_STYLE} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
            )}
          </Section>
        );

        if (sectionId === "costs") return (
          <Section key="costs" title="💸 Cost Breakdown" {...sProps("costs", idx)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartBox title="Costs by Category">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={costsByCategory} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name">
                      {costsByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                    <Legend iconSize={8} wrapperStyle={LEGEND_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartBox>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Category Breakdown</span>
                </div>
                <div className="overflow-y-auto max-h-56" style={{ background: "var(--card2)" }}>
                  {costsByCategory.length === 0 && <p className="p-4 text-xs" style={{ color: "var(--muted2)" }}>No costs in period</p>}
                  {costsByCategory.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="flex-1 text-xs truncate" style={{ color: "var(--muted)" }}>{c.name}</span>
                      <span className="text-xs font-mono font-semibold" style={{ color: "var(--red-c)" }}>{cur} {fmt(c.value)}</span>
                      <span className="text-xs font-mono w-10 text-right" style={{ color: "var(--muted2)" }}>
                        {metrics.opex > 0 ? fmtDec(c.value / metrics.opex * 100) : "0.00"}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        );

        if (sectionId === "cashflow") return (
          <Section key="cashflow" title="🏦 Cashflow & Bank" {...sProps("cashflow", idx)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <KpiCard label="Calculated (Rev − OPEX)" value={`${cur} ${fmt(calcCashflow)}`} sub="From filtered data" color="var(--pink)" />
              <KpiCard label="Actual Bank Balance" value={bankBalance > 0 ? `${cur} ${fmt(bankBalance)}` : "— not recorded —"}
                sub={bankLastDate ? new Date(bankLastDate).toLocaleDateString("en-ZA") : ""}
                color={bankBalance > 0 ? "var(--accent)" : "var(--amber-c)"} />
              {bankBalance > 0 && (
                <KpiCard label="Variance" value={`${cfVariance >= 0 ? "+" : ""}${cur} ${fmt(Math.abs(cfVariance))}`}
                  sub={cfVariance === 0 ? "Balanced" : cfVariance > 0 ? "More in bank" : "Less in bank"}
                  color={cfVariance === 0 ? "var(--accent)" : Math.abs(cfVariance) < metrics.revenue * 0.05 ? "var(--amber-c)" : "var(--red-c)"} />
              )}
            </div>
            {cashflowTrend.length > 1 && (
              <ChartBox title="Bank Balance Trend (last 30 snapshots)">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={cashflowTrend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                    <XAxis dataKey="date" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => `${cur} ${fmt(Number(v ?? 0))}`} />
                    <Area dataKey="balance" stroke="#06b6d4" fill="rgba(6,182,212,.12)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartBox>
            )}
          </Section>
        );

        if (sectionId === "alerts") return (
          <Section key="alerts" title="⚠️ Alerts & Intelligence" {...sProps("alerts", idx)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overdueInvoices.length > 0 ? (
                <div className="rounded-lg p-4" style={{ background: "rgba(239,68,68,.06)", border: "1px solid var(--red-c)", borderLeft: "4px solid var(--red-c)" }}>
                  <p className="text-xs font-bold mb-2" style={{ color: "var(--red-c)" }}>
                    🚨 Overdue Invoices ({overdueInvoices.length}) — {cur} {fmt(overdueInvoices.reduce((s, i) => s + i.amount, 0))}
                  </p>
                  {overdueInvoices.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center py-1.5 border-b text-xs" style={{ borderColor: "rgba(255,255,255,.05)", color: "var(--muted)" }}>
                      <span>{inv.customerName} — {cur} {fmt(inv.amount)}</span>
                      <span className="font-semibold" style={{ color: "var(--red-c)" }}>{inv.days}d overdue</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg p-4 flex items-center gap-3" style={{ background: "rgba(16,185,129,.06)", border: "1px solid var(--accent)" }}>
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "var(--accent)" }}>No Overdue Invoices</p>
                    <p className="text-xs" style={{ color: "var(--muted2)" }}>All invoices are within payment terms</p>
                  </div>
                </div>
              )}
              {staleLeads.length > 0 ? (
                <div className="rounded-lg p-4" style={{ background: "rgba(245,158,11,.06)", border: "1px solid var(--amber-c)", borderLeft: "4px solid var(--amber-c)" }}>
                  <p className="text-xs font-bold mb-2" style={{ color: "var(--amber-c)" }}>📞 Follow-Up Needed ({staleLeads.length})</p>
                  {staleLeads.map(l => (
                    <div key={l.id} className="flex justify-between items-center py-1.5 border-b text-xs" style={{ borderColor: "rgba(255,255,255,.05)", color: "var(--muted)" }}>
                      <span>{l.name}</span>
                      <span style={{ color: "var(--amber-c)" }}>{l.days !== null ? `${l.days}d ago` : "Never"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg p-4 flex items-center gap-3" style={{ background: "rgba(16,185,129,.06)", border: "1px solid var(--accent)" }}>
                  <span className="text-2xl">🎯</span>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "var(--accent)" }}>All Leads Active</p>
                    <p className="text-xs" style={{ color: "var(--muted2)" }}>No leads need follow-up right now</p>
                  </div>
                </div>
              )}
            </div>
          </Section>
        );

        return null;
      })}

      {/* KPI Config Modal */}
      {showKpiConfig && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowKpiConfig(false); }}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-2xl"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="font-semibold text-sm">Configure KPIs</h2>
              <button onClick={() => setShowKpiConfig(false)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <div className="p-4 space-y-1.5 max-h-[65vh] overflow-y-auto">
              {builtinKpis.map(k => {
                const hidden = hiddenKpis.includes(k.key);
                return (
                  <button key={k.key} onClick={() => toggleKpiHidden(k.key)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors"
                    style={{ background: hidden ? "var(--card)" : "rgba(16,185,129,.08)", border: `1px solid ${hidden ? "var(--border)" : "var(--accent)"}` }}>
                    <span style={{ color: hidden ? "var(--muted2)" : "var(--foreground)" }}>{k.label}</span>
                    <span className="font-bold text-xs" style={{ color: hidden ? "var(--muted2)" : "var(--accent)" }}>
                      {hidden ? "Hidden" : "Visible ✓"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="px-5 pb-4 pt-2 flex gap-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => { setHiddenKpis([]); localStorage.removeItem(LS_KPI_HIDDEN); }}
                className="flex-1 py-2 rounded text-xs font-semibold"
                style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                Show All
              </button>
              <button onClick={() => setShowKpiConfig(false)}
                className="flex-1 py-2 rounded text-xs font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom KPI Builder */}
      {showKpiBuilder && (
        <CustomKpiBuilder
          onClose={() => setShowKpiBuilder(false)}
          onSave={kpi => saveCustomKpis([...customKpis, kpi])}
          tableMap={tableMap}
          dimMaps={dimMaps}
          cur={cur}
        />
      )}
    </div>
  );
}
