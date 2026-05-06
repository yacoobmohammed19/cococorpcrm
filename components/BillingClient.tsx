"use client";

import { useState, useMemo } from "react";
import { Receipt, Printer, Trash2 } from "lucide-react";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useToast } from "@/components/Toast";
import { runAction } from "@/lib/action-utils";
import { bulkDeleteInvoices } from "@/server-actions/invoices";

type Invoice = {
  id: number; customer_id: number; transaction_date: string;
  invoice_number: string; amount: number; status: string;
  payment_type_name: string | null; description: string | null;
};
type Customer = { id: number; name: string };

type Props = { invoices: Invoice[]; customers: Customer[]; currency: string; fiscalYearFrom: string };

function fmt(n: number) { return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function monthRange(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const months: string[] = [];
  let cy = fy, cm = fm, safe = 0;
  while ((cy < ty || (cy === ty && cm <= tm)) && safe++ < 120) {
    months.push(`${cy}-${String(cm).padStart(2, "0")}`);
    cm++; if (cm > 12) { cm = 1; cy++; }
  }
  return months;
}
function mLabel(m: string) {
  const [y, mo] = m.split("-");
  return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mo] + " " + y.slice(2);
}
function defaultRange(months = 12) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return {
    from: from.toISOString().slice(0, 7),
    to: now.toISOString().slice(0, 7),
  };
}

export function BillingClient({ invoices, customers, currency, fiscalYearFrom }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const toast = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [preset, setPreset] = useState("ytd");
  const [billFrom, setBillFrom] = useState(fiscalYearFrom);
  const [billTo, setBillTo] = useState(defaultRange(1).to);
  const [billView, setBillView] = useState<"total" | "collected" | "secured">("total");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  function applyPreset(p: string) {
    setPreset(p);
    if (p === "6m") { const r = defaultRange(6); setBillFrom(r.from); setBillTo(r.to); }
    else if (p === "12m") { const r = defaultRange(12); setBillFrom(r.from); setBillTo(r.to); }
    else if (p === "ytd") { setBillFrom(fiscalYearFrom); setBillTo(new Date().toISOString().slice(0, 7)); }
    else if (p === "all") { setBillFrom("2025-01"); setBillTo(new Date().toISOString().slice(0, 7)); }
  }

  const windowMonths = useMemo(() => monthRange(billFrom, billTo), [billFrom, billTo]);

  const filteredInvs = useMemo(() =>
    invoices.filter(i => !statusFilter || i.status === statusFilter), [invoices, statusFilter]);

  const matrix = useMemo(() => {
    const invByC: Record<number, Record<string, { completed: number; pending: number; writtenOff: number }>> = {};
    filteredInvs.forEach(inv => {
      if (!inv.transaction_date) return;
      const mk = inv.transaction_date.slice(0, 7);
      if (!windowMonths.includes(mk)) return;
      const cid = inv.customer_id;
      if (!invByC[cid]) invByC[cid] = {};
      if (!invByC[cid][mk]) invByC[cid][mk] = { completed: 0, pending: 0, writtenOff: 0 };
      const amt = Number(inv.amount);
      if (inv.status === "Completed") invByC[cid][mk].completed += amt;
      else if (inv.status === "Pending") invByC[cid][mk].pending += amt;
      else if (inv.status === "Written Off") invByC[cid][mk].writtenOff += amt;
    });
    return invByC;
  }, [filteredInvs, windowMonths]);

  const custIds = useMemo(() =>
    Object.keys(matrix).map(Number).sort((a, b) => {
      const ca = customers.find(c => c.id === a)?.name ?? "";
      const cb = customers.find(c => c.id === b)?.name ?? "";
      return ca.localeCompare(cb);
    }), [matrix, customers]);

  function getCellVal(cell?: { completed: number; pending: number; writtenOff: number }) {
    if (!cell) return 0;
    if (billView === "collected") return cell.completed;
    if (billView === "secured") return cell.completed + cell.pending;
    return cell.completed + cell.pending + cell.writtenOff;
  }

  const mTotals = useMemo(() => {
    const t: Record<string, number> = {};
    windowMonths.forEach(m => { t[m] = custIds.reduce((s, cid) => s + getCellVal(matrix[cid]?.[m]), 0); });
    return t;
  }, [matrix, custIds, windowMonths, billView]);

  const grand = {
    completed: filteredInvs.reduce((s, i) => s + (i.status === "Completed" ? Number(i.amount) : 0), 0),
    pending: filteredInvs.reduce((s, i) => s + (i.status === "Pending" ? Number(i.amount) : 0), 0),
    writtenOff: filteredInvs.reduce((s, i) => s + (i.status === "Written Off" ? Number(i.amount) : 0), 0),
  };

  const allInvoices = useMemo(() => {
    let rows = invoices.slice().sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    if (statusFilter) rows = rows.filter(i => i.status === statusFilter);
    if (customerFilter.length > 0) rows = rows.filter(i => customerFilter.includes(String(i.customer_id)));
    if (search) rows = rows.filter(i => JSON.stringify(i).toLowerCase().includes(search.toLowerCase()));
    return rows;
  }, [invoices, statusFilter, customerFilter, search]);

  function toggleSelect(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleAll() {
    setSelected(prev => prev.size === allInvoices.length ? new Set() : new Set(allInvoices.map(i => i.id)));
  }
  async function handleBulkDelete() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    await runAction(() => bulkDeleteInvoices(Array.from(selected)), toast, `${selected.size} invoice${selected.size > 1 ? "s" : ""} deleted`);
    setSelected(new Set());
    setBulkBusy(false);
  }

  const statBadge = (s: string) => {
    const m: Record<string, string> = { Completed: "var(--accent)", Pending: "var(--amber-c)", "Written Off": "var(--red-c)" };
    const col = m[s] || "var(--muted2)";
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: col + "22", color: col }}>{s}</span>;
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} · {cur} {fmt(grand.completed)} collected
          </p>
        </div>
      </div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="flex rounded overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {[["6m", "6M"], ["12m", "12M"], ["ytd", "YTD"], ["all", "Inception"]].map(([k, l]) => (
            <button key={k} onClick={() => applyPreset(k)} className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{ background: preset === k ? "var(--accent)" : "var(--card2)", color: preset === k ? "#fff" : "var(--muted)" }}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={billFrom} onChange={e => { setBillFrom(e.target.value); setPreset("custom"); }}
            className="px-2 py-1.5 text-xs rounded border outline-none" style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }} />
          <span className="text-xs" style={{ color: "var(--muted2)" }}>→</span>
          <input type="month" value={billTo} onChange={e => { setBillTo(e.target.value); setPreset("custom"); }}
            className="px-2 py-1.5 text-xs rounded border outline-none" style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded border outline-none"
          style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
          <option value="">All Statuses</option>
          {["Completed", "Pending", "Written Off"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex rounded overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {[["total", "Total"], ["collected", "Collected"], ["secured", "Secured"]].map(([k, l]) => (
            <button key={k} onClick={() => setBillView(k as typeof billView)} className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{ background: billView === k ? "var(--card3)" : "var(--card2)", color: billView === k ? "var(--foreground)" : "var(--muted)" }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        {[
          ["Total Billed", grand.completed + grand.pending + grand.writtenOff, "var(--purple-c)"],
          ["Collected", grand.completed, "var(--accent)"],
          ["Secured", grand.completed + grand.pending, "var(--cyan-c)"],
          ["Pending", grand.pending, "var(--amber-c)"],
          ["Written Off", grand.writtenOff, "var(--red-c)"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-lg p-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
            <div className="text-lg font-bold font-mono" style={{ color: c as string }}>{cur} {fmt(v as number)}</div>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Monthly Billing</h3>
          <span className="text-xs" style={{ color: "var(--muted2)" }}>Green=paid · Amber=pending · Red=written off</span>
        </div>
        <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                <th className="px-3 py-2.5 text-left font-semibold sticky left-0 z-10 min-w-[140px]" style={{ background: "var(--card)", color: "var(--muted2)" }}>Customer</th>
                {windowMonths.map(m => <th key={m} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "var(--muted2)", minWidth: 72 }}>{mLabel(m)}</th>)}
                <th className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--muted2)" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {custIds.map(cid => {
                const cust = customers.find(c => c.id === cid);
                const rowTotal = windowMonths.reduce((s, m) => s + getCellVal(matrix[cid]?.[m]), 0);
                return (
                  <tr key={cid} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 font-semibold sticky left-0 z-10 truncate max-w-[140px]" style={{ background: "var(--card2)", color: "var(--pink)" }}>{cust?.name ?? `#${cid}`}</td>
                    {windowMonths.map(m => {
                      const cell = matrix[cid]?.[m];
                      const v = getCellVal(cell);
                      if (!v) return <td key={m} className="px-3 py-2 text-right" style={{ color: "var(--card3)" }}>—</td>;
                      const col = cell?.writtenOff ? "var(--red-c)" : cell?.pending ? "var(--amber-c)" : "var(--accent)";
                      return <td key={m} className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap" style={{ color: col }}>{cur} {fmt(v)}</td>;
                    })}
                    <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--foreground)" }}>{cur} {fmt(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2" style={{ borderColor: "var(--border2)" }}>
                <td className="px-3 py-2 font-bold sticky left-0" style={{ background: "var(--card)", color: "var(--foreground)" }}>Total</td>
                {windowMonths.map(m => <td key={m} className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap" style={{ color: "var(--accent)" }}>{cur} {fmt(mTotals[m] || 0)}</td>)}
                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--accent)" }}>
                  {cur} {fmt(billView === "collected" ? grand.completed : billView === "secured" ? grand.completed + grand.pending : grand.completed + grand.pending + grand.writtenOff)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* All Invoices List */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 border-b flex flex-wrap justify-between items-center gap-2" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--muted2)" }}><Receipt size={12} /> All Invoices <span style={{ color: "var(--muted2)", fontWeight: 400 }}>({allInvoices.length})</span></h3>
            {selected.size > 0 && (
              <button onClick={handleBulkDelete} disabled={bulkBusy}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                style={{ background: "var(--danger-bg)", color: "var(--red-c)", border: "1px solid var(--red-c)", opacity: bulkBusy ? .6 : 1 }}>
                <Trash2 size={11} />{bulkBusy ? "Deleting…" : `Delete (${selected.size})`}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <MultiSelect
              label="Customer"
              options={customers.map(c => ({ label: c.name, value: String(c.id) }))}
              value={customerFilter}
              onChange={setCustomerFilter}
              minWidth={180}
            />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="px-3 py-1.5 text-xs rounded border outline-none w-36" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            {(customerFilter.length > 0 || search) && (
              <button onClick={() => { setCustomerFilter([]); setSearch(""); }} className="text-xs px-1.5 py-1" style={{ color: "var(--muted2)" }}>✕</button>
            )}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y" style={{ background: "var(--card2)", borderColor: "var(--border)" }}>
          {allInvoices.map(inv => {
            const cust = customers.find(c => c.id === inv.customer_id);
            return (
              <div key={inv.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>{inv.invoice_number || `#${inv.id}`}</span>
                  {statBadge(inv.status)}
                </div>
                <div className="flex items-end justify-between mb-2">
                  <p className="font-semibold text-sm">{cust?.name ?? `#${inv.customer_id}`}</p>
                  <p className="text-xl font-bold font-mono">{cur} {fmt(inv.amount)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{ color: "var(--muted2)" }}>{inv.transaction_date}</p>
                  <a href={`/invoices/${inv.id}/print`} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                    style={{ background: "var(--accent)", color: "#fff" }}><Printer size={12} /> Print</a>
                </div>
              </div>
            );
          })}
          {allInvoices.length === 0 && <div className="p-10 text-center text-sm" style={{ color: "var(--muted2)" }}>No invoices found</div>}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto" style={{ background: "var(--card2)" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                <th className="px-3 py-2.5 w-8">
                  <input type="checkbox" checked={allInvoices.length > 0 && selected.size === allInvoices.length}
                    onChange={toggleAll} className="cursor-pointer" />
                </th>
                {["Date", "Invoice #", "Customer", "Description", "Amount", "Pay Type", "Status", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allInvoices.map(inv => {
                const cust = customers.find(c => c.id === inv.customer_id);
                return (
                  <tr key={inv.id} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)", background: selected.has(inv.id) ? "color-mix(in srgb, var(--accent) 6%, var(--card2))" : undefined }}>
                    <td className="px-3 py-2 w-8"><input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="cursor-pointer" /></td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{inv.transaction_date}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: inv.invoice_number ? "var(--accent)" : "var(--muted2)" }}>{inv.invoice_number || <span style={{ color: "var(--muted2)", fontStyle: "italic" }}>—</span>}</td>
                    <td className="px-3 py-2 font-medium max-w-[140px] truncate">{cust?.name ?? `#${inv.customer_id}`}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: "var(--muted)" }}>{inv.description || "—"}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap font-semibold">{cur} {fmt(inv.amount)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{inv.payment_type_name || "—"}</td>
                    <td className="px-3 py-2">{statBadge(inv.status)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <a href={`/invoices/${inv.id}/print`} target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 rounded text-xs mr-1 font-semibold flex items-center justify-center"
                        style={{ background: "var(--accent)", color: "#fff" }}><Printer size={13} /></a>
                    </td>
                  </tr>
                );
              })}
              {allInvoices.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center" style={{ color: "var(--muted2)" }}>No invoices found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
