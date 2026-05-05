"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { runAction } from "@/lib/action-utils";
import { createCustomer, updateCustomer, deleteCustomer } from "@/server-actions/customers";

type Customer = {
  id: number; name: string; email: string | null; phone: string | null;
  contact_person: string | null; source: string | null; notes: string | null;
  created_at: string | null;
};

const SOURCES = ["Referral", "Website", "Cold Call", "Social Media", "Event", "Other"];

const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.name + (c.email || "") + (c.phone || "") + (c.contact_person || "")).toLowerCase().includes(q);
  });

  function open(c: Customer | null) { setModal({ open: true, customer: c }); }
  function close() { setModal({ open: false, customer: null }); }

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    setBusy(true);
    await runAction(() => deleteCustomer(confirmDelete.id), toast, "Customer archived");
    setConfirmDelete(null);
    setBusy(false);
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          ["Total Customers", customers.length, "var(--accent)"],
          ["Active", customers.length, "var(--purple-c)"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl p-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
            <div className="text-2xl font-bold font-mono" style={{ color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…"
          className="px-3 py-2 text-sm rounded-xl border outline-none flex-1 min-w-0"
          style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        <span className="text-xs" style={{ color: "var(--muted2)" }}>{filtered.length}/{customers.length}</span>
        <button onClick={() => open(null)}
          className="px-4 py-2 text-sm font-semibold rounded-xl"
          style={{ background: "var(--accent)", color: "#fff" }}>
          + New
        </button>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {filtered.map(c => (
          <div key={c.id} className="rounded-2xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between mb-2">
              <Link href={`/customers/${c.id}`} className="font-bold text-base leading-tight" style={{ color: "var(--accent)" }}>{c.name}</Link>
              {c.source && <span className="ml-2 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "rgba(16,185,129,.12)", color: "var(--accent)" }}>{c.source}</span>}
            </div>
            <div className="space-y-0.5 mb-3">
              {c.phone && <p className="text-sm" style={{ color: "var(--muted)" }}>📞 {c.phone}</p>}
              {c.email && <p className="text-sm truncate" style={{ color: "var(--muted)" }}>✉️ {c.email}</p>}
              {c.contact_person && <p className="text-sm" style={{ color: "var(--muted2)" }}>👤 {c.contact_person}</p>}
              {!c.phone && !c.email && !c.contact_person && <p className="text-xs italic" style={{ color: "var(--muted2)" }}>No contact details</p>}
            </div>
            <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => open(c)} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                ✏️ Edit
              </button>
              <Link href={`/customers/${c.id}`} className="flex-1 py-2 rounded-xl text-xs font-semibold text-center" style={{ background: "var(--accent)", color: "#fff" }}>
                View →
              </Link>
              <button onClick={() => setConfirmDelete({ id: c.id, name: c.name })} disabled={busy} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>
                🗑️
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <EmptyState icon="👥"
            title={search ? "No customers match your search" : "No customers yet"}
            description={search ? "Try a different search term." : "Add your first customer to get started."}
            action={!search ? <button onClick={() => open(null)} className="px-4 py-2 text-sm font-semibold rounded-xl" style={{ background: "var(--accent)", color: "#fff" }}>+ New Customer</button> : undefined}
          />
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                {["Name", "Email", "Phone", "Contact Person", "Source", "Added", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b hover:bg-[var(--card3)] transition-colors" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2.5 font-semibold">
                    <Link href={`/customers/${c.id}`} style={{ color: "var(--accent)" }}>{c.name}</Link>
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--muted)" }}>{c.email || "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>{c.phone || "—"}</td>
                  <td className="px-3 py-2.5" style={{ color: "var(--muted)" }}>{c.contact_person || "—"}</td>
                  <td className="px-3 py-2.5">
                    {c.source && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: "rgba(16,185,129,.12)", color: "var(--accent)" }}>
                        {c.source}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(c.created_at)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button onClick={() => open(c)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ border: "1px solid var(--border)", background: "var(--card)" }}>✏️</button>
                      <button onClick={() => setConfirmDelete({ id: c.id, name: c.name })} disabled={busy}
                        className="px-2 py-1 rounded text-xs"
                        style={{ border: "1px solid var(--border)", background: "var(--card)" }}>🗑️</button>
                      <Link href={`/customers/${c.id}`}
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--muted)" }}>→</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <EmptyState icon="👥"
                    title={search ? "No customers match" : "No customers yet"}
                    description={search ? "Try a different search term." : "Add your first customer to get started."}
                    action={!search ? <button onClick={() => open(null)} className="px-4 py-2 text-sm font-semibold rounded-xl" style={{ background: "var(--accent)", color: "#fff" }}>+ New Customer</button> : undefined}
                  />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — bottom sheet on mobile, centered on desktop */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center sm:p-4 sm:pt-16 overflow-y-auto"
          style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) close(); }}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: "var(--border)" }} />
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">{modal.customer ? `Edit — ${modal.customer.name}` : "New Customer"}</h3>
              <button onClick={close} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                setBusy(true);
                const ok = modal.customer
                  ? await runAction(() => updateCustomer(modal.customer!.id, fd), toast, "Customer updated")
                  : await runAction(() => createCustomer(fd), toast, "Customer created");
                if (ok) close();
                setBusy(false);
              }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Name *</label>
                  <input name="name" required defaultValue={modal.customer?.name || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Email</label>
                  <input name="email" type="email" defaultValue={modal.customer?.email || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Phone</label>
                  <input name="phone" defaultValue={modal.customer?.phone || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Contact Person</label>
                  <input name="contact_person" defaultValue={modal.customer?.contact_person || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Source</label>
                  <select name="source" defaultValue={modal.customer?.source || ""} className={inp} style={inpS}>
                    <option value="">— None —</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                  <textarea name="notes" rows={3} defaultValue={modal.customer?.notes || ""}
                    className={inp + " resize-none"} style={inpS} />
                </div>
              </div>
              <div className="flex gap-3 pt-2 pb-2">
                <button type="button" onClick={close} className="flex-1 py-2.5 text-sm rounded-xl border"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2.5 text-sm font-semibold rounded-xl"
                  style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : modal.customer ? "Update" : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Archive "${confirmDelete?.name}"?`}
        message="This customer will be archived and hidden from the list. You can restore it later."
        confirmLabel="Archive"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
