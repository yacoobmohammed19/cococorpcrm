"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { updateCustomer } from "@/server-actions/customers";
import { createContact, updateContact, deleteContact } from "@/server-actions/contacts";
import { createActivity, toggleActivity, deleteActivity } from "@/server-actions/activities";

type Invoice = { id: number; invoice_number: string | null; amount: number; status: string; transaction_date: string | null; due_date: string | null };
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

const TABS = ["Info", "Invoices", "Products", "Contacts", "Activities"] as const;
type Tab = typeof TABS[number];

export function CustomerDetailClient({ customer, invoices, contacts, activities, currency, customerId, productsPurchased = [] }: {
  customer: Customer; invoices: Invoice[]; contacts: Contact[];
  activities: Activity[]; currency: string; customerId: number;
  productsPurchased?: ProductPurchased[];
}) {
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [activityDueDate, setActivityDueDate] = useState("");
  const [tab, setTab] = useState<Tab>("Info");
  const [busy, setBusy] = useState(false);
  const [editInfo, setEditInfo] = useState(false);
  const [contactModal, setContactModal] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [activityModal, setActivityModal] = useState(false);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-semibold transition-colors"
            style={{ borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent", color: tab === t ? "var(--accent)" : "var(--muted2)" }}>
            {t}
            {t === "Products" && productsPurchased.length > 0 && <span className="ml-1 text-xs">({productsPurchased.length})</span>}
            {t === "Contacts" && contacts.length > 0 && <span className="ml-1 text-xs">({contacts.length})</span>}
            {t === "Activities" && activities.length > 0 && <span className="ml-1 text-xs">({activities.length})</span>}
          </button>
        ))}
      </div>

      {/* INFO TAB */}
      {tab === "Info" && (
        <div className="rounded-lg p-5 space-y-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
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
            <Link href="/invoices" className="text-xs px-3 py-1.5 rounded" style={{ background: "var(--accent)", color: "#fff" }}>+ New Invoice</Link>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto"><table className="w-full text-xs border-collapse" style={{ background: "var(--card2)" }}>
              <thead>
                <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                  {["Date", "Invoice #", "Amount", "Due", "Status"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const col = STATUS_COLORS[inv.status] || "var(--muted2)";
                  return (
                    <tr key={inv.id} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(inv.transaction_date)}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: "var(--accent)" }}>
                        <Link href={`/invoices/${inv.id}/print`} target="_blank">{inv.invoice_number || `#${inv.id}`}</Link>
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold">{currency} {fmt(inv.amount)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: inv.due_date && inv.status === "Pending" && new Date(inv.due_date) < new Date() ? "var(--red-c)" : "var(--muted2)" }}>{fdate(inv.due_date)}</td>
                      <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: col + "22", color: col }}>{inv.status}</span></td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: "var(--muted2)" }}>No invoices yet</td></tr>}
              </tbody>
            </table></div>
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
                    <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</td>
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
      <ConfirmDialog {...dialogProps} confirmLabel="Delete" />
    </div>
  );
}
