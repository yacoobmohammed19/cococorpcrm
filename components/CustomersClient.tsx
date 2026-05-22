"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Phone, Mail, User, ChevronRight, Users, BarChart2 } from "lucide-react";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { runAction } from "@/lib/action-utils";
import { createCustomer, updateCustomer, deleteCustomer, bulkDeleteCustomers } from "@/server-actions/customers";

type Customer = {
  id: number; name: string; email: string | null; phone: string | null;
  contact_person: string | null; source: string | null; notes: string | null;
  status: string; payment_method: string | null; reg_no: string | null; vat_no: string | null;
  created_at: string | null;
};

const SOURCES = ["Referral", "Website", "Cold Call", "Social Media", "Event", "Other"];
const STATUSES = ["Active", "Inactive", "Churned", "Prospect"];
const PAYMENT_METHODS = ["EFT", "Payfast", "Credit Card", "Debit Order", "Cash", "Other"];

const STATUS_COLORS: Record<string, string> = {
  Active: "var(--accent)", Prospect: "var(--cyan-c)", Inactive: "var(--amber-c)", Churned: "var(--red-c)",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "var(--muted2)";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
      {status}
    </span>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  Referral:     "var(--accent)",
  Website:      "var(--cyan-c)",
  "Cold Call":  "var(--amber-c)",
  "Social Media":"var(--purple-c)",
  Event:        "var(--pink)",
  Other:        "var(--muted2)",
};

function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const color = SOURCE_COLORS[source] ?? "var(--muted2)";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
      {source}
    </span>
  );
}

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [modal, setModal] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function togStr(arr: string[], v: string) { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
  function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown) => { const s = v == null ? "" : String(v); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: filename });
    a.click(); URL.revokeObjectURL(a.href);
  }

  const filtered = customers.filter(c => {
    if (statusFilter.length > 0 && !statusFilter.includes(c.status || "Active")) return false;
    if (sourceFilter.length > 0 && !sourceFilter.includes(c.source || "")) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.name + (c.email ?? "") + (c.phone ?? "") + (c.contact_person ?? "")).toLowerCase().includes(q);
    }
    return true;
  });

  const activeFilters = statusFilter.length + sourceFilter.length + (search ? 1 : 0);

  function open(c: Customer | null) { setModal({ open: true, customer: c }); }
  function close() { setModal({ open: false, customer: null }); }

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    setBusy(true);
    await runAction(() => deleteCustomer(confirmDelete.id), toast, "Customer archived");
    setConfirmDelete(null);
    setBusy(false);
  }

  function toggleSelect(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));
  }
  async function handleBulkDelete() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    await runAction(() => bulkDeleteCustomers(Array.from(selected)), toast, `${selected.size} customer${selected.size > 1 ? "s" : ""} archived`);
    setSelected(new Set());
    setBulkBusy(false);
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
            {customers.length} {customers.length === 1 ? "customer" : "customers"} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/customers/kpi"
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            <BarChart2 size={14} /> KPIs
          </Link>
          {selected.size > 0 && (
            <button onClick={handleBulkDelete} disabled={bulkBusy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg"
              style={{ background: "var(--danger-bg)", color: "var(--red-c)", border: "1px solid var(--red-c)", opacity: bulkBusy ? .6 : 1 }}>
              <Trash2 size={14} />
              {bulkBusy ? "Archiving…" : `Archive (${selected.size})`}
            </button>
          )}
          <button
            onClick={() => downloadCsv(`customers-${new Date().toISOString().slice(0,10)}.csv`, filtered.map(c => ({ Name: c.name, Status: c.status || "Active", Email: c.email || "", Phone: c.phone || "", "Contact Person": c.contact_person || "", Source: c.source || "", "Reg No": c.reg_no || "", "VAT No": c.vat_no || "", "Created": c.created_at || "" })))}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", background: "var(--card2)" }}>
            ↓ CSV
          </button>
          <button
            onClick={() => open(null)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90 active:scale-[.98]"
            style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
          >
            <Plus size={15} />
            New Customer
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total", value: customers.length, color: "var(--accent)" },
          { label: "Showing", value: filtered.length, color: "var(--cyan-c)" },
          { label: "Filters", value: activeFilters, color: activeFilters > 0 ? "var(--amber-c)" : "var(--muted2)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted2)" }}>{label}</p>
            <p className="text-2xl font-bold font-mono" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Search + filter bar ── */}
      <div className="mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, phone…"
          className="w-full px-4 py-2.5 text-sm rounded-lg border outline-none transition-colors mb-2"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <div className="flex flex-wrap gap-2 items-center">
          <MultiSelect
            label="Status"
            options={STATUSES.map(s => ({ label: s, value: s, color: STATUS_COLORS[s] }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <MultiSelect
            label="Source"
            options={SOURCES.map(s => ({ label: s, value: s, color: SOURCE_COLORS[s] }))}
            value={sourceFilter}
            onChange={setSourceFilter}
          />
          {(statusFilter.length > 0 || sourceFilter.length > 0) && (
            <button onClick={() => { setStatusFilter([]); setSourceFilter([]); }}
              className="text-xs px-2 py-1.5 rounded" style={{ color: "var(--muted2)" }}>✕ Clear</button>
          )}
        </div>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="sm:hidden space-y-3">
        {filtered.map(c => (
          <div key={c.id} className="rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <Link href={`/customers/${c.id}`} className="font-semibold text-base leading-tight hover:underline" style={{ color: "var(--accent)" }}>
                  {c.name}
                </Link>
                <SourceBadge source={c.source} />
              </div>
              <div className="space-y-1.5">
                {c.phone && (
                  <p className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
                    <Phone size={13} className="shrink-0" style={{ color: "var(--muted2)" }} />
                    {c.phone}
                  </p>
                )}
                {c.email && (
                  <p className="flex items-center gap-2 text-sm truncate" style={{ color: "var(--muted)" }}>
                    <Mail size={13} className="shrink-0" style={{ color: "var(--muted2)" }} />
                    {c.email}
                  </p>
                )}
                {c.contact_person && (
                  <p className="flex items-center gap-2 text-sm" style={{ color: "var(--muted2)" }}>
                    <User size={13} className="shrink-0" style={{ color: "var(--muted2)" }} />
                    {c.contact_person}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={() => open(c)}
                className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}
              >
                <Pencil size={12} /> Edit
              </button>
              <Link
                href={`/customers/${c.id}`}
                className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-xs font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                View <ChevronRight size={12} />
              </Link>
              <button
                onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                disabled={busy}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: "var(--danger-bg)", color: "var(--red-c)" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <EmptyState
            icon="👥"
            title={search ? "No customers match" : "No customers yet"}
            description={search ? "Try a different search term." : "Add your first customer to get started."}
            action={!search ? (
              <button onClick={() => open(null)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg"
                style={{ background: "var(--primary)", color: "var(--primary-fg)" }}>
                <Plus size={15} /> New Customer
              </button>
            ) : undefined}
          />
        )}
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden sm:block rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--border)" }}>
              <th className="px-3 py-3 w-8">
                <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll} className="cursor-pointer" />
              </th>
              {["Customer", "Status", "Contact", "Phone", "Source", "Added", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap"
                  style={{ color: "var(--muted2)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ background: "var(--card)" }}>
            {filtered.map((c, i) => (
              <tr
                key={c.id}
                className="transition-colors hover:bg-[var(--card2)]"
                style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", background: selected.has(c.id) ? "color-mix(in srgb, var(--accent) 6%, var(--card))" : undefined }}
              >
                <td className="px-3 py-3 w-8">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="cursor-pointer" />
                </td>
                <td className="px-4 py-3">
                  <div>
                    <Link href={`/customers/${c.id}`} className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
                      {c.name}
                    </Link>
                    {c.email && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted2)" }}>{c.email}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={c.status || "Active"} /></td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
                  {c.contact_person || "—"}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: "var(--muted)" }}>
                  {c.phone || "—"}
                </td>
                <td className="px-4 py-3">
                  <SourceBadge source={c.source} />
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--muted2)" }}>
                  {fdate(c.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => open(c)}
                      title="Edit"
                      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--card3)]"
                      style={{ color: "var(--muted2)", border: "1px solid var(--border)" }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                      disabled={busy}
                      title="Archive"
                      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                      style={{ color: "var(--red-c)", background: "var(--danger-bg)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                    <Link
                      href={`/customers/${c.id}`}
                      title="View details"
                      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--card3)]"
                      style={{ color: "var(--muted2)", border: "1px solid var(--border)" }}
                    >
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon="👥"
                    title={search ? "No customers match" : "No customers yet"}
                    description={search ? "Try a different search term." : "Add your first customer to get started."}
                    action={!search ? (
                      <button onClick={() => open(null)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg"
                        style={{ background: "var(--primary)", color: "var(--primary-fg)" }}>
                        <Plus size={15} /> New Customer
                      </button>
                    ) : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal ── */}
      {modal.open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)" }}
          onClick={e => { if (e.target === e.currentTarget) close(); }}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto"
            style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xl)" }}
          >
            <div className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 mb-2" style={{ background: "var(--border2)" }} />

            {/* Modal header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--success-bg)", color: "var(--accent)" }}>
                <Users size={16} />
              </div>
              <h3 className="font-semibold">{modal.customer ? `Edit — ${modal.customer.name}` : "New Customer"}</h3>
              <button
                onClick={close}
                className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--card2)]"
                style={{ color: "var(--muted2)" }}
              >
                ✕
              </button>
            </div>

            <form
              className="p-5 space-y-4"
              action={async (fd: FormData) => {
                setBusy(true);
                const ok = modal.customer
                  ? await runAction(() => updateCustomer(modal.customer!.id, fd), toast, "Customer updated")
                  : await runAction(() => createCustomer(fd), toast, "Customer created");
                if (ok) close();
                setBusy(false);
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>Name *</label>
                  <input
                    name="name" required defaultValue={modal.customer?.name ?? ""}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>Email</label>
                  <input
                    name="email" type="email" defaultValue={modal.customer?.email ?? ""}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>Phone</label>
                  <input
                    name="phone" defaultValue={modal.customer?.phone ?? ""}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>Contact Person</label>
                  <input
                    name="contact_person" defaultValue={modal.customer?.contact_person ?? ""}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>Source</label>
                  <select
                    name="source" defaultValue={modal.customer?.source ?? ""}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <option value="">— None —</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>Status</label>
                  <select
                    name="status" defaultValue={modal.customer?.status ?? "Active"}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>Payment Method</label>
                  <select
                    name="payment_method" defaultValue={modal.customer?.payment_method ?? ""}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <option value="">— None —</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>Reg Number</label>
                  <input
                    name="reg_no" defaultValue={modal.customer?.reg_no ?? ""}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>VAT Number</label>
                  <input
                    name="vat_no" defaultValue={modal.customer?.vat_no ?? ""}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted2)" }}>Notes</label>
                  <textarea
                    name="notes" rows={3} defaultValue={modal.customer?.notes ?? ""}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors resize-none"
                    style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={close}
                  className="flex-1 py-2.5 text-sm rounded-lg border font-medium transition-colors hover:bg-[var(--card2)]"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={busy}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all"
                  style={{ background: "var(--accent)", color: "#fff", opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? "Saving…" : modal.customer ? "Save Changes" : "Create Customer"}
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
