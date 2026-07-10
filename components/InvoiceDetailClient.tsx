"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, ExternalLink } from "lucide-react";
import { useToast } from "@/components/Toast";
import { updateInvoiceStatus } from "@/server-actions/invoices";

type Line = { description: string; quantity: number; unit_price: number; line_total: number };

type InvoiceStatus = { id: number; name: string; color: string };

type Props = {
  invoice: {
    id: number; invoice_number: string | null; amount: number; status: string;
    transaction_date: string | null; due_date: string | null; description: string | null;
    customer_id: number; customer_name: string;
  };
  lines: Line[];
  currency: string;
  invoiceStatuses: InvoiceStatus[];
};

const FALLBACK_COLORS: Record<string, string> = {
  Completed: "#ec4899", Pending: "#f59e0b", "Written Off": "#ef4444", Hold: "#6366f1",
};

function fmt(n: number) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}

export function InvoiceDetailClient({ invoice, lines, currency, invoiceStatuses }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const toast = useToast();
  const [status, setStatus] = useState(invoice.status);
  const [busy, setBusy] = useState(false);
  const statusColorMap = Object.fromEntries(invoiceStatuses.map(s => [s.name, s.color]));
  const statusColor = statusColorMap[status] ?? FALLBACK_COLORS[status] ?? "#6b7280";
  const isOverdue = invoice.due_date && status === "Pending" && new Date(invoice.due_date) < new Date();

  const subtotal = lines.length > 0
    ? lines.reduce((s, l) => s + Number(l.line_total), 0)
    : invoice.amount;

  async function handleStatusChange(newStatus: string) {
    setBusy(true);
    try {
      await updateInvoiceStatus(invoice.id, newStatus);
      setStatus(newStatus);
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--muted2)" }}>Invoice</p>
          <h1 className="text-2xl font-bold tracking-tight">{invoice.invoice_number || `#${invoice.id}`}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/invoices/${invoice.id}/print`} target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
            <Printer size={14} /> Print
          </Link>
          <Link href="/invoices"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
            <ExternalLink size={14} /> All Invoices
          </Link>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 col-span-2 sm:col-span-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted2)" }}>Customer</p>
          <Link href={`/customers/${invoice.customer_id}`}
            className="font-semibold text-base hover:underline"
            style={{ color: "var(--accent)" }}>
            {invoice.customer_name}
          </Link>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted2)" }}>Date</p>
          <p className="font-semibold text-sm">{fdate(invoice.transaction_date)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted2)" }}>Due</p>
          <p className="font-semibold text-sm" style={{ color: isOverdue ? "var(--red-c)" : "var(--foreground)" }}>
            {fdate(invoice.due_date)}{isOverdue ? " ⚠" : ""}
          </p>
        </div>
      </div>

      {/* Amount + Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted2)" }}>Amount</p>
          <p className="text-3xl font-bold font-mono" style={{ color: "var(--accent)" }}>{cur} {fmt(invoice.amount)}</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted2)" }}>Status</p>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: statusColor + "22", color: statusColor }}>
              {status}
            </span>
            <select value={status} onChange={e => handleStatusChange(e.target.value)} disabled={busy}
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border outline-none"
              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              {invoiceStatuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          {busy && <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Saving…</p>}
        </div>
      </div>

      {/* Description */}
      {invoice.description && (
        <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted2)" }}>Description</p>
          <p className="text-sm">{invoice.description}</p>
        </div>
      )}

      {/* Line Items */}
      {lines.length > 0 ? (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted2)" }}>Line Items</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ background: "var(--card)" }}>
              <thead>
                <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--border)" }}>
                  {["Description", "Qty", "Unit Price", "Total"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3">{line.description}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--muted2)" }}>{Number(line.quantity).toFixed(0)}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--muted2)" }}>{cur} {fmt(Number(line.unit_price))}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{cur} {fmt(Number(line.line_total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 flex justify-end border-t" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>
              Total: {cur} {fmt(subtotal)}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 text-center text-sm" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted2)" }}>
          No line items — edit this invoice from the <Link href="/invoices" className="hover:underline" style={{ color: "var(--accent)" }}>invoices list</Link> to add them.
        </div>
      )}
    </div>
  );
}
