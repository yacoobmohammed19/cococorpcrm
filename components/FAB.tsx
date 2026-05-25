"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/ui/DateInput";
import { useToast } from "@/components/Toast";
import { createLead } from "@/server-actions/leads";
import { createInvoice } from "@/server-actions/invoices";
import { createCost, recordCashflow } from "@/server-actions/costs";
import { COST_TYPES, type CostTypeValue } from "@/lib/schemas/costs";

type Account = { id: number; name: string };
type Customer = { id: number; name: string };
type PaymentType = { id: number; name: string };
type Status = { id: number; name: string };
type CostCategory = { id: number; name: string };

type Props = {
  accounts: Account[];
  customers: Customer[];
  paymentTypes: PaymentType[];
  statuses: Status[];
  costCategories: CostCategory[];
};

type ModalType = "lead" | "invoice" | "cost" | "cashflow" | null;

const MODAL_LABELS: Record<NonNullable<ModalType>, string> = {
  lead: "Lead", invoice: "Invoice", cost: "Cost", cashflow: "Balance snapshot",
};

export function FAB({ accounts, customers, paymentTypes, statuses, costCategories }: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [fabDate, setFabDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [fabCostType, setFabCostType] = useState<CostTypeValue>("operational");
  const router = useRouter();
  const toast = useToast();

  function openModal(type: ModalType) { setFabDate(new Date().toISOString().slice(0, 10)); setFabCostType("operational"); setModal(type); setOpen(false); }
  function closeModal() { setModal(null); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<void>) {
    e.preventDefault();
    setBusy(true);
    try {
      await action(new FormData(e.currentTarget));
      toast.success(`${MODAL_LABELS[modal!]} saved`);
      closeModal();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg.includes("23503") || msg.includes("foreign key") ? "Cannot save — linked data missing." : "Failed to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputCss = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
  const inputStyle = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };
  const labelCss: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--muted2)", marginBottom: 4 };

  const Modal = ({ title, children, onSubmit }: { title: string; children: React.ReactNode; onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void> }) => (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-xl shadow-2xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={closeModal} style={{ color: "var(--muted2)", background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="p-5 space-y-3">{children}</div>
          <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded text-sm"
              style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* FAB button */}
      <div className="fixed bottom-20 right-4 z-[150] md:bottom-6">
        {/* Expanded menu */}
        {open && (
          <div className="absolute bottom-14 right-0 flex flex-col gap-2 items-end">
            {[
              { label: "📋 New Lead", type: "lead" as ModalType },
              { label: "🧾 New Invoice", type: "invoice" as ModalType },
              { label: "💸 New Cost", type: "cost" as ModalType },
              { label: "🏦 Record Balance", type: "cashflow" as ModalType },
            ].map(opt => (
              <button key={opt.type} onClick={() => openModal(opt.type)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg whitespace-nowrap transition-all"
                style={{ background: "var(--card2)", color: "var(--foreground)", border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,.4)" }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setOpen(!open)}
          className="w-14 h-14 rounded-full shadow-xl text-2xl font-bold flex items-center justify-center transition-transform active:scale-90"
          style={{ background: "var(--pink)", color: "#fff", boxShadow: "0 4px 20px rgba(232,67,147,.5)", transform: open ? "rotate(45deg)" : "rotate(0)" }}>
          +
        </button>
      </div>

      {/* Backdrop to close menu */}
      {open && <div className="fixed inset-0 z-[140]" onClick={() => setOpen(false)} />}

      {/* Lead Modal */}
      {modal === "lead" && (
        <Modal title="📋 New Lead" onSubmit={e => handleSubmit(e, createLead)}>
          <div>
            <label style={labelCss}>Lead Name *</label>
            <input name="name" required className={inputCss} style={inputStyle} placeholder="Contact or company name" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelCss}>Phone</label>
              <input name="phone" className={inputCss} style={inputStyle} placeholder="+27 xx xxx xxxx" />
            </div>
            <div>
              <label style={labelCss}>Contact Person</label>
              <input name="contact" className={inputCss} style={inputStyle} placeholder="Contact name" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelCss}>Status</label>
              <select name="status_id" defaultValue="1" className={inputCss} style={inputStyle}>
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelCss}>Date</label>
              <DateInput name="lead_date" value={fabDate} onChange={setFabDate} placeholder="Lead date" />
            </div>
          </div>
          <div>
            <label style={labelCss}>Opportunity Value ({"{cur}"})</label>
            <input name="opportunity_value" type="number" min="0" step="0.01" defaultValue="0" className={inputCss} style={inputStyle} />
          </div>
          <input type="hidden" name="weight" value="0.5" />
        </Modal>
      )}

      {/* Invoice Modal */}
      {modal === "invoice" && (
        <Modal title="🧾 New Invoice" onSubmit={e => handleSubmit(e, async fd => {
          fd.set("lines", JSON.stringify([{ description: fd.get("description") || "Service", quantity: 1, unit_price: Number(fd.get("amount") || 0) }]));
          await createInvoice(fd);
        })}>
          <div>
            <label style={labelCss}>Customer *</label>
            <select name="customer_id" required className={inputCss} style={inputStyle}>
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelCss}>Invoice # *</label>
              <input name="invoice_number" required className={inputCss} style={inputStyle} placeholder="INV-001" />
            </div>
            <div>
              <label style={labelCss}>Date *</label>
              <DateInput name="transaction_date" value={fabDate} onChange={setFabDate} placeholder="Date" />
            </div>
            <div>
              <label style={labelCss}>Amount *</label>
              <input name="amount" type="number" required min="0" step="0.01" defaultValue="0" className={inputCss} style={inputStyle} />
            </div>
            <div>
              <label style={labelCss}>Status</label>
              <select name="status" defaultValue="Pending" className={inputCss} style={inputStyle}>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelCss}>Description</label>
            <input name="description" className={inputCss} style={inputStyle} placeholder="Service description…" />
          </div>
          <div>
            <label style={labelCss}>Payment Type</label>
            <select name="payment_type_id" className={inputCss} style={inputStyle}>
              <option value="">— Select —</option>
              {paymentTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </Modal>
      )}

      {/* Cost Modal */}
      {modal === "cost" && (
        <Modal title="💸 New Cost" onSubmit={e => handleSubmit(e, createCost)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelCss}>Date *</label>
              <DateInput name="transaction_date" value={fabDate} onChange={setFabDate} placeholder="Date" />
            </div>
            <div>
              <label style={labelCss}>Amount *</label>
              <input name="amount" type="number" required min="0" step="0.01" defaultValue="0" className={inputCss} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelCss}>Description</label>
            <input name="cost_details" className={inputCss} style={inputStyle} placeholder="What was this cost for?" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelCss}>Category</label>
              <select name="cost_category_id" className={inputCss} style={inputStyle}>
                <option value="">— Select —</option>
                {costCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelCss}>Account</label>
              <select name="account_id" className={inputCss} style={inputStyle}>
                <option value="">— Select —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelCss}>Cost Type</label>
            <input type="hidden" name="include_in_pnl" value={fabCostType === "operational" ? "true" : "false"} />
            <select
              name="cost_type"
              value={fabCostType}
              onChange={e => setFabCostType(e.target.value as CostTypeValue)}
              className={inputCss} style={inputStyle}>
              {COST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {fabCostType !== "operational" && (
              <p className="text-xs mt-1" style={{ color: "#f59e0b" }}>
                This cost will be excluded from operational P&L.
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Cashflow Modal */}
      {modal === "cashflow" && (
        <Modal title="🏦 Record Bank Balance" onSubmit={e => handleSubmit(e, recordCashflow)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelCss}>Date *</label>
              <DateInput name="record_date" value={fabDate} onChange={setFabDate} placeholder="Date" />
            </div>
            <div>
              <label style={labelCss}>Account *</label>
              <select name="account_id" required className={inputCss} style={inputStyle}>
                <option value="">— Select —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelCss}>Actual Balance *</label>
            <input name="balance" type="number" required step="0.01" defaultValue="0" className={inputCss} style={inputStyle} placeholder="Current amount in bank" />
          </div>
          <div>
            <label style={labelCss}>Notes</label>
            <input name="notes" className={inputCss} style={inputStyle} placeholder="e.g. Month-end balance" />
          </div>
        </Modal>
      )}
    </>
  );
}
