"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { updateCustomer } from "@/server-actions/customers";
import { createInvoice, updateInvoice, deleteInvoice, restoreInvoice, updateInvoiceStatus, bulkUpdateInvoices, bulkDeleteInvoices } from "@/server-actions/invoices";
import { createSubscription, cancelSubscription } from "@/server-actions/subscriptions";
import { updateQuoteStatus, convertQuoteToInvoice } from "@/server-actions/quotes";
import { createContact, updateContact, deleteContact } from "@/server-actions/contacts";
import { createActivity, toggleActivity, deleteActivity } from "@/server-actions/activities";

type InvLine = { id?: number; description: string; quantity: number; unit_price: number; line_total?: number; product_id?: number | null };
type Invoice = { id: number; invoice_number: string | null; amount: number; status: string; transaction_date: string | null; due_date: string | null; description?: string | null; payment_type_id?: number | null; payment_type_name?: string | null };
type Subscription = { id: number; description: string; amount: number; frequency: string; start_date: string; end_date: string | null; status: string; invoice_prefix: string; product_id: number | null; payment_type_id: number | null };
type Quote = { id: number; quote_number: string; status: string; amount: number; valid_until: string | null; created_at: string };
type Product = { id: number; name: string; unit_price: number; is_active: boolean };
type PaymentType = { id: number; name: string };
type Contact = { id: number; name: string; email: string | null; phone: string | null; role: string | null; is_primary: boolean };
type Activity = { id: number; type: string; subject: string; notes: string | null; due_date: string | null; done: boolean; created_at: string };
type Customer = { id: number; name: string; email: string | null; phone: string | null; contact_person: string | null; source: string | null; notes: string | null };

const ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Task", "Note"];
const STATUS_COLORS: Record<string, string> = { Completed: "var(--accent)", Pending: "var(--amber-c)", "Written Off": "var(--red-c)" };

const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}
function fmt(n: number) { return n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

type ProductPurchased = { id: number; name: string; times: number; revenue: number };

const TABS = ["Info", "Invoices", "Quotes", "Products", "Contacts", "Activities"] as const;
type Tab = typeof TABS[number];

const FREQ_LABELS: Record<string, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", annually: "Annually" };

function getPreviewCount(start: string, end: string, freq: string): number {
  if (!start) return 0;
  let count = 0;
  const current = new Date(start + "T00:00:00");
  const endDate = end ? new Date(end + "T00:00:00") : null;
  const MAX = 60;
  while (count < MAX) {
    if (endDate && current > endDate) break;
    count++;
    switch (freq) {
      case "weekly":    current.setDate(current.getDate() + 7); break;
      case "monthly":   current.setMonth(current.getMonth() + 1); break;
      case "quarterly": current.setMonth(current.getMonth() + 3); break;
      case "annually":  current.setFullYear(current.getFullYear() + 1); break;
    }
    if (!endDate && count >= 12) break;
  }
  return count;
}

const QUOTE_STATUS_COLORS: Record<string, string> = {
  Draft: "var(--muted2)", Sent: "var(--cyan-c)", Accepted: "var(--accent)",
  Declined: "var(--red-c)", Invoiced: "var(--purple-c)",
};

export function CustomerDetailClient({ customer, invoices, invoiceLinesMap = {}, products = [], paymentTypes = [], quotes = [], contacts, activities, currency, customerId, productsPurchased = [], subscriptions = [] }: {
  customer: Customer; invoices: Invoice[];
  invoiceLinesMap?: Record<number, InvLine[]>;
  products?: Product[];
  paymentTypes?: PaymentType[];
  quotes?: Quote[]; contacts: Contact[];
  activities: Activity[]; currency: string; customerId: number;
  productsPurchased?: ProductPurchased[];
  subscriptions?: Subscription[];
}) {
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [activityDueDate, setActivityDueDate] = useState("");
  const [tab, setTab] = useState<Tab>("Info");
  const [busy, setBusy] = useState(false);
  const [editInfo, setEditInfo] = useState(false);
  const [contactModal, setContactModal] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [activityModal, setActivityModal] = useState(false);
  const [invModal, setInvModal] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null });
  const [editLines, setEditLines] = useState<InvLine[]>([]);
  const [editTxDate, setEditTxDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [newInvModal, setNewInvModal] = useState(false);
  const [newInvLines, setNewInvLines] = useState<InvLine[]>([{ description: "", quantity: 1, unit_price: 0, product_id: null }]);
  const [newInvTxDate, setNewInvTxDate] = useState("");
  const [newInvDueDate, setNewInvDueDate] = useState("");
  // Bulk selection
  const [selectedInvIds, setSelectedInvIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkPayType, setBulkPayType] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  // Subscription
  const [subModal, setSubModal] = useState(false);
  const [subFreq, setSubFreq] = useState("monthly");
  const [subStart, setSubStart] = useState(new Date().toISOString().slice(0, 10));
  const [subEnd, setSubEnd] = useState("");
  const [subAmount, setSubAmount] = useState(0);
  const [subProduct, setSubProduct] = useState<number | null>(null);
  // AI
  const [health, setHealth] = useState<{ score: string; reason: string } | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [newInvDesc, setNewInvDesc] = useState("");
  const [descBusy, setDescBusy] = useState(false);
  const healthFetched = useRef(false);

  // Fetch health score once on mount
  useEffect(() => {
    if (healthFetched.current) return;
    healthFetched.current = true;
    const cacheKey = `crm_health_${customerId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { setHealth(JSON.parse(cached) as { score: string; reason: string }); return; }
    } catch { /* ignore */ }
    const now = Date.now();
    const paidCount = invoices.filter(i => i.status === "Completed").length;
    const pendingCount = invoices.filter(i => i.status === "Pending").length;
    const overdueCount = invoices.filter(i => i.status === "Pending" && i.due_date && new Date(i.due_date).getTime() < now).length;
    const lastAct = activities[0]?.created_at ?? null;
    const lastActivityDays = lastAct ? Math.floor((now - new Date(lastAct).getTime()) / 86400000) : null;
    const totalRevenue = invoices.filter(i => i.status === "Completed").reduce((s, i) => s + i.amount, 0);
    const activeSubscriptions = subscriptions.filter(s => s.status === "active").length;

    setHealthLoading(true);
    fetch("/api/ai-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "health",
        data: { customerName: customer.name, totalInvoices: invoices.length, paidCount, pendingCount, overdueCount, lastActivityDays, activeSubscriptions, currency, totalRevenue },
      }),
    })
      .then(r => r.json())
      .then((j: { result?: string; error?: string }) => {
        if (j.result) {
          try {
            const parsed = JSON.parse(j.result) as { score: string; reason: string };
            setHealth(parsed);
            try { sessionStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch { /* ignore */ }
          } catch { /* malformed JSON from AI */ }
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => setHealthLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const HEALTH_COLORS: Record<string, string> = {
    Healthy: "var(--accent)",
    "At Risk": "var(--amber-c)",
    Churned: "var(--red-c)",
  };

  async function generateInvDesc() {
    const lineTotal = newInvLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    setDescBusy(true);
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "description",
          data: { customerName: customer.name, lines: newInvLines, totalAmount: lineTotal, currency },
        }),
      });
      const j = await res.json() as { result?: string };
      if (j.result) setNewInvDesc(j.result);
    } catch { /* silent */ }
    finally { setDescBusy(false); }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-semibold transition-colors"
            style={{ borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent", color: tab === t ? "var(--accent)" : "var(--muted2)" }}>
            {t}
            {t === "Invoices" && invoices.length > 0 && <span className="ml-1 text-xs">({invoices.length})</span>}
            {t === "Quotes" && quotes.length > 0 && <span className="ml-1 text-xs">({quotes.length})</span>}
            {t === "Products" && productsPurchased.length > 0 && <span className="ml-1 text-xs">({productsPurchased.length})</span>}
            {t === "Contacts" && contacts.length > 0 && <span className="ml-1 text-xs">({contacts.length})</span>}
            {t === "Activities" && activities.length > 0 && <span className="ml-1 text-xs">({activities.length})</span>}
            {t === "Invoices" && subscriptions.filter(s => s.status === "active").length > 0 && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--success-bg)", color: "var(--accent)" }}>{subscriptions.filter(s => s.status === "active").length} sub{subscriptions.filter(s => s.status === "active").length !== 1 ? "s" : ""}</span>}
          </button>
        ))}
      </div>

      {/* INFO TAB */}
      {tab === "Info" && (
        <div className="rounded-lg p-5 space-y-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
          {/* Health Score Badge */}
          {(health || healthLoading) && (
            <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-lg" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 14 }}>✨</span>
              {healthLoading && <span className="text-xs" style={{ color: "var(--muted2)" }}>Analysing customer health…</span>}
              {health && (
                <>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: HEALTH_COLORS[health.score] + "22", color: HEALTH_COLORS[health.score] }}>{health.score}</span>
                  <span className="text-xs" style={{ color: "var(--muted2)" }}>{health.reason}</span>
                </>
              )}
            </div>
          )}

          {!editInfo ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[["Email", customer.email], ["Phone", customer.phone], ["Contact Person", customer.contact_person], ["Source", customer.source]].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted2)" }}>{l}</div>
                    <div>{v || "—"}</div>
                  </div>
                ))}
                {customer.notes && (
                  <div className="col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted2)" }}>Notes</div>
                    <div style={{ color: "var(--muted)" }}>{customer.notes}</div>
                  </div>
                )}
              </div>
              <button onClick={() => setEditInfo(true)}
                className="px-4 py-2 text-sm rounded border"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>✏️ Edit Info</button>
            </>
          ) : (
            <form className="space-y-3"
              action={async (fd: FormData) => {
                setBusy(true);
                try { await updateCustomer(customerId, fd); toast.success("Customer updated"); setEditInfo(false); }
                catch { toast.error("Failed to update"); }
                finally { setBusy(false); }
              }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Name *</label>
                  <input name="name" required defaultValue={customer.name} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Email</label>
                  <input name="email" type="email" defaultValue={customer.email || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Phone</label>
                  <input name="phone" defaultValue={customer.phone || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Contact Person</label>
                  <input name="contact_person" defaultValue={customer.contact_person || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Source</label>
                  <select name="source" defaultValue={customer.source || ""} className={inp} style={inpS}>
                    <option value="">— None —</option>
                    {["Referral", "Website", "Cold Call", "Social Media", "Event", "Other"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                  <textarea name="notes" rows={3} defaultValue={customer.notes || ""} className={inp + " resize-none"} style={inpS} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditInfo(false)} className="px-4 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold rounded" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* INVOICES TAB */}
      {tab === "Invoices" && (
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</span>
            <div className="flex gap-2">
              <button onClick={() => { setSubFreq("monthly"); setSubStart(new Date().toISOString().slice(0, 10)); setSubEnd(""); setSubAmount(0); setSubProduct(null); setSubModal(true); }}
                className="text-xs px-3 py-1.5 rounded font-semibold"
                style={{ background: "var(--card2)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                + New Subscription
              </button>
              <button onClick={() => { setNewInvTxDate(new Date().toISOString().slice(0, 10)); setNewInvDueDate(""); setNewInvLines([{ description: "", quantity: 1, unit_price: 0, product_id: null }]); setNewInvDesc(""); setNewInvModal(true); }}
                className="text-xs px-3 py-1.5 rounded font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}>
                + New Invoice
              </button>
            </div>
          </div>

          {/* Bulk bar */}
          {selectedInvIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg mb-2"
              style={{ background: "var(--primary)", color: "var(--primary-fg)" }}>
              <span className="text-xs font-bold">{selectedInvIds.size} selected</span>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                className="px-2 py-1 rounded text-xs border-0 outline-none"
                style={{ background: "rgba(255,255,255,0.12)", color: "inherit" }}>
                <option value="">Status…</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Written Off">Written Off</option>
              </select>
              <select value={bulkPayType} onChange={e => setBulkPayType(e.target.value)}
                className="px-2 py-1 rounded text-xs border-0 outline-none"
                style={{ background: "rgba(255,255,255,0.12)", color: "inherit" }}>
                <option value="">Pay Type…</option>
                <option value="none">— Clear —</option>
                {paymentTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button disabled={bulkBusy || (!bulkStatus && !bulkPayType)}
                onClick={async () => {
                  setBulkBusy(true);
                  try {
                    const updates: { status?: string; payment_type_id?: number | null } = {};
                    if (bulkStatus) updates.status = bulkStatus;
                    if (bulkPayType) updates.payment_type_id = bulkPayType === "none" ? null : Number(bulkPayType);
                    if (Object.keys(updates).length === 0) return;
                    const ids = Array.from(selectedInvIds);
                    const oldStatuses = ids.map(id => ({ id, status: invoices.find(i => i.id === id)?.status }));
                    await bulkUpdateInvoices(ids, updates);
                    const n = ids.length;
                    toast.undoable(`Updated ${n} invoice${n > 1 ? "s" : ""}`, async () => {
                      if (updates.status) await Promise.all(oldStatuses.map(s => s.status ? updateInvoiceStatus(s.id, s.status) : Promise.resolve()));
                    });
                    setSelectedInvIds(new Set()); setBulkStatus(""); setBulkPayType("");
                  } catch { toast.error("Bulk update failed"); }
                  finally { setBulkBusy(false); }
                }}
                className="px-3 py-1 rounded text-xs font-bold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff" }}>
                {bulkBusy ? "…" : "Apply"}
              </button>
              <button disabled={bulkBusy}
                onClick={async () => {
                  if (!await confirm(`Delete ${selectedInvIds.size} invoices?`, "These invoices will be archived.")) return;
                  setBulkBusy(true);
                  const ids = Array.from(selectedInvIds);
                  try {
                    await bulkDeleteInvoices(ids);
                    toast.undoable(`Archived ${ids.length} invoice${ids.length > 1 ? "s" : ""}`, async () => {
                      await Promise.all(ids.map(id => restoreInvoice(id)));
                    });
                    setSelectedInvIds(new Set());
                  } catch { toast.error("Failed"); }
                  finally { setBulkBusy(false); }
                }}
                className="px-3 py-1 rounded text-xs font-bold"
                style={{ background: "rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                Delete
              </button>
              <button onClick={() => { setSelectedInvIds(new Set()); setBulkStatus(""); setBulkPayType(""); }}
                className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto"><table className="w-full text-xs border-collapse" style={{ background: "var(--card2)" }}>
              <thead>
                <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                  <th className="px-3 py-2.5 w-8">
                    <input type="checkbox"
                      checked={invoices.length > 0 && selectedInvIds.size === invoices.length}
                      onChange={() => setSelectedInvIds(prev => prev.size === invoices.length ? new Set() : new Set(invoices.map(i => i.id)))}
                      className="rounded cursor-pointer" />
                  </th>
                  {["Date", "Invoice #", "Description", "Amount", "Due", "Pay Type", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const col = STATUS_COLORS[inv.status] || "var(--muted2)";
                  const isOverdue = inv.due_date && inv.status === "Pending" && new Date(inv.due_date) < new Date();
                  const selected = selectedInvIds.has(inv.id);
                  return (
                    <tr key={inv.id}
                      className="border-b hover:bg-[var(--card3)] cursor-pointer"
                      style={{ borderColor: "var(--border)", background: selected ? "color-mix(in srgb, var(--accent) 6%, var(--card2))" : undefined }}
                      onClick={() => {
                        setInvModal({ open: true, invoice: inv });
                        setEditLines(invoiceLinesMap[inv.id]?.length ? invoiceLinesMap[inv.id].map(l => ({ ...l })) : [{ description: "", quantity: 1, unit_price: 0, product_id: null }]);
                        setEditTxDate(inv.transaction_date?.slice(0, 10) ?? "");
                        setEditDueDate(inv.due_date?.slice(0, 10) ?? "");
                      }}>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected}
                          onChange={() => setSelectedInvIds(prev => { const s = new Set(prev); s.has(inv.id) ? s.delete(inv.id) : s.add(inv.id); return s; })}
                          className="rounded cursor-pointer" />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(inv.transaction_date)}</td>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--accent)" }}>{inv.invoice_number || `#${inv.id}`}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: "var(--muted)" }}>{inv.description || "—"}</td>
                      <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">{currency} {fmt(inv.amount)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: isOverdue ? "var(--red-c)" : "var(--muted2)" }}>{fdate(inv.due_date)}{isOverdue ? " ⚠" : ""}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{inv.payment_type_name || "—"}</td>
                      <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: col + "22", color: col }}>{inv.status}</span></td>
                      <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Link href={`/invoices/${inv.id}/print`} target="_blank"
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: "var(--card3)", color: "var(--muted2)", border: "1px solid var(--border)" }}>
                            🖨️
                          </Link>
                          <button
                            onClick={async () => {
                              if (!await confirm(`Delete ${inv.invoice_number || `#${inv.id}`}?`, "This invoice will be archived.")) return;
                              try {
                                await deleteInvoice(inv.id);
                                toast.undoable("Invoice archived", () => restoreInvoice(inv.id));
                              } catch { toast.error("Failed to delete invoice"); }
                            }}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)", border: "1px solid rgba(239,68,68,.2)" }}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center" style={{ color: "var(--muted2)" }}>No invoices yet</td></tr>}
              </tbody>
            </table></div>
          </div>

          {/* Subscriptions summary */}
          {subscriptions.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted2)" }}>
                Subscriptions ({subscriptions.filter(s => s.status === "active").length} active)
              </p>
              <div className="space-y-2">
                {subscriptions.map(sub => {
                  const active = sub.status === "active";
                  return (
                    <div key={sub.id} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-xs"
                      style={{ background: "var(--card2)", border: "1px solid var(--border)", opacity: active ? 1 : 0.55 }}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-semibold truncate">{sub.description || "Subscription"}</span>
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                          style={{ background: active ? "var(--success-bg)" : "var(--card3)", color: active ? "var(--accent)" : "var(--muted2)" }}>
                          {sub.status}
                        </span>
                        <span className="shrink-0" style={{ color: "var(--muted2)" }}>{FREQ_LABELS[sub.frequency] || sub.frequency}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-semibold" style={{ color: "var(--accent)" }}>{currency} {fmt(sub.amount)}</span>
                        {active && (
                          <button
                            onClick={async () => {
                              if (!await confirm("Cancel this subscription?", "No more invoices will be generated. Existing invoices are kept.")) return;
                              await runAction(() => cancelSubscription(sub.id, customerId), toast, "Subscription cancelled");
                            }}
                            className="px-2 py-1 rounded font-semibold"
                            style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)", border: "1px solid rgba(239,68,68,.2)" }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* QUOTES TAB */}
      {tab === "Quotes" && (
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold">{quotes.length} quote{quotes.length !== 1 ? "s" : ""}</span>
            <Link href="/quotes" className="text-xs px-3 py-1.5 rounded" style={{ background: "var(--accent)", color: "#fff" }}>+ New Quote</Link>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ background: "var(--card2)" }}>
                <thead>
                  <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                    {["Quote #", "Amount", "Valid Until", "Status", "Created", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotes.map(q => {
                    const col = QUOTE_STATUS_COLORS[q.status] || "var(--muted2)";
                    const isExpired = q.valid_until && q.status !== "Invoiced" && new Date(q.valid_until) < new Date();
                    return (
                      <tr key={q.id} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2 font-semibold" style={{ color: "var(--accent)" }}>{q.quote_number}</td>
                        <td className="px-3 py-2 font-mono font-semibold">{currency} {fmt(q.amount)}</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: isExpired ? "var(--red-c)" : "var(--muted2)" }}>
                          {fdate(q.valid_until)}{isExpired ? " ⚠" : ""}
                        </td>
                        <td className="px-3 py-2">
                          <select value={q.status}
                            disabled={q.status === "Invoiced"}
                            onChange={async e => {
                              try { await updateQuoteStatus(q.id, e.target.value); toast.success("Status updated"); }
                              catch { toast.error("Failed to update status"); }
                            }}
                            className="px-2 py-0.5 rounded text-xs font-semibold border-0 outline-none cursor-pointer"
                            style={{ background: col + "22", color: col }}>
                            {["Draft", "Sent", "Accepted", "Declined"].map(s => <option key={s} value={s}>{s}</option>)}
                            {q.status === "Invoiced" && <option value="Invoiced">Invoiced</option>}
                          </select>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(q.created_at)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex gap-1">
                            {q.status === "Accepted" && (
                              <button
                                onClick={async () => {
                                  setBusy(true);
                                  try { await convertQuoteToInvoice(q.id); toast.success("Invoice created"); }
                                  catch { toast.error("Conversion failed"); }
                                  finally { setBusy(false); }
                                }}
                                disabled={busy}
                                className="px-2 py-1 rounded text-xs font-semibold"
                                style={{ background: "rgba(16,185,129,.15)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                                → Invoice
                              </button>
                            )}
                            <a href={`/quotes/${q.id}/print`} target="_blank"
                              className="px-2 py-1 rounded text-xs"
                              style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", textDecoration: "none" }}>
                              🖨️
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {quotes.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--muted2)" }}>No quotes yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTS TAB */}
      {tab === "Products" && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {productsPurchased.length === 0 ? (
            <p className="p-6 text-sm text-center" style={{ color: "var(--muted2)" }}>
              No products linked yet — tag products on invoices to see them here.
            </p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                  {["Product / Service", "Times Purchased", "Revenue"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productsPurchased.map(p => (
                  <tr key={p.id} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
                    <td className="px-4 py-2.5 font-semibold">
                      <Link href="/products" className="hover:underline" style={{ color: "var(--foreground)" }}>{p.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--muted2)" }}>{p.times}×</td>
                    <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "var(--accent)" }}>{currency} {fmt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* CONTACTS TAB */}
      {tab === "Contacts" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</span>
            <button onClick={() => setContactModal({ open: true, contact: null })}
              className="text-xs px-3 py-1.5 rounded font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}>+ Add Contact</button>
          </div>
          <div className="space-y-2">
            {contacts.map(c => (
              <div key={c.id} className="rounded-lg p-4 flex items-center justify-between gap-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {c.name}
                    {c.is_primary && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(16,185,129,.12)", color: "var(--accent)" }}>Primary</span>}
                  </div>
                  <div className="text-xs mt-0.5 space-x-3" style={{ color: "var(--muted2)" }}>
                    {c.role && <span>{c.role}</span>}
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span>{c.phone}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setContactModal({ open: true, contact: c })} className="px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>✏️</button>
                  <button onClick={async () => { if (!await confirm(`Delete ${c.name}?`, "This contact will be permanently removed.")) return; await runAction(() => deleteContact(c.id, customerId), toast, "Contact deleted"); }}
                    className="px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>🗑️</button>
                </div>
              </div>
            ))}
            {contacts.length === 0 && <p className="text-sm text-center py-6" style={{ color: "var(--muted2)" }}>No contacts yet — add the people you deal with at this company</p>}
          </div>
        </div>
      )}

      {/* ACTIVITIES TAB */}
      {tab === "Activities" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold">{activities.length} activit{activities.length !== 1 ? "ies" : "y"}</span>
            <button onClick={() => { setActivityDueDate(""); setActivityModal(true); }}
              className="text-xs px-3 py-1.5 rounded font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}>+ Log Activity</button>
          </div>
          <div className="space-y-2">
            {activities.map(a => (
              <div key={a.id} className="rounded-lg p-3 flex items-start gap-3" style={{ background: "var(--card2)", border: "1px solid var(--border)", opacity: a.done ? .6 : 1 }}>
                <button onClick={async () => { try { await toggleActivity(a.id, !a.done, undefined, customerId); } catch { toast.error("Failed"); } }}
                  className="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ borderColor: a.done ? "var(--accent)" : "var(--border)", background: a.done ? "var(--accent)" : "transparent", color: "#fff" }}>
                  {a.done ? "✓" : ""}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--card3)", color: "var(--muted)" }}>{a.type}</span>
                    <span className="text-sm font-medium" style={{ textDecoration: a.done ? "line-through" : "none" }}>{a.subject}</span>
                    {a.due_date && <span className="text-xs" style={{ color: !a.done && new Date(a.due_date) < new Date() ? "var(--red-c)" : "var(--muted2)" }}>Due {fdate(a.due_date)}</span>}
                  </div>
                  {a.notes && <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>{a.notes}</p>}
                </div>
                <button onClick={async () => { if (!await confirm("Delete activity?", "This activity will be permanently removed.")) return; await runAction(() => deleteActivity(a.id, undefined, customerId), toast, "Activity deleted"); }}
                  className="px-2 py-1 rounded text-xs shrink-0" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>🗑️</button>
              </div>
            ))}
            {activities.length === 0 && <p className="text-sm text-center py-6" style={{ color: "var(--muted2)" }}>No activities yet</p>}
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {contactModal.open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setContactModal({ open: false, contact: null }); }}>
          <div className="w-full max-w-md rounded-xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">{contactModal.contact ? "Edit Contact" : "Add Contact"}</h3>
              <button onClick={() => setContactModal({ open: false, contact: null })} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                fd.set("customer_id", String(customerId));
                setBusy(true);
                try {
                  if (contactModal.contact) { await updateContact(contactModal.contact.id, fd); toast.success("Contact updated"); }
                  else { await createContact(fd); toast.success("Contact added"); }
                  setContactModal({ open: false, contact: null });
                } catch { toast.error("Something went wrong"); }
                finally { setBusy(false); }
              }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Name *</label>
                  <input name="name" required defaultValue={contactModal.contact?.name || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Email</label>
                  <input name="email" type="email" defaultValue={contactModal.contact?.email || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Phone</label>
                  <input name="phone" defaultValue={contactModal.contact?.phone || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Role / Title</label>
                  <input name="role" defaultValue={contactModal.contact?.role || ""} className={inp} style={inpS} placeholder="e.g. CEO, Procurement" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Primary Contact?</label>
                  <select name="is_primary" defaultValue={contactModal.contact?.is_primary ? "true" : "false"} className={inp} style={inpS}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setContactModal({ open: false, contact: null })} className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2 text-sm font-semibold rounded" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : contactModal.contact ? "Update" : "Add Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {activityModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setActivityModal(false); }}>
          <div className="w-full max-w-md rounded-xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">Log Activity</h3>
              <button onClick={() => setActivityModal(false)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                fd.set("customer_id", String(customerId));
                setBusy(true);
                try { await createActivity(fd); toast.success("Activity logged"); setActivityModal(false); }
                catch { toast.error("Failed to log activity"); }
                finally { setBusy(false); }
              }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Type *</label>
                  <select name="type" className={inp} style={inpS}>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Due Date</label>
                  <DateInput name="due_date" value={activityDueDate} onChange={setActivityDueDate} placeholder="Due date (optional)" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Subject *</label>
                  <input name="subject" required className={inp} style={inpS} placeholder="e.g. Follow-up call, Send proposal…" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                  <textarea name="notes" rows={3} className={inp + " resize-none"} style={inpS} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setActivityModal(false)} className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2 text-sm font-semibold rounded" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : "Log Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Invoice Edit Modal */}
      {invModal.open && invModal.invoice && (() => {
        const inv = invModal.invoice;
        const lineTotal = editLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
            style={{ background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)" }}
            onClick={e => { if (e.target === e.currentTarget) setInvModal({ open: false, invoice: null }); }}>
            <div className="w-full max-w-2xl rounded-xl mb-10" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <h3 className="font-semibold">Edit Invoice — {inv.invoice_number || `#${inv.id}`}</h3>
                <button onClick={() => setInvModal({ open: false, invoice: null })} style={{ color: "var(--muted2)" }}>✕</button>
              </div>
              <form className="p-5 space-y-4"
                action={async (fd: FormData) => {
                  fd.set("customer_id", String(customerId));
                  fd.set("transaction_date", editTxDate);
                  fd.set("due_date", editDueDate);
                  fd.set("amount", String(lineTotal || inv.amount));
                  fd.set("lines", JSON.stringify(editLines.filter(l => l.description.trim()).map(l => ({
                    description: l.description,
                    quantity: l.quantity,
                    unit_price: l.unit_price,
                    product_id: l.product_id ?? null,
                  }))));
                  setBusy(true);
                  try {
                    await updateInvoice(inv.id, fd);
                    toast.success("Invoice updated");
                    setInvModal({ open: false, invoice: null });
                  } catch { toast.error("Failed to save invoice"); }
                  finally { setBusy(false); }
                }}>
                {/* Top fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Invoice #</label>
                    <input name="invoice_number" defaultValue={inv.invoice_number || ""} className={inp} style={inpS} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                    <select name="status" defaultValue={inv.status} className={inp} style={inpS}>
                      {["Pending", "Completed", "Written Off"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Transaction Date</label>
                    <DateInput name="transaction_date" value={editTxDate} onChange={setEditTxDate} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Due Date</label>
                    <DateInput name="due_date" value={editDueDate} onChange={setEditDueDate} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Payment Type</label>
                    <select name="payment_type_id" defaultValue={inv.payment_type_id ?? ""} className={inp} style={inpS}>
                      <option value="">— None —</option>
                      {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                    <input name="description" defaultValue={inv.description || ""} className={inp} style={inpS} placeholder="Optional overall note" />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Line Items</label>
                    <button type="button"
                      onClick={() => setEditLines(ls => [...ls, { description: "", quantity: 1, unit_price: 0, product_id: null }])}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "var(--card3)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                      + Add Row
                    </button>
                  </div>
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <table className="w-full text-xs" style={{ background: "var(--card)" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          {["Product", "Description", "Qty", "Unit Price", "Total", ""].map(h => (
                            <th key={h} className="px-2 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {editLines.map((line, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td className="px-2 py-1.5 min-w-[130px]">
                              <select value={line.product_id ?? ""}
                                onChange={e => {
                                  const pid = e.target.value ? Number(e.target.value) : null;
                                  const prod = products.find(p => p.id === pid);
                                  setEditLines(ls => ls.map((l, i) => i !== idx ? l : {
                                    ...l,
                                    product_id: pid,
                                    description: prod ? prod.name : l.description,
                                    unit_price: prod ? prod.unit_price : l.unit_price,
                                  }));
                                }}
                                className="w-full px-2 py-1 rounded border text-xs outline-none"
                                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                                <option value="">— custom —</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5 min-w-[150px]">
                              <input value={line.description}
                                onChange={e => setEditLines(ls => ls.map((l, i) => i !== idx ? l : { ...l, description: e.target.value }))}
                                className="w-full px-2 py-1 rounded border text-xs outline-none"
                                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                                placeholder="Description" />
                            </td>
                            <td className="px-2 py-1.5 w-16">
                              <input type="number" min={0} step="any" value={line.quantity}
                                onChange={e => setEditLines(ls => ls.map((l, i) => i !== idx ? l : { ...l, quantity: Number(e.target.value) }))}
                                className="w-full px-2 py-1 rounded border text-xs outline-none text-right"
                                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                            </td>
                            <td className="px-2 py-1.5 w-24">
                              <input type="number" min={0} step="any" value={line.unit_price}
                                onChange={e => setEditLines(ls => ls.map((l, i) => i !== idx ? l : { ...l, unit_price: Number(e.target.value) }))}
                                className="w-full px-2 py-1 rounded border text-xs outline-none text-right"
                                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                            </td>
                            <td className="px-2 py-1.5 font-mono text-right whitespace-nowrap" style={{ color: "var(--accent)" }}>
                              {currency} {fmt(line.quantity * line.unit_price)}
                            </td>
                            <td className="px-2 py-1.5">
                              <button type="button"
                                onClick={() => setEditLines(ls => ls.filter((_, i) => i !== idx))}
                                className="px-1.5 py-0.5 rounded text-xs"
                                style={{ color: "var(--red-c)", background: "rgba(239,68,68,.1)" }}>✕</button>
                            </td>
                          </tr>
                        ))}
                        {editLines.length === 0 && (
                          <tr><td colSpan={6} className="px-3 py-4 text-center" style={{ color: "var(--muted2)" }}>No lines — click + Add Row</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {editLines.length > 0 && (
                    <div className="flex justify-end mt-2 text-sm font-bold font-mono" style={{ color: "var(--accent)" }}>
                      Total: {currency} {fmt(lineTotal)}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setInvModal({ open: false, invoice: null })}
                    className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                  <button type="submit" disabled={busy}
                    className="flex-1 py-2 text-sm font-semibold rounded"
                    style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                    {busy ? "Saving…" : "Save Invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
      {/* New Invoice Modal */}
      {newInvModal && (() => {
        const lineTotal = newInvLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
            style={{ background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)" }}
            onClick={e => { if (e.target === e.currentTarget) setNewInvModal(false); }}>
            <div className="w-full max-w-2xl rounded-xl mb-10" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <h3 className="font-semibold">New Invoice</h3>
                <button onClick={() => setNewInvModal(false)} style={{ color: "var(--muted2)" }}>✕</button>
              </div>
              <form className="p-5 space-y-4"
                action={async (fd: FormData) => {
                  fd.set("customer_id", String(customerId));
                  fd.set("transaction_date", newInvTxDate);
                  fd.set("due_date", newInvDueDate);
                  fd.set("amount", String(lineTotal));
                  fd.set("lines", JSON.stringify(newInvLines.filter(l => l.description.trim()).map(l => ({
                    description: l.description, quantity: l.quantity, unit_price: l.unit_price, product_id: l.product_id ?? null,
                  }))));
                  setBusy(true);
                  try { await createInvoice(fd); toast.success("Invoice created"); setNewInvModal(false); }
                  catch { toast.error("Failed to create invoice"); }
                  finally { setBusy(false); }
                }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Invoice # *</label>
                    <input name="invoice_number" required className={inp} style={inpS} placeholder="INV-001" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                    <select name="status" defaultValue="Pending" className={inp} style={inpS}>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                    <DateInput name="transaction_date" value={newInvTxDate} onChange={setNewInvTxDate} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Due Date</label>
                    <DateInput name="due_date" value={newInvDueDate} onChange={setNewInvDueDate} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Payment Type</label>
                    <select name="payment_type_id" className={inp} style={inpS}>
                      <option value="">— None —</option>
                      {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Description</label>
                      <button type="button" onClick={generateInvDesc} disabled={descBusy}
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-opacity hover:opacity-80"
                        style={{ background: "rgba(16,185,129,.12)", color: "var(--accent)", border: "1px solid var(--accent)", opacity: descBusy ? 0.5 : 1 }}>
                        {descBusy ? "…" : "✨ Generate"}
                      </button>
                    </div>
                    <input name="description" value={newInvDesc} onChange={e => setNewInvDesc(e.target.value)} className={inp} style={inpS} placeholder="Optional note" />
                  </div>
                </div>
                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Line Items</label>
                    <button type="button"
                      onClick={() => setNewInvLines(ls => [...ls, { description: "", quantity: 1, unit_price: 0, product_id: null }])}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "var(--card3)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                      + Add Row
                    </button>
                  </div>
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <table className="w-full text-xs" style={{ background: "var(--card)" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          {["Product", "Description", "Qty", "Unit Price", "Total", ""].map(h => (
                            <th key={h} className="px-2 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {newInvLines.map((line, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td className="px-2 py-1.5 min-w-[130px]">
                              <select value={line.product_id ?? ""}
                                onChange={e => {
                                  const pid = e.target.value ? Number(e.target.value) : null;
                                  const prod = products.find(p => p.id === pid);
                                  setNewInvLines(ls => ls.map((l, i) => i !== idx ? l : { ...l, product_id: pid, description: prod ? prod.name : l.description, unit_price: prod ? prod.unit_price : l.unit_price }));
                                }}
                                className="w-full px-2 py-1 rounded border text-xs outline-none"
                                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                                <option value="">— custom —</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5 min-w-[140px]">
                              <input value={line.description} onChange={e => setNewInvLines(ls => ls.map((l, i) => i !== idx ? l : { ...l, description: e.target.value }))}
                                className="w-full px-2 py-1 rounded border text-xs outline-none" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} placeholder="Description" />
                            </td>
                            <td className="px-2 py-1.5 w-16">
                              <input type="number" min={0} step="any" value={line.quantity} onChange={e => setNewInvLines(ls => ls.map((l, i) => i !== idx ? l : { ...l, quantity: Number(e.target.value) }))}
                                className="w-full px-2 py-1 rounded border text-xs outline-none text-right" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                            </td>
                            <td className="px-2 py-1.5 w-24">
                              <input type="number" min={0} step="any" value={line.unit_price} onChange={e => setNewInvLines(ls => ls.map((l, i) => i !== idx ? l : { ...l, unit_price: Number(e.target.value) }))}
                                className="w-full px-2 py-1 rounded border text-xs outline-none text-right" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                            </td>
                            <td className="px-2 py-1.5 font-mono text-right whitespace-nowrap" style={{ color: "var(--accent)" }}>
                              {currency} {fmt(line.quantity * line.unit_price)}
                            </td>
                            <td className="px-2 py-1.5">
                              <button type="button" onClick={() => setNewInvLines(ls => ls.filter((_, i) => i !== idx))}
                                className="px-1.5 py-0.5 rounded text-xs" style={{ color: "var(--red-c)", background: "rgba(239,68,68,.1)" }}>✕</button>
                            </td>
                          </tr>
                        ))}
                        {newInvLines.length === 0 && (
                          <tr><td colSpan={6} className="px-3 py-4 text-center" style={{ color: "var(--muted2)" }}>No lines — click + Add Row</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {newInvLines.length > 0 && (
                    <div className="flex justify-end mt-2 text-sm font-bold font-mono" style={{ color: "var(--accent)" }}>
                      Total: {currency} {fmt(lineTotal)}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setNewInvModal(false)}
                    className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                  <button type="submit" disabled={busy}
                    className="flex-1 py-2 text-sm font-semibold rounded"
                    style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                    {busy ? "Saving…" : "Create Invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Subscription Modal */}
      {subModal && (() => {
        const previewCount = getPreviewCount(subStart, subEnd, subFreq);
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
            style={{ background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)" }}
            onClick={e => { if (e.target === e.currentTarget) setSubModal(false); }}>
            <div className="w-full max-w-lg rounded-xl mb-10" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <h3 className="font-semibold">New Subscription</h3>
                <button onClick={() => setSubModal(false)} style={{ color: "var(--muted2)" }}>✕</button>
              </div>
              <form className="p-5 space-y-4"
                action={async (fd: FormData) => {
                  setBusy(true);
                  try {
                    await createSubscription({
                      customer_id: customerId,
                      product_id: subProduct,
                      description: String(fd.get("description") || ""),
                      amount: subAmount,
                      frequency: subFreq,
                      start_date: subStart,
                      end_date: subEnd || null,
                      payment_type_id: fd.get("payment_type_id") ? Number(fd.get("payment_type_id")) : null,
                      invoice_prefix: String(fd.get("invoice_prefix") || "SUB"),
                    });
                    toast.success(`Subscription created — ${previewCount} invoice${previewCount !== 1 ? "s" : ""} generated`);
                    setSubModal(false);
                  } catch { toast.error("Failed to create subscription"); }
                  finally { setBusy(false); }
                }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Description *</label>
                    <input name="description" required className={inp} style={inpS} placeholder="e.g. Monthly retainer, SaaS licence" />
                  </div>
                  {products.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Product (optional)</label>
                      <select value={subProduct ?? ""} onChange={e => {
                        const pid = e.target.value ? Number(e.target.value) : null;
                        setSubProduct(pid);
                        const p = products.find(p => p.id === pid);
                        if (p) setSubAmount(p.unit_price);
                      }} className={inp} style={inpS}>
                        <option value="">— No product —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Amount per period *</label>
                    <input type="number" min={0} step="0.01" value={subAmount} onChange={e => setSubAmount(Number(e.target.value))}
                      className={inp} style={inpS} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Frequency *</label>
                    <select value={subFreq} onChange={e => setSubFreq(e.target.value)} className={inp} style={inpS}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Start Date *</label>
                    <DateInput name="start_date" value={subStart} onChange={setSubStart} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>End Date <span style={{ color: "var(--muted2)", fontWeight: 400 }}>(optional)</span></label>
                    <DateInput name="end_date" value={subEnd} onChange={setSubEnd} placeholder="Leave blank for 12 periods" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Payment Type</label>
                    <select name="payment_type_id" className={inp} style={inpS}>
                      <option value="">— None —</option>
                      {paymentTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Invoice # Prefix</label>
                    <input name="invoice_prefix" defaultValue="SUB" className={inp} style={inpS} placeholder="SUB" />
                  </div>
                </div>

                {/* Preview */}
                {subStart && (
                  <div className="px-4 py-3 rounded-lg text-xs" style={{ background: previewCount > 0 ? "var(--success-bg)" : "var(--warning-bg)", color: previewCount > 0 ? "var(--accent)" : "var(--amber-c)" }}>
                    {previewCount > 0
                      ? `✓ Will generate ${previewCount} invoice${previewCount !== 1 ? "s" : ""} (${FREQ_LABELS[subFreq]}, ${currency} ${fmt(subAmount)} each = ${currency} ${fmt(previewCount * subAmount)} total)`
                      : "⚠ No invoices will be generated — check your dates"}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setSubModal(false)} className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                  <button type="submit" disabled={busy || previewCount === 0}
                    className="flex-1 py-2 text-sm font-semibold rounded disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "#fff" }}>
                    {busy ? "Creating…" : `Create & Generate ${previewCount} Invoice${previewCount !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      <ConfirmDialog {...dialogProps} confirmLabel="Delete" />
    </div>
  );
}
