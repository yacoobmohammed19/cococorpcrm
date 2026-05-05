"use client";

import { useState, useMemo } from "react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { createCost, updateCost, deleteCost } from "@/server-actions/costs";

type Cost = {
  id: number; transaction_date: string; cost_details: string | null;
  category_name: string | null; amount: number; account_name: string | null; recouped: string | null;
  cost_category_id: number | null; account_id: number | null;
};
type Category = { id: number; name: string };
type Account = { id: number; name: string };
type Props = { costs: Cost[]; categories: Category[]; accounts: Account[]; currency: string };

function fmt(n: number) { return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function monthRange(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const months: string[] = []; let cy = fy, cm = fm, safe = 0;
  while ((cy < ty || (cy === ty && cm <= tm)) && safe++ < 120) { months.push(`${cy}-${String(cm).padStart(2, "0")}`); cm++; if (cm > 12) { cm = 1; cy++; } }
  return months;
}
function mLabel(m: string) { const [y, mo] = m.split("-"); return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mo] + " " + y.slice(2); }

export function CostsClient({ costs, categories, accounts, currency }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const [view, setView] = useState<"table" | "monthly">("table");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [acctFilter, setAcctFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modal, setModal] = useState(false);
  const [editCost, setEditCost] = useState<Cost | null>(null);
  const [editCostDate, setEditCostDate] = useState("");
  const [createCostDate, setCreateCostDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();

  const now = new Date();
  const [mFrom, setMFrom] = useState(`${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [mTo, setMTo] = useState(now.toISOString().slice(0, 7));

  const filtered = useMemo(() => {
    let rows = costs.slice().sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    if (dateFrom) rows = rows.filter(c => c.transaction_date >= dateFrom);
    if (dateTo) rows = rows.filter(c => c.transaction_date <= dateTo);
    if (catFilter) rows = rows.filter(c => String(c.cost_category_id) === catFilter);
    if (acctFilter) rows = rows.filter(c => String(c.account_id) === acctFilter);
    if (search) rows = rows.filter(c => (c.cost_details || "").toLowerCase().includes(search.toLowerCase()));
    return rows;
  }, [costs, dateFrom, dateTo, catFilter, acctFilter, search]);

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
      {/* Summary KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Total OPEX</div>
          <div className="text-2xl font-bold font-mono" style={{ color: "var(--red-c)" }}>{cur} {fmt(total)}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>{filtered.length} items</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
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
              className="px-3 py-1.5 text-xs rounded-xl border outline-none" style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }} />
            <span className="text-xs" style={{ color: "var(--muted2)" }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border outline-none" style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }} />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border outline-none" style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={acctFilter} onChange={e => setAcctFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border outline-none" style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
              <option value="">All Accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {(catFilter || acctFilter || dateFrom || dateTo || search) && (
              <button onClick={() => { setCatFilter(""); setAcctFilter(""); setDateFrom(""); setDateTo(""); setSearch(""); }}
                className="text-xs px-2 py-1 rounded-xl border" style={{ borderColor: "var(--red-c)", color: "var(--red-c)" }}>✕ Clear</button>
            )}
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
        <button onClick={() => { setCreateCostDate(new Date().toISOString().slice(0, 10)); setModal(true); }} className="ml-auto px-4 py-1.5 text-xs font-semibold rounded-xl" style={{ background: "var(--accent)", color: "#fff" }}>+ New Cost</button>
      </div>

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
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>{c.category_name || "Uncategorized"}</p>
                  </div>
                  <p className="text-xl font-bold font-mono shrink-0" style={{ color: "var(--red-c)" }}>{cur} {fmt(c.amount)}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs mb-3 mt-2" style={{ color: "var(--muted2)" }}>
                  <span>📅 {c.transaction_date}</span>
                  {c.account_name && <span>🏦 {c.account_name}</span>}
                  {c.recouped === "Y" && <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(16,185,129,.15)", color: "var(--accent)" }}>Recouped</span>}
                </div>
                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <button onClick={() => { setEditCostDate(c.transaction_date.slice(0, 10)); setEditCost(c); }} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}>✏️ Edit</button>
                  <button onClick={async () => { if (!await confirm("Delete this cost?", "This cost record will be permanently removed.")) return; await runAction(() => deleteCost(c.id), toast, "Cost deleted"); }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>🗑️</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-center py-16 text-sm" style={{ color: "var(--muted2)" }}>No costs found</div>}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                    {["Date", "Details", "Category", "Amount", "Account", "Recouped", ""].map(h => (
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
                      <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap" style={{ color: "var(--red-c)" }}>{cur} {fmt(c.amount)}</td>
                      <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{c.account_name || "—"}</td>
                      <td className="px-3 py-2">
                        {c.recouped === "Y" && <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(16,185,129,.15)", color: "var(--accent)" }}>Recouped</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditCostDate(c.transaction_date.slice(0, 10)); setEditCost(c); }}
                            className="px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", background: "var(--card2)" }}>✏️</button>
                          <button onClick={async () => { if (!await confirm("Delete this cost?", "This cost record will be permanently removed.")) return; await runAction(() => deleteCost(c.id), toast, "Cost deleted"); }}
                            className="px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", background: "var(--card2)" }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: "var(--muted2)" }}>No costs found</td></tr>}
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
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Monthly Costs by Category</h3>
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
                  return (
                    <tr key={cat} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: "var(--card2)" }}>{cat}</td>
                      {months.map(m => {
                        const v = costByC[cat]?.[m] || 0;
                        return v ? <td key={m} className="px-3 py-2 text-right font-mono whitespace-nowrap" style={{ color: "var(--red-c)" }}>{cur} {fmt(v)}</td>
                          : <td key={m} className="px-3 py-2 text-right" style={{ color: "var(--card3)" }}>—</td>;
                      })}
                      <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--foreground)" }}>{cur} {fmt(rowTotal)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2" style={{ borderColor: "var(--border2)" }}>
                  <td className="px-3 py-2 font-bold sticky left-0" style={{ background: "var(--card)" }}>Total</td>
                  {months.map(m => <td key={m} className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap" style={{ color: "var(--red-c)" }}>{cur} {fmt(mTotals[m] || 0)}</td>)}
                  <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--red-c)" }}>{cur} {fmt(Object.values(mTotals).reduce((a, b) => a + b, 0))}</td>
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
          onClick={e => { if (e.target === e.currentTarget) setEditCost(null); }}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: "var(--border)" }} />
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">Edit Cost</h3>
              <button onClick={() => setEditCost(null)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                setBusy(true);
                try { await updateCost(editCost.id, fd); toast.success("Cost updated"); setEditCost(null); }
                catch { toast.error("Failed to update cost"); }
                finally { setBusy(false); }
              }}>
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
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Recouped?</label>
                <select name="recouped" defaultValue={editCost.recouped || ""} className={inputStyle} style={inputCss}>
                  <option value="">No</option>
                  <option value="Y">Yes</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2 pb-2">
                <button type="button" onClick={() => setEditCost(null)} className="flex-1 py-2.5 text-sm rounded-xl border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
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
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => { setBusy(true); await createCost(fd); setModal(false); setBusy(false); }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                  <DateInput name="transaction_date" value={createCostDate} onChange={setCreateCostDate} placeholder="Select date" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Amount *</label>
                  <input name="amount" type="number" step="0.01" required className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Details</label>
                <input name="cost_details" className={inputStyle} style={inputCss} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Category</label>
                  <select name="cost_category_id" className={inputStyle} style={inputCss}>
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
      <ConfirmDialog {...dialogProps} confirmLabel="Delete" />
    </div>
  );
}
