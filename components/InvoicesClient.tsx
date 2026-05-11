"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Printer } from "lucide-react";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { createInvoice, updateInvoice, deleteInvoice, updateInvoiceStatus } from "@/server-actions/invoices";

type Invoice = {
  id: number; invoice_number: string | null; amount: number; status: string;
  transaction_date: string | null; due_date: string | null;
  customer_id: number; description: string | null; payment_type_name: string | null;
};
type Customer = { id: number; name: string };
type PaymentType = { id: number; name: string };
type Product = { id: number; name: string; unit_price: number; sku: string | null; is_active: boolean };

type Props = { invoices: Invoice[]; customers: Customer[]; paymentTypes: PaymentType[]; products?: Product[]; currency: string };

function fmt(n: number) { return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fdate(d: string | null) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return "—"; } }

const STATUS_COLORS: Record<string, string> = {
  Completed: "var(--accent)", Pending: "var(--amber-c)", "Written Off": "var(--red-c)"
};

type Line = { description: string; quantity: number; unit_price: number; product_id?: number };

export function InvoicesClient({ invoices, customers, paymentTypes, products = [], currency }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [custFilter, setCustFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modal, setModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editTxDate, setEditTxDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [createTxDate, setCreateTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createDueDate, setCreateDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = invoices.filter(inv => {
    if (statusFilter.length > 0 && !statusFilter.includes(inv.status)) return false;
    if (custFilter.length > 0 && !custFilter.includes(String(inv.customer_id))) return false;
    if (dateFrom && inv.transaction_date && inv.transaction_date < dateFrom) return false;
    if (dateTo && inv.transaction_date && inv.transaction_date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      const cust = customers.find(c => c.id === inv.customer_id)?.name || "";
      return [inv.invoice_number || "", cust, inv.description || ""].join(" ").toLowerCase().includes(q);
    }
    return true;
  });

  const totals = {
    completed: invoices.filter(i => i.status === "Completed").reduce((s, i) => s + i.amount, 0),
    pending: invoices.filter(i => i.status === "Pending").reduce((s, i) => s + i.amount, 0),
    writtenOff: invoices.filter(i => i.status === "Written Off").reduce((s, i) => s + i.amount, 0),
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
    fd.set("amount", String(lineTotal || Number(fd.get("amount") || 0)));
    try { await createInvoice(fd); toast.success("Invoice created"); setModal(false); setLines([{ description: "", quantity: 1, unit_price: 0 }]); }
    catch { toast.error("Failed to create invoice"); }
    finally { setBusy(false); }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editInvoice) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set("lines", JSON.stringify(lines));
    fd.set("amount", String(lineTotal || Number(fd.get("amount") || 0)));
    try { await updateInvoice(editInvoice.id, fd); toast.success("Invoice updated"); setEditInvoice(null); }
    catch { toast.error("Failed to update invoice"); }
    finally { setBusy(false); }
  }

  function openEdit(inv: Invoice) {
    setEditInvoice(inv);
    setEditTxDate(inv.transaction_date?.slice(0, 10) || today);
    setEditDueDate(inv.due_date?.slice(0, 10) || "");
    setLines([{ description: inv.description || "Service", quantity: 1, unit_price: inv.amount }]);
  }

  async function handleDelete(id: number) {
    if (!await confirm("Archive this invoice?", "The invoice will be hidden from the list.")) return;
    setBusy(true);
    await runAction(() => deleteInvoice(id), toast, "Invoice archived");
    setBusy(false);
  }

  async function handleStatusChange(id: number, status: string) {
    try { await updateInvoiceStatus(id, status); toast.success("Status updated"); }
    catch { toast.error("Failed to update status"); }
  }

  const inputCss = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
  const inputStyle = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
            {invoices.length} invoices · {cur} {fmt(totals.completed)} collected
          </p>
        </div>
        <button
          onClick={() => { setCreateTxDate(today); setCreateDueDate(""); setModal(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90 active:scale-[.98]"
          style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
        >
          <Plus size={15} />
          New Invoice
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: "Collected", value: totals.completed, color: "var(--accent)", bg: "var(--success-bg)" },
          { label: "Pending", value: totals.pending, color: "var(--amber-c)", bg: "var(--warning-bg)" },
          { label: "Written Off", value: totals.writtenOff, color: "var(--red-c)", bg: "var(--danger-bg)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>{label}</div>
            <div className="text-2xl font-bold font-mono" style={{ color }}>{cur} {fmt(value)}</div>
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices…"
            className="px-3 py-2.5 text-sm rounded-lg border outline-none flex-1 min-w-0"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
          <MultiSelect
            label="Customer"
            options={customers.map(c => ({ label: c.name, value: String(c.id) }))}
            value={custFilter}
            onChange={setCustFilter}
            minWidth={160}
          />
          <MultiSelect
            label="Status"
            options={[
              { label: "Completed", value: "Completed", color: STATUS_COLORS.Completed },
              { label: "Pending", value: "Pending", color: STATUS_COLORS.Pending },
              { label: "Written Off", value: "Written Off", color: STATUS_COLORS["Written Off"] },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--muted2)" }}>Date</span>
            <DateInput name="date_from" value={dateFrom} onChange={setDateFrom} placeholder="From" />
            <span className="text-xs" style={{ color: "var(--muted2)" }}>–</span>
            <DateInput name="date_to" value={dateTo} onChange={setDateTo} placeholder="To" />
          </div>
          {(custFilter.length > 0 || statusFilter.length > 0 || dateFrom || dateTo || search) && (
            <button onClick={() => { setCustFilter([]); setStatusFilter([]); setDateFrom(""); setDateTo(""); setSearch(""); }}
              className="text-xs px-3 py-1.5 rounded-lg shrink-0"
              style={{ background: "var(--card3)", color: "var(--muted2)", border: "1px solid var(--border)" }}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {filtered.map(inv => {
          const cust = customers.find(c => c.id === inv.customer_id);
          const col = STATUS_COLORS[inv.status] || "var(--muted2)";
          const isOverdue = inv.due_date && inv.status === "Pending" && new Date(inv.due_date) < new Date();
          return (
            <div key={inv.id} className="rounded-2xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-base" style={{ color: "var(--accent)" }}>{inv.invoice_number || `#${inv.id}`}</span>
                <select value={inv.status} onChange={e => handleStatusChange(inv.id, e.target.value)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border-0 outline-none cursor-pointer"
                  style={{ background: col + "22", color: col }}>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Written Off">Written Off</option>
                </select>
              </div>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-xs mb-0.5" style={{ color: "var(--muted2)" }}>Client</p>
                  <Link href={`/customers/${inv.customer_id}`} className="font-semibold text-sm hover:underline">{cust?.name ?? `#${inv.customer_id}`}</Link>
                </div>
                <div className="text-right">
                  <p className="text-xs mb-0.5" style={{ color: "var(--muted2)" }}>Amount</p>
                  <p className="text-xl font-bold font-mono">{cur} {fmt(inv.amount)}</p>
                </div>
              </div>
              <div className="flex gap-4 text-xs mb-3" style={{ color: "var(--muted2)" }}>
                <span>📅 {fdate(inv.transaction_date)}</span>
                {inv.due_date && (
                  <span style={{ color: isOverdue ? "var(--red-c)" : "var(--muted2)" }}>
                    Due {fdate(inv.due_date)}{isOverdue ? " ⚠️" : ""}
                  </span>
                )}
              </div>
              <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <button onClick={() => openEdit(inv)} className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                  <Pencil size={12} /> Edit
                </button>
                <Link href={`/invoices/${inv.id}/print`} target="_blank" className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                  <Printer size={12} /> Print
                </Link>
                <button onClick={() => handleDelete(inv.id)} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--danger-bg)", color: "var(--red-c)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <EmptyState icon="🧾" title="No invoices found"
            description={search || statusFilter.length > 0 ? "Try adjusting your filters." : "Create your first invoice to get started."}
            action={!search && statusFilter.length === 0 ?<button onClick={() => setModal(true)} className="px-4 py-2 text-sm font-semibold rounded-xl" style={{ background: "var(--accent)", color: "#fff" }}>+ New Invoice</button> : undefined}
          />
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                {["Date", "Invoice #", "Customer", "Description", "Due", "Amount", "Pay Type", "Status", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const cust = customers.find(c => c.id === inv.customer_id);
                const col = STATUS_COLORS[inv.status] || "var(--muted2)";
                return (
                  <tr key={inv.id} className="border-b hover:bg-[var(--card3)] transition-colors" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(inv.transaction_date)}</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--accent)" }}>{inv.invoice_number || <span style={{ color: "var(--muted2)", fontStyle: "italic" }}>—</span>}</td>
                    <td className="px-3 py-2 max-w-[130px] truncate font-medium">
                      <Link href={`/customers/${inv.customer_id}`} className="hover:underline">{cust?.name ?? `#${inv.customer_id}`}</Link>
                    </td>
                    <td className="px-3 py-2 max-w-[150px] truncate" style={{ color: "var(--muted)" }}>{inv.description || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: inv.due_date && inv.status === "Pending" && new Date(inv.due_date) < new Date() ? "var(--red-c)" : "var(--muted2)" }}>{fdate(inv.due_date)}</td>
                    <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">{cur} {fmt(inv.amount)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{inv.payment_type_name || "—"}</td>
                    <td className="px-3 py-2">
                      <select value={inv.status} onChange={e => handleStatusChange(inv.id, e.target.value)}
                        className="px-2 py-0.5 rounded text-xs font-semibold border-0 outline-none cursor-pointer"
                        style={{ background: col + "22", color: col }}>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                        <option value="Written Off">Written Off</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(inv)} title="Edit" className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--card3)]" style={{ color: "var(--muted2)", border: "1px solid var(--border)" }}>
                          <Pencil size={12} />
                        </button>
                        <Link href={`/invoices/${inv.id}/print`} target="_blank" title="Print" className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--card3)]" style={{ color: "var(--muted2)", border: "1px solid var(--border)" }}>
                          <Printer size={12} />
                        </Link>
                        <button onClick={() => handleDelete(inv.id)} title="Archive" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: "var(--red-c)", background: "var(--danger-bg)" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9}><EmptyState icon="🧾" title="No invoices found" description={search || statusFilter.length > 0 ? "Try adjusting your filters." : "Create your first invoice to get started."} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal — bottom sheet on mobile */}
      {editInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center overflow-y-auto sm:py-10 sm:px-4"
          style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setEditInvoice(null); }}>
          <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: "var(--border)" }} />
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base font-semibold">Edit Invoice — {editInvoice.invoice_number}</h2>
              <button onClick={() => setEditInvoice(null)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Customer *</label>
                    <select name="customer_id" required defaultValue={editInvoice.customer_id} className={inputCss} style={inputStyle}>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Invoice #</label>
                    <input name="invoice_number" required defaultValue={editInvoice.invoice_number || ""} className={inputCss} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date</label>
                    <DateInput name="transaction_date" value={editTxDate} onChange={setEditTxDate} placeholder="Invoice date" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Due Date</label>
                    <DateInput name="due_date" value={editDueDate} onChange={setEditDueDate} placeholder="Due date (optional)" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                    <select name="status" defaultValue={editInvoice.status} className={inputCss} style={inputStyle}>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Written Off">Written Off</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Payment Type</label>
                    <select name="payment_type_id" className={inputCss} style={inputStyle}>
                      <option value="">— Select —</option>
                      {paymentTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                    <input name="description" defaultValue={editInvoice.description || ""} className={inputCss} style={inputStyle} />
                  </div>
                </div>
                <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Line Items</label>
                    <button type="button" onClick={addLine} className="text-xs px-2 py-1 rounded" style={{ background: "var(--card3)", color: "var(--accent)", border: "1px solid var(--border)" }}>+ Add Row</button>
                  </div>
                  <div className="space-y-2 overflow-x-auto">
                    {lines.map((line, i) => (
                      <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: products.length ? "1fr 1fr 65px 75px 26px" : "1fr 65px 75px 26px", minWidth: 280 }}>
                        {products.length > 0 && (
                          <select onChange={e => pickProduct(i, e.target.value)} className={inputCss + " text-xs"} style={inputStyle} value={line.product_id ? String(line.product_id) : ""}>
                            <option value="">— Product (optional) —</option>
                            {products.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} ({cur} {fmt(p.unit_price)})</option>)}
                          </select>
                        )}
                        <input value={line.description} onChange={e => setLine(i, "description", e.target.value)} placeholder="Description" className={inputCss + " text-xs"} style={inputStyle} />
                        <input type="number" value={line.quantity} min={1} onChange={e => setLine(i, "quantity", Number(e.target.value))} placeholder="Qty" className={inputCss + " text-xs"} style={inputStyle} />
                        <input type="number" value={line.unit_price} min={0} step={0.01} onChange={e => setLine(i, "unit_price", Number(e.target.value))} placeholder="Price" className={inputCss + " text-xs"} style={inputStyle} />
                        <button type="button" onClick={() => removeLine(i)} className="rounded text-xs font-bold w-7 h-7 flex items-center justify-center" style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2 text-sm font-bold" style={{ color: "var(--accent)" }}>Total: {cur} {fmt(lineTotal)}</div>
                </div>
                <input type="hidden" name="amount" value={lineTotal} />
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setEditInvoice(null)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="px-5 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : "Update Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal — bottom sheet on mobile */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center overflow-y-auto sm:py-10 sm:px-4"
          style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: "var(--border)" }} />
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base font-semibold">Create Invoice</h2>
              <button onClick={() => setModal(false)} className="text-xl" style={{ color: "var(--muted2)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Customer *</label>
                    <select name="customer_id" required className={inputCss} style={inputStyle}>
                      <option value="">Select customer…</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Invoice # *</label>
                    <input name="invoice_number" required className={inputCss} style={inputStyle} placeholder="INV-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                    <DateInput name="transaction_date" value={createTxDate} onChange={setCreateTxDate} placeholder="Invoice date" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Due Date</label>
                    <DateInput name="due_date" value={createDueDate} onChange={setCreateDueDate} placeholder="Due date (optional)" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                    <select name="status" defaultValue="Pending" className={inputCss} style={inputStyle}>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Payment Type</label>
                    <select name="payment_type_id" className={inputCss} style={inputStyle}>
                      <option value="">— Select —</option>
                      {paymentTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                    <input name="description" className={inputCss} style={inputStyle} placeholder="Service description…" />
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
                      <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: products.length ? "1fr 1fr 65px 75px 26px" : "1fr 65px 75px 26px", minWidth: 280 }}>
                        {products.length > 0 && (
                          <select onChange={e => pickProduct(i, e.target.value)} className={inputCss + " text-xs"} style={inputStyle} value={line.product_id ? String(line.product_id) : ""}>
                            <option value="">— Product (optional) —</option>
                            {products.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} ({cur} {fmt(p.unit_price)})</option>)}
                          </select>
                        )}
                        <input value={line.description} onChange={e => setLine(i, "description", e.target.value)}
                          placeholder="Description" className={inputCss + " text-xs"} style={inputStyle} />
                        <input type="number" value={line.quantity} min={1} onChange={e => setLine(i, "quantity", Number(e.target.value))}
                          placeholder="Qty" className={inputCss + " text-xs"} style={inputStyle} />
                        <input type="number" value={line.unit_price} min={0} step={0.01} onChange={e => setLine(i, "unit_price", Number(e.target.value))}
                          placeholder="Price" className={inputCss + " text-xs"} style={inputStyle} />
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
                <input type="hidden" name="amount" value={lineTotal} />
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setModal(false)}
                  className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
                <button type="submit" disabled={busy}
                  className="px-5 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} confirmLabel="Archive" />
    </div>
  );
}
