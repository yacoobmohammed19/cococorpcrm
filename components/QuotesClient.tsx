"use client";

import { useState } from "react";
import { Plus, Trash2, FileOutput } from "lucide-react";
import Link from "next/link";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { createQuote, updateQuoteStatus, deleteQuote, convertQuoteToInvoice } from "@/server-actions/quotes";

type Quote = {
  id: number; quote_number: string; customer_id: number; status: string;
  amount: number; valid_until: string | null; notes: string | null; created_at: string;
};
type Customer = { id: number; name: string };
type Product = { id: number; name: string; unit_price: number; sku: string | null; is_active: boolean };
type Line = { description: string; quantity: number; unit_price: number; product_id?: number };

const STATUS_COLORS: Record<string, string> = {
  Draft: "var(--muted2)", Sent: "var(--cyan-c)", Accepted: "var(--accent)",
  Declined: "var(--red-c)", Invoiced: "var(--purple-c)",
};
const STATUSES = ["Draft", "Sent", "Accepted", "Declined"];

const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

function fmt(n: number) { return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}

export function QuotesClient({ quotes, customers, products, currency }: {
  quotes: Quote[]; customers: Customer[]; products: Product[]; currency: string;
}) {
  const cur = currency === "ZAR" ? "R" : "$";
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [modal, setModal] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const filtered = quotes.filter(q => {
    if (statusFilter.length > 0 && !statusFilter.includes(q.status)) return false;
    if (search) {
      const q2 = search.toLowerCase();
      const cust = customers.find(c => c.id === q.customer_id)?.name || "";
      return (q.quote_number + cust).toLowerCase().includes(q2);
    }
    return true;
  });

  const totals = {
    total: quotes.reduce((s, q) => s + q.amount, 0),
    accepted: quotes.filter(q => q.status === "Accepted").reduce((s, q) => s + q.amount, 0),
    pending: quotes.filter(q => q.status === "Draft" || q.status === "Sent").reduce((s, q) => s + q.amount, 0),
  };

  function addLine() { setLines(l => [...l, { description: "", quantity: 1, unit_price: 0 }]); }
  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)); }
  function setLine(i: number, field: keyof Line, val: string | number) {
    setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find(p => String(p.id) === productId);
    if (p) setLines(l => l.map((ln, idx) => idx === i ? { ...ln, product_id: p.id, description: p.name, unit_price: p.unit_price } : ln));
  }
  const lineTotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set("lines", JSON.stringify(lines));
    try {
      await createQuote(fd);
      toast.success("Quote created");
      setModal(false);
      setLines([{ description: "", quantity: 1, unit_price: 0 }]);
    } catch { toast.error("Failed to create quote"); }
    finally { setBusy(false); }
  }

  async function handleStatusChange(id: number, status: string) {
    try { await updateQuoteStatus(id, status); toast.success("Status updated"); }
    catch { toast.error("Failed to update status"); }
  }

  async function handleDelete(id: number) {
    if (!await confirm("Archive this quote?", "The quote will be hidden from the list.")) return;
    await runAction(() => deleteQuote(id), toast, "Quote archived");
  }

  async function handleConvert(id: number, quoteNum: string) {
    if (!await confirm(`Convert ${quoteNum} to an invoice?`, "A new invoice will be created from this quote.")) return;
    setBusy(true);
    await runAction(() => convertQuoteToInvoice(id), toast, "Invoice created from quote");
    setBusy(false);
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
            {quotes.length} quotes · {cur} {fmt(totals.accepted)} accepted
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
        >
          <Plus size={15} />
          New Quote
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {[["Total Quoted", totals.total, "var(--purple-c)"], ["Accepted", totals.accepted, "var(--accent)"], ["In Progress", totals.pending, "var(--amber-c)"]].map(([l, v, c]) => (
          <div key={l as string} className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
            <div className="text-xl font-bold font-mono" style={{ color: c as string }}>{cur} {fmt(v as number)}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotes…"
          className="px-3 py-2 text-sm rounded border outline-none flex-1 min-w-[180px]"
          style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        <MultiSelect
          label="Status"
          options={[...STATUSES, "Invoiced"].map(s => ({ label: s, value: s, color: STATUS_COLORS[s] }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                {["Quote #", "Customer", "Amount", "Valid Until", "Status", "Created", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => {
                const cust = customers.find(c => c.id === q.customer_id);
                const col = STATUS_COLORS[q.status] || "var(--muted2)";
                const isExpired = q.valid_until && q.status !== "Invoiced" && new Date(q.valid_until) < new Date();
                return (
                  <tr key={q.id} className="border-b hover:bg-[var(--card3)] transition-colors" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--accent)" }}>{q.quote_number}</td>
                    <td className="px-3 py-2.5 max-w-[140px] truncate">
                      <Link href={`/customers/${q.customer_id}`} className="font-medium hover:underline" style={{ color: "var(--foreground)" }}>
                        {cust?.name ?? `#${q.customer_id}`}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap">{cur} {fmt(q.amount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: isExpired ? "var(--red-c)" : "var(--muted2)" }}>
                      {fdate(q.valid_until)}{isExpired && " ⚠"}
                    </td>
                    <td className="px-3 py-2.5">
                      <select value={q.status} onChange={e => handleStatusChange(q.id, e.target.value)}
                        disabled={q.status === "Invoiced"}
                        className="px-2 py-0.5 rounded text-xs font-semibold border-0 outline-none cursor-pointer"
                        style={{ background: col + "22", color: col }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        {q.status === "Invoiced" && <option value="Invoiced">Invoiced</option>}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(q.created_at)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex gap-1">
                        {q.status === "Accepted" && (
                          <button onClick={() => handleConvert(q.id, q.quote_number)} disabled={busy}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: "rgba(236,72,153,.15)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                            → Invoice
                          </button>
                        )}
                        <a href={`/quotes/${q.id}/print`} target="_blank"
                          className="px-2 py-1 rounded text-xs flex items-center"
                          style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", textDecoration: "none" }}>🖨️</a>
                        <button onClick={() => handleDelete(q.id)}
                          className="px-2 py-1 rounded text-xs"
                          style={{ border: "1px solid var(--border)", background: "var(--card)" }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon="📋" title={search || statusFilter.length > 0 ? "No quotes match your filters" : "No quotes yet"} description={search || statusFilter.length > 0 ? "Try adjusting your filters." : "Create your first quote to start winning business."} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4"
          style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="w-full max-w-2xl rounded-xl shadow-2xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base font-semibold">Create Quote</h2>
              <button onClick={() => setModal(false)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Customer *</label>
                    <select name="customer_id" required className={inp} style={inpS}>
                      <option value="">Select customer…</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Quote # *</label>
                    <input name="quote_number" required className={inp} style={inpS} placeholder="QUO-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                    <select name="status" defaultValue="Draft" className={inp} style={inpS}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Valid Until</label>
                    <DateInput name="valid_until" value={validUntil} onChange={setValidUntil} placeholder="Pick a date" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                    <textarea name="notes" rows={2} className={inp + " resize-none"} style={inpS} />
                  </div>
                </div>

                {/* Line Items */}
                <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Line Items</label>
                    <button type="button" onClick={addLine}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "var(--card3)", color: "var(--accent)", border: "1px solid var(--border)" }}>+ Add Row</button>
                  </div>
                  <div className="space-y-2 overflow-x-auto">
                    {lines.map((line, i) => (
                      <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: products.length ? "1fr 1fr 65px 70px 26px" : "1fr 65px 70px 26px", minWidth: 280 }}>
                        {products.length > 0 && (
                          <select onChange={e => pickProduct(i, e.target.value)}
                            className={inp + " text-xs"} style={inpS}>
                            <option value="">— Pick product —</option>
                            {products.filter(p => p.is_active).map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({cur} {fmt(p.unit_price)})</option>
                            ))}
                          </select>
                        )}
                        <input value={line.description} onChange={e => setLine(i, "description", e.target.value)}
                          placeholder="Description" className={inp + " text-xs"} style={inpS} />
                        <input type="number" value={line.quantity} min={1} onChange={e => setLine(i, "quantity", Number(e.target.value))}
                          placeholder="Qty" className={inp + " text-xs"} style={inpS} />
                        <input type="number" value={line.unit_price} min={0} step={0.01} onChange={e => setLine(i, "unit_price", Number(e.target.value))}
                          placeholder="Price" className={inp + " text-xs"} style={inpS} />
                        <button type="button" onClick={() => removeLine(i)}
                          className="rounded text-xs font-bold w-7 h-7 flex items-center justify-center"
                          style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2 text-sm font-bold" style={{ color: "var(--accent)" }}>
                    Total: {cur} {fmt(lineTotal)}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setModal(false)}
                  className="px-4 py-2 rounded text-sm" style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
                <button type="submit" disabled={busy}
                  className="px-5 py-2 rounded text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : "Create Quote"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} confirmLabel="Confirm" />
    </div>
  );
}
