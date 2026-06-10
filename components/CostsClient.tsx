"use client";

import { useState, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, Camera } from "lucide-react";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { createCost, updateCost, deleteCost } from "@/server-actions/costs";
import { COST_TYPES, type CostTypeValue } from "@/lib/schemas/costs";

// Resize + JPEG-compress an image before sending to the API.
// Phone camera shots can be 5–15 MB; base64-encoded JSON payloads that large
// can exceed the Next.js request body limit, causing req.json() to throw and
// the route to return an HTML 500 page instead of JSON → "Failed to scan receipt".
async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ base64: canvas.toDataURL("image/jpeg", 0.85), mimeType: "image/jpeg" });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not load image")); };
    img.src = url;
  });
}

type Cost = {
  id: number; transaction_date: string; cost_details: string | null;
  category_name: string | null; amount: number; account_name: string | null; recouped: string | null;
  cost_category_id: number | null; account_id: number | null;
  customer_id: number | null; customer_name: string | null;
  receipt_image_url: string | null; apportion_to_customers: boolean;
  cost_type: string; include_in_pnl: boolean;
};
type Category = { id: number; name: string };
type Account = { id: number; name: string };
type Customer = { id: number; name: string };
type Props = { costs: Cost[]; categories: Category[]; accounts: Account[]; customers: Customer[]; currency: string };

const COST_TYPE_LABELS: Record<string, string> = Object.fromEntries(COST_TYPES.map(t => [t.value, t.label]));
const NON_OPERATIONAL_BADGE: Record<string, string> = {
  sadaqah: "#a855f7", zakat: "#f59e0b", owner_draw: "#3b82f6",
  capex: "#06b6d4", personal: "#ec4899",
};

// ── Drill-down modal ──────────────────────────────────────────────────────────

type CostDrillDown = { title: string; ids: number[] } | null;

function CostDrillDownModal({ title, ids, costs, cur, onClose, onEdit }: {
  title: string; ids: number[]; costs: Cost[]; cur: string;
  onClose: () => void; onEdit: (c: Cost) => void;
}) {
  const rows = costs.filter(c => ids.includes(c.id)).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  const total = rows.reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[85vh]"
        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="font-semibold text-sm">{title}</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>
              {rows.length} item{rows.length !== 1 ? "s" : ""} · {cur} {fmt(total)}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-lg" style={{ color: "var(--muted2)" }}>✕</button>
        </div>

        {/* Rows */}
        <div className="overflow-y-auto flex-1">
          {rows.length === 0 && (
            <p className="p-8 text-center text-sm" style={{ color: "var(--muted2)" }}>No cost entries</p>
          )}
          {rows.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{c.transaction_date}</span>
                  <span className="text-xs" style={{ color: "var(--muted2)" }}>{c.category_name || "Uncategorized"}</span>
                  {c.cost_type !== "operational" && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: `${NON_OPERATIONAL_BADGE[c.cost_type]}22`, color: NON_OPERATIONAL_BADGE[c.cost_type] }}>
                      {COST_TYPE_LABELS[c.cost_type]}
                    </span>
                  )}
                  {c.recouped === "Y" && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(16,185,129,.15)", color: "var(--accent)" }}>Recouped</span>
                  )}
                </div>
                <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{c.cost_details || "—"}{c.account_name ? ` · ${c.account_name}` : ""}</p>
              </div>
              <span className="font-mono font-bold text-sm shrink-0" style={{ color: "var(--red-c)" }}>{cur} {fmt(c.amount)}</span>
              <button
                onClick={() => { onClose(); onEdit(c); }}
                className="px-2.5 py-1 rounded text-xs shrink-0"
                style={{ border: "1px solid var(--border)", background: "var(--card2)", color: "var(--muted2)" }}>
                ✏️ Edit
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        {rows.length > 0 && (
          <div className="px-5 py-3 border-t flex flex-wrap gap-4 text-xs shrink-0" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {[
              ["OPEX (P&L)", rows.filter(c => c.include_in_pnl).reduce((s, c) => s + c.amount, 0), "var(--red-c)"],
              ["Non-P&L", rows.filter(c => !c.include_in_pnl).reduce((s, c) => s + c.amount, 0), "var(--muted2)"],
              ["Total", total, "var(--foreground)"],
            ].map(([l, v, color]) => (
              <div key={l as string}>
                <span style={{ color: "var(--muted2)" }}>{l}: </span>
                <span className="font-mono font-semibold" style={{ color: color as string }}>{cur} {fmt(v as number)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(n: number) { return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => { const s = v == null ? "" : String(v); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: filename });
  a.click(); URL.revokeObjectURL(a.href);
}

function monthRange(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const months: string[] = []; let cy = fy, cm = fm, safe = 0;
  while ((cy < ty || (cy === ty && cm <= tm)) && safe++ < 120) { months.push(`${cy}-${String(cm).padStart(2, "0")}`); cm++; if (cm > 12) { cm = 1; cy++; } }
  return months;
}
function mLabel(m: string) { const [y, mo] = m.split("-"); return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mo] + " " + y.slice(2); }

export function CostsClient({ costs, categories, accounts, customers, currency }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const [view, setView] = useState<"table" | "monthly">("table");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string[]>([]);
  const [acctFilter, setAcctFilter] = useState<string[]>([]);
  const [custFilter, setCustFilter] = useState<string[]>([]);
  const [recoupedFilter, setRecoupedFilter] = useState<"" | "Y" | "N">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modal, setModal] = useState(false);
  const [editCost, setEditCost] = useState<Cost | null>(null);
  const [editCostDate, setEditCostDate] = useState("");
  const [createCostDate, setCreateCostDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();

  // Receipt image extraction state
  const newFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [newAmount, setNewAmount] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [newApportion, setNewApportion] = useState(false);
  const [editApportion, setEditApportion] = useState(false);
  const [newCostType, setNewCostType] = useState<CostTypeValue>("operational");
  const [newIncludeInPnl, setNewIncludeInPnl] = useState(true);
  const [editCostType, setEditCostType] = useState<CostTypeValue>("operational");
  const [editIncludeInPnl, setEditIncludeInPnl] = useState(true);
  const [drillDown, setDrillDown] = useState<CostDrillDown>(null);

  async function handleScanReceipt(file: File, mode: "new" | "edit") {
    setExtracting(true);
    try {
      // Compress before sending — large raw images can exceed the server body limit
      const { base64, mimeType: mType } = await compressImage(file);

      const res = await fetch("/api/extract-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType: mType }),
      });

      // Check for HTTP errors before parsing JSON (a non-JSON HTML error page
      // from the server would cause res.json() to throw the generic catch below)
      if (!res.ok) {
        let errMsg = "Receipt scan failed";
        try { const e = await res.json() as { error?: string }; errMsg = e.error || errMsg; } catch {}
        toast.error(errMsg);
        return;
      }

      const data = await res.json() as { amount?: number; date?: string; details?: string; category?: string; imageUrl?: string; error?: string };

      if (mode === "new") {
        if (data.amount) setNewAmount(String(data.amount));
        if (data.details) setNewDetails(data.details);
        if (data.date) setCreateCostDate(data.date);
        if (data.category && categories.length > 0) {
          const match = categories.find(c => c.name.toLowerCase().includes((data.category || "").toLowerCase()));
          if (match) setNewCategoryId(String(match.id));
        }
        if (data.imageUrl) setNewImageUrl(data.imageUrl);
      } else {
        if (data.imageUrl) setEditImageUrl(data.imageUrl);
        if (editCost) {
          if (data.amount) setEditCost(prev => prev ? { ...prev, amount: data.amount! } : prev);
          if (data.details) setEditCost(prev => prev ? { ...prev, cost_details: data.details! } : prev);
          if (data.date) setEditCostDate(data.date);
          if (data.category && categories.length > 0) {
            const match = categories.find(c => c.name.toLowerCase().includes((data.category || "").toLowerCase()));
            if (match) setEditCost(prev => prev ? { ...prev, cost_category_id: match.id } : prev);
          }
        }
      }
      if (!data.error) toast.success("Receipt scanned — fields pre-filled");
      else toast.error("AI could not read receipt fully — fill in missing fields");
    } catch {
      toast.error("Failed to scan receipt");
    } finally {
      setExtracting(false);
    }
  }

  const now = new Date();
  const [mFrom, setMFrom] = useState(`${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [mTo, setMTo] = useState(now.toISOString().slice(0, 7));

  function togStr(arr: string[], v: string) { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }

  const filtered = useMemo(() => {
    let rows = costs.slice().sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    if (dateFrom) rows = rows.filter(c => c.transaction_date >= dateFrom);
    if (dateTo) rows = rows.filter(c => c.transaction_date <= dateTo);
    if (catFilter.length > 0) rows = rows.filter(c => catFilter.includes(String(c.cost_category_id)));
    if (acctFilter.length > 0) rows = rows.filter(c => acctFilter.includes(String(c.account_id)));
    if (custFilter.length > 0) rows = rows.filter(c => custFilter.includes(String(c.customer_id)));
    if (recoupedFilter === "Y") rows = rows.filter(c => c.recouped === "Y");
    if (recoupedFilter === "N") rows = rows.filter(c => c.recouped !== "Y");
    if (search) rows = rows.filter(c => (c.cost_details || "").toLowerCase().includes(search.toLowerCase()));
    return rows;
  }, [costs, dateFrom, dateTo, catFilter, acctFilter, custFilter, recoupedFilter, search]);

  const total = filtered.reduce((s, c) => s + Number(c.amount), 0);

  const months = useMemo(() => monthRange(mFrom, mTo), [mFrom, mTo]);
  const cats = useMemo(() => [...new Set(costs.map(c => c.category_name || "Other"))].sort(), [costs]);
  const accts = useMemo(() => [...new Set(costs.map(c => c.account_name || "Other"))].sort(), [costs]);

  const costByC = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    costs.forEach(c => {
      if (!c.transaction_date) return;
      const mk = c.transaction_date.slice(0, 7);
      if (!months.includes(mk)) return;
      const cat = c.category_name || "Other";
      if (!m[cat]) m[cat] = {};
      m[cat][mk] = (m[cat][mk] || 0) + Number(c.amount);
    });
    return m;
  }, [costs, months]);

  const mTotals = useMemo(() => {
    const t: Record<string, number> = {};
    months.forEach(m => { t[m] = cats.reduce((s, cat) => s + (costByC[cat]?.[m] || 0), 0); });
    return t;
  }, [costByC, cats, months]);

  const inputStyle = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1";
  const inputCss = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Costs</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
            {filtered.length} entries · {cur} {fmt(total)} filtered OPEX
          </p>
        </div>
        <button
          onClick={() => downloadCsv(`costs-${new Date().toISOString().slice(0,10)}.csv`, filtered.map(c => ({ Date: c.transaction_date, Details: c.cost_details || "", Category: c.category_name || "", Customer: c.apportion_to_customers ? "All (Apportioned)" : (c.customer_name || ""), Amount: c.amount, Account: c.account_name || "", Recouped: c.recouped === "Y" ? "Yes" : "No", Apportioned: c.apportion_to_customers ? "Yes" : "No" })))}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border transition-all hover:opacity-80"
          style={{ border: "1px solid var(--border)", color: "var(--muted)", background: "var(--card2)" }}>
          ↓ CSV
        </button>
        <button
          onClick={() => { setCreateCostDate(new Date().toISOString().slice(0, 10)); setNewApportion(false); setModal(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
        >
          <Plus size={15} />
          New Cost
        </button>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Total OPEX</div>
          <div className="text-2xl font-bold font-mono" style={{ color: "var(--red-c)" }}>{cur} {fmt(total)}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>{filtered.length} items</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-2">
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {[["table", "Table"], ["monthly", "Monthly"]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k as typeof view)} className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{ background: view === k ? "var(--accent)" : "var(--card2)", color: view === k ? "#fff" : "var(--muted)" }}>{l}</button>
          ))}
        </div>
        {view === "table" && (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="px-3 py-1.5 text-xs rounded-xl border outline-none" style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border outline-none" style={{ background: "var(--card2)", borderColor: dateFrom ? "var(--accent)" : "var(--border)", color: "var(--muted)" }} />
            <span className="text-xs" style={{ color: "var(--muted2)" }}>→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border outline-none" style={{ background: "var(--card2)", borderColor: dateTo ? "var(--accent)" : "var(--border)", color: "var(--muted)" }} />
          </>
        )}
        {view === "monthly" && (
          <>
            <input type="month" value={mFrom} onChange={e => setMFrom(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border outline-none" style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }} />
            <span className="text-xs" style={{ color: "var(--muted2)" }}>to</span>
            <input type="month" value={mTo} onChange={e => setMTo(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border outline-none" style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }} />
          </>
        )}
      </div>
      {view === "table" && (
        <div className="flex flex-wrap gap-2 items-center mb-4">
          {categories.length > 0 && (
            <MultiSelect
              label="Category"
              options={categories.map(c => ({ label: c.name, value: String(c.id) }))}
              value={catFilter}
              onChange={setCatFilter}
            />
          )}
          {accounts.length > 0 && (
            <MultiSelect
              label="Account"
              options={accounts.map(a => ({ label: a.name, value: String(a.id) }))}
              value={acctFilter}
              onChange={setAcctFilter}
            />
          )}
          {customers.length > 0 && (
            <MultiSelect
              label="Customer"
              options={customers.map(c => ({ label: c.name, value: String(c.id) }))}
              value={custFilter}
              onChange={setCustFilter}
            />
          )}
          <MultiSelect
            label="Recouped"
            options={[{ label: "Yes", value: "Y" }, { label: "No", value: "N" }]}
            value={recoupedFilter ? [recoupedFilter] : []}
            onChange={vals => setRecoupedFilter((vals[vals.length - 1] ?? "") as typeof recoupedFilter)}
            minWidth={120}
          />
          {(catFilter.length > 0 || acctFilter.length > 0 || custFilter.length > 0 || recoupedFilter || dateFrom || dateTo || search) && (
            <button onClick={() => { setCatFilter([]); setAcctFilter([]); setCustFilter([]); setRecoupedFilter(""); setDateFrom(""); setDateTo(""); setSearch(""); }}
              className="text-xs px-2 py-1.5 rounded" style={{ color: "var(--muted2)" }}>✕ Clear</button>
          )}
        </div>
      )}

      {/* TABLE VIEW */}
      {view === "table" && (
        <>
          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map(c => (
              <div key={c.id} className="rounded-2xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 mr-3">
                    <p className="font-semibold text-sm leading-tight">{c.cost_details || "—"}</p>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "var(--muted2)" }}>
                    {c.category_name || "Uncategorized"}
                    {c.apportion_to_customers && <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(99,102,241,.15)", color: "#818cf8" }}>All · {cur}{fmt(c.amount / Math.max(customers.length, 1))}/ea</span>}
                  </p>
                  </div>
                  <p className="text-xl font-bold font-mono shrink-0" style={{ color: "var(--red-c)" }}>{cur} {fmt(c.amount)}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs mb-3 mt-2" style={{ color: "var(--muted2)" }}>
                  <span>📅 {c.transaction_date}</span>
                  {c.account_name && <span>🏦 {c.account_name}</span>}
                  {c.recouped === "Y" && <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(16,185,129,.15)", color: "var(--accent)" }}>Recouped</span>}
                  {c.receipt_image_url && <a href={c.receipt_image_url} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--card3)", color: "var(--muted2)" }}>📎 Receipt</a>}
                </div>
                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <button onClick={() => { setEditCostDate(c.transaction_date.slice(0, 10)); setEditApportion(c.apportion_to_customers); setEditCostType(c.cost_type as CostTypeValue); setEditIncludeInPnl(c.include_in_pnl); setEditCost(c); }} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}>✏️ Edit</button>
                  <button onClick={async () => { if (!await confirm("Delete this cost?", "This cost record will be permanently removed.")) return; await runAction(() => deleteCost(c.id), toast, "Cost deleted"); }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>🗑️</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <EmptyState icon="💸" title={search || catFilter.length > 0 || acctFilter.length > 0 || custFilter.length > 0 || dateFrom || dateTo || recoupedFilter ? "No costs match your filters" : "No costs yet"} description={search || catFilter.length > 0 || acctFilter.length > 0 || custFilter.length > 0 || dateFrom || dateTo || recoupedFilter ? "Try adjusting your filters." : "Record your first cost to start tracking expenses."} />}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                    {["Date", "Details", "Category", "Type", "Customer", "Amount", "Account", "Recouped", "Receipt", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{c.transaction_date}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{c.cost_details || "—"}</td>
                      <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{c.category_name || "—"}</td>
                      <td className="px-3 py-2">
                        {c.cost_type !== "operational" ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                            style={{ background: `${NON_OPERATIONAL_BADGE[c.cost_type]}22`, color: NON_OPERATIONAL_BADGE[c.cost_type] }}>
                            {COST_TYPE_LABELS[c.cost_type]}
                          </span>
                        ) : <span style={{ color: "var(--muted2)" }}>—</span>}
                      </td>
                      <td className="px-3 py-2 max-w-[140px]">
                        {c.apportion_to_customers
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ background: "rgba(99,102,241,.15)", color: "#818cf8" }}>
                              All · {cur}{fmt(c.amount / Math.max(customers.length, 1))}/ea
                            </span>
                          : <span className="truncate block" style={{ color: "var(--muted)" }}>{c.customer_name || "—"}</span>}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap" style={{ color: "var(--red-c)" }}>{cur} {fmt(c.amount)}</td>
                      <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{c.account_name || "—"}</td>
                      <td className="px-3 py-2">
                        {c.recouped === "Y" && <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(16,185,129,.15)", color: "var(--accent)" }}>Recouped</span>}
                      </td>
                      <td className="px-3 py-2">
                        {c.receipt_image_url && <a href={c.receipt_image_url} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: "var(--muted2)" }}>📎</a>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditCostDate(c.transaction_date.slice(0, 10)); setEditApportion(c.apportion_to_customers); setEditCostType(c.cost_type as CostTypeValue); setEditIncludeInPnl(c.include_in_pnl); setEditCost(c); }}
                            className="px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", background: "var(--card2)" }}>✏️</button>
                          <button onClick={async () => { if (!await confirm("Delete this cost?", "This cost record will be permanently removed.")) return; await runAction(() => deleteCost(c.id), toast, "Cost deleted"); }}
                            className="px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", background: "var(--card2)" }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={10}><EmptyState icon="💸" title={search || catFilter.length > 0 || acctFilter.length > 0 || custFilter.length > 0 || dateFrom || dateTo || recoupedFilter ? "No costs match your filters" : "No costs yet"} description={search || catFilter.length > 0 || acctFilter.length > 0 || custFilter.length > 0 || dateFrom || dateTo || recoupedFilter ? "Try adjusting your filters." : "Record your first cost to start tracking expenses."} /></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MONTHLY VIEW */}
      {view === "monthly" && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
              Monthly Costs by Category <span className="font-normal normal-case ml-1" style={{ color: "var(--muted2)" }}>— click any value to drill down</span>
            </h3>
          </div>
          <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                  <th className="px-3 py-2.5 text-left font-semibold sticky left-0 z-10 min-w-[140px]" style={{ background: "var(--card)", color: "var(--muted2)" }}>Category</th>
                  {months.map(m => <th key={m} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "var(--muted2)", minWidth: 72 }}>{mLabel(m)}</th>)}
                  <th className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--muted2)" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {cats.map(cat => {
                  const rowTotal = months.reduce((s, m) => s + (costByC[cat]?.[m] || 0), 0);
                  const rowIds = costs.filter(c => (c.category_name || "Other") === cat).map(c => c.id);
                  return (
                    <tr key={cat} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: "var(--card2)" }}>{cat}</td>
                      {months.map(m => {
                        const v = costByC[cat]?.[m] || 0;
                        const cellIds = costs.filter(c => (c.category_name || "Other") === cat && c.transaction_date?.slice(0, 7) === m).map(c => c.id);
                        return v ? (
                          <td key={m} className="px-3 py-2 text-right font-mono whitespace-nowrap">
                            <button
                              onClick={() => setDrillDown({ title: `${cat} — ${mLabel(m)}`, ids: cellIds })}
                              className="font-mono font-semibold hover:underline cursor-pointer rounded px-1 transition-colors hover:bg-[var(--card3)]"
                              style={{ color: "var(--red-c)" }}>
                              {cur} {fmt(v)}
                            </button>
                          </td>
                        ) : <td key={m} className="px-3 py-2 text-right" style={{ color: "var(--card3)" }}>—</td>;
                      })}
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {rowTotal > 0 ? (
                          <button
                            onClick={() => setDrillDown({ title: `${cat} — All months`, ids: rowIds })}
                            className="font-mono font-bold hover:underline cursor-pointer rounded px-1 transition-colors hover:bg-[var(--card3)]"
                            style={{ color: "var(--foreground)" }}>
                            {cur} {fmt(rowTotal)}
                          </button>
                        ) : <span style={{ color: "var(--card3)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2" style={{ borderColor: "var(--border2)" }}>
                  <td className="px-3 py-2 font-bold sticky left-0" style={{ background: "var(--card)" }}>Total</td>
                  {months.map(m => {
                    const v = mTotals[m] || 0;
                    const colIds = costs.filter(c => c.transaction_date?.slice(0, 7) === m).map(c => c.id);
                    return (
                      <td key={m} className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap">
                        {v > 0 ? (
                          <button
                            onClick={() => setDrillDown({ title: `All categories — ${mLabel(m)}`, ids: colIds })}
                            className="font-mono font-semibold hover:underline cursor-pointer rounded px-1 transition-colors hover:bg-[var(--card3)]"
                            style={{ color: "var(--red-c)" }}>
                            {cur} {fmt(v)}
                          </button>
                        ) : <span style={{ color: "var(--card3)" }}>—</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono font-bold">
                    <button
                      onClick={() => setDrillDown({ title: "All costs — full period", ids: costs.filter(c => months.includes(c.transaction_date?.slice(0, 7) ?? "")).map(c => c.id) })}
                      className="font-mono font-bold hover:underline cursor-pointer rounded px-1 transition-colors hover:bg-[var(--card3)]"
                      style={{ color: "var(--red-c)" }}>
                      {cur} {fmt(Object.values(mTotals).reduce((a, b) => a + b, 0))}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Cost Modal — bottom sheet on mobile */}
      {editCost && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center sm:p-4 sm:pt-16 overflow-y-auto"
          style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) { setEditCost(null); setEditApportion(false); setEditCostType("operational"); setEditIncludeInPnl(true); } }}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: "var(--border)" }} />
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">Edit Cost</h3>
              <button onClick={() => { setEditCost(null); setEditApportion(false); setEditCostType("operational"); setEditIncludeInPnl(true); }} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            {/* Scan Receipt for Edit */}
            <div className="px-5 pt-4">
              <input ref={editFileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleScanReceipt(f, "edit"); e.target.value = ""; }} />
              <button type="button" disabled={extracting} onClick={() => editFileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-dashed border-2 transition-opacity"
                style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(16,185,129,.05)", opacity: extracting ? .6 : 1 }}>
                <Camera size={15} />{extracting ? "Scanning receipt…" : "📎 Update with AI Receipt Scan"}
              </button>
              {(editImageUrl || editCost.receipt_image_url) && (
                <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--accent)" }}>
                  <span>📎 Receipt attached</span>
                  <a href={editImageUrl || editCost.receipt_image_url!} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--muted2)" }}>View</a>
                </div>
              )}
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                setBusy(true);
                try { await updateCost(editCost.id, fd); toast.success("Cost updated"); setEditCost(null); setEditImageUrl(""); setEditApportion(false); setEditCostType("operational"); setEditIncludeInPnl(true); }
                catch { toast.error("Failed to update cost"); }
                finally { setBusy(false); }
              }}>
              <input type="hidden" name="receipt_image_url" value={editImageUrl || editCost.receipt_image_url || ""} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                  <DateInput name="transaction_date" value={editCostDate} onChange={setEditCostDate} placeholder="Select date" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Amount *</label>
                  <input name="amount" type="number" step="0.01" required defaultValue={editCost.amount} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Details</label>
                <input name="cost_details" defaultValue={editCost.cost_details || ""} className={inputStyle} style={inputCss} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Category</label>
                  <select name="cost_category_id" defaultValue={editCost.cost_category_id ?? ""} className={inputStyle} style={inputCss}>
                    <option value="">— None —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Account</label>
                  <select name="account_id" defaultValue={editCost.account_id ?? ""} className={inputStyle} style={inputCss}>
                    <option value="">— None —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              {/* Cost type + P&L inclusion */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Cost Type</label>
                  <select
                    name="cost_type"
                    value={editCostType}
                    onChange={e => {
                      const t = e.target.value as CostTypeValue;
                      setEditCostType(t);
                      setEditIncludeInPnl(t === "operational");
                    }}
                    className={inputStyle} style={inputCss}>
                    {COST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="hidden" name="include_in_pnl" value={editIncludeInPnl ? "true" : "false"} />
                    <input
                      type="checkbox"
                      checked={editIncludeInPnl}
                      onChange={e => setEditIncludeInPnl(e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: "var(--accent)" }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Include in P&L</p>
                      <p className="text-xs" style={{ color: "var(--muted2)" }}>Counts toward operational profit</p>
                    </div>
                  </label>
                </div>
              </div>
              {/* Apportion toggle */}
              <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" name="apportion_to_customers" checked={editApportion} onChange={e => setEditApportion(e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Apportion to all customers</p>
                    <p className="text-xs" style={{ color: "var(--muted2)" }}>Core/overhead cost split equally across all clients</p>
                  </div>
                </label>
                {editApportion && customers.length > 0 && (
                  <p className="text-xs mt-2 pl-6.5" style={{ color: "#818cf8" }}>
                    {cur}{fmt(editCost.amount / customers.length)} per customer · {customers.length} clients
                  </p>
                )}
              </div>
              {customers.length > 0 && !editApportion && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Customer (for CAC)</label>
                  <select name="customer_id" defaultValue={editCost.customer_id ?? ""} className={inputStyle} style={inputCss}>
                    <option value="">— None —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Recouped?</label>
                <select name="recouped" defaultValue={editCost.recouped || ""} className={inputStyle} style={inputCss}>
                  <option value="">No</option>
                  <option value="Y">Yes</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2 pb-2">
                <button type="button" onClick={() => { setEditCost(null); setEditApportion(false); setEditCostType("operational"); setEditIncludeInPnl(true); }} className="flex-1 py-2.5 text-sm rounded-xl border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2.5 text-sm font-semibold rounded-xl" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : "Update Cost"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Cost Modal — bottom sheet on mobile */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center sm:p-4 sm:pt-16 overflow-y-auto" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: "var(--border)" }} />
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">New Cost</h3>
              <button onClick={() => setModal(false)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            {/* Scan Receipt */}
            <div className="px-5 pt-4">
              <input ref={newFileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleScanReceipt(f, "new"); e.target.value = ""; }} />
              <button type="button" disabled={extracting} onClick={() => newFileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-dashed border-2 transition-opacity"
                style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(16,185,129,.05)", opacity: extracting ? .6 : 1 }}>
                <Camera size={15} />{extracting ? "Scanning receipt…" : "📎 Scan Receipt with AI"}
              </button>
              {newImageUrl && (
                <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--accent)" }}>
                  <span>✓ Receipt saved</span>
                  <a href={newImageUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--muted2)" }}>View</a>
                </div>
              )}
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                setBusy(true);
                try {
                  await createCost(fd);
                  setModal(false);
                  setNewAmount(""); setNewDetails(""); setNewCategoryId(""); setNewImageUrl(""); setNewApportion(false); setNewCostType("operational"); setNewIncludeInPnl(true);
                } finally { setBusy(false); }
              }}>
              <input type="hidden" name="receipt_image_url" value={newImageUrl} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                  <DateInput name="transaction_date" value={createCostDate} onChange={setCreateCostDate} placeholder="Select date" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Amount *</label>
                  <input name="amount" type="number" step="0.01" required value={newAmount} onChange={e => setNewAmount(e.target.value)} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Details</label>
                <input name="cost_details" value={newDetails} onChange={e => setNewDetails(e.target.value)} className={inputStyle} style={inputCss} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Category</label>
                  <select name="cost_category_id" value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} className={inputStyle} style={inputCss}>
                    <option value="">— None —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Account</label>
                  <select name="account_id" className={inputStyle} style={inputCss}>
                    <option value="">— None —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              {/* Cost type + P&L inclusion */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Cost Type</label>
                  <select
                    name="cost_type"
                    value={newCostType}
                    onChange={e => {
                      const t = e.target.value as CostTypeValue;
                      setNewCostType(t);
                      setNewIncludeInPnl(t === "operational");
                    }}
                    className={inputStyle} style={inputCss}>
                    {COST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="hidden" name="include_in_pnl" value={newIncludeInPnl ? "true" : "false"} />
                    <input
                      type="checkbox"
                      checked={newIncludeInPnl}
                      onChange={e => setNewIncludeInPnl(e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: "var(--accent)" }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Include in P&L</p>
                      <p className="text-xs" style={{ color: "var(--muted2)" }}>Counts toward operational profit</p>
                    </div>
                  </label>
                </div>
              </div>
              {/* Apportion toggle */}
              <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" name="apportion_to_customers" checked={newApportion} onChange={e => setNewApportion(e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Apportion to all customers</p>
                    <p className="text-xs" style={{ color: "var(--muted2)" }}>Core/overhead cost split equally across all clients</p>
                  </div>
                </label>
                {newApportion && customers.length > 0 && (
                  <p className="text-xs mt-2 pl-6.5" style={{ color: "#818cf8" }}>
                    {cur}{fmt(Number(newAmount || 0) / customers.length)} per customer · {customers.length} clients
                  </p>
                )}
              </div>
              {customers.length > 0 && !newApportion && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Customer (for CAC)</label>
                  <select name="customer_id" className={inputStyle} style={inputCss}>
                    <option value="">— None —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Recouped?</label>
                <select name="recouped" className={inputStyle} style={inputCss}>
                  <option value="">No</option>
                  <option value="Y">Yes</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2 pb-2">
                <button type="button" onClick={() => setModal(false)} className="flex-1 py-2.5 text-sm rounded-xl border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2.5 text-sm font-semibold rounded-xl" style={{ background: "var(--accent)", color: "#fff" }}>
                  {busy ? "Saving…" : "Create Cost"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {drillDown && (
        <CostDrillDownModal
          title={drillDown.title}
          ids={drillDown.ids}
          costs={costs}
          cur={cur}
          onClose={() => setDrillDown(null)}
          onEdit={c => {
            setDrillDown(null);
            setEditCostDate(c.transaction_date.slice(0, 10));
            setEditApportion(c.apportion_to_customers);
            setEditCostType(c.cost_type as CostTypeValue);
            setEditIncludeInPnl(c.include_in_pnl);
            setEditCost(c);
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} confirmLabel="Delete" />
    </div>
  );
}
