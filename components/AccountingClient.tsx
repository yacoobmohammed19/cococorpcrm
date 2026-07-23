"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { useConfirm } from "@/hooks/useConfirm";
import { useOptimisticList } from "@/hooks/useOptimisticList";
import {
  saveBankBalance,
  deleteBankBalance,
} from "@/server-actions/banking";
import { createIncome, deleteIncome } from "@/server-actions/income";
import { INCOME_TYPES, INCOME_TYPE_LABELS } from "@/lib/schemas/income";
import { AfsStatements } from "@/components/AfsStatements";
import type { SavedAfsRow } from "@/lib/afs/merge";
import type { AutoFigures } from "@/lib/afs/compute";

type Invoice = { id: number; amount: number; status: string; transaction_date: string; customer_id: number };
type Cost = { id: number; amount: number; transaction_date: string; cost_category_id: number | null; category_name: string; cost_type: string; include_in_pnl: boolean };
type Income = { id: number; amount: number; transaction_date: string; description: string | null; income_type: string; account_id: number | null };
type Cashflow = { id: number; balance: number; account_id: number | null; record_date: string; notes: string | null };
type BankTxn = {
  id: number; account_id: number | null; txn_date: string; description: string;
  reference: string | null; debit: number; credit: number; balance: number | null;
  reconciled: boolean; notes: string | null;
};
type Account = { id: number; name: string };

type Props = {
  invoices: Invoice[];
  costs: Cost[];
  income: Income[];
  cashflow: Cashflow[];
  accounts: Account[];
  afsLines: SavedAfsRow[];
  autoByYear: Record<number, AutoFigures>;
  finYears: number[];
  currentFinYear: number;
  fiscalYearStart: number;
  taxRate: number;
  orgName: string;
  orgRegNo: string;
  orgVatNo: string;
  orgAddress: string;
  currency: string;
  intangibleAssets?: number;
  defaultStart: string;
  defaultEnd: string;
};

function fmt(n: number) {
  return Number(Math.abs(n)).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtVal(n: number, cur: string) {
  return n < 0 ? `(${cur} ${fmt(n)})` : n === 0 ? "—" : `${cur} ${fmt(n)}`;
}
function fdate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}
function fdateShort(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}

// ── IS / BS helpers ──────────────────────────────────────────────────────────
function Row({ label, value, cur, indent = 0, bold = false, color, note }: { label: string; value: number; cur: string; indent?: number; bold?: boolean; color?: string; note?: string }) {
  const col = color || (bold ? "#fff" : value < 0 ? "var(--red-c)" : "var(--muted)");
  return (
    <div className="flex items-center py-2 border-b" style={{ paddingLeft: 32 + indent * 16, paddingRight: 32, borderColor: "#e5e5e5" }}>
      <span className="flex-1 text-sm" style={{ fontWeight: bold ? 700 : 400, color: bold ? "#1a1a2e" : "#333" }}>
        {label}{note && <span className="ml-2 text-xs" style={{ color: "#aaa" }}>{note}</span>}
      </span>
      <span className="font-mono text-sm" style={{ color: col, fontWeight: bold ? 700 : 400, minWidth: 120, textAlign: "right" }}>
        {fmtVal(value, cur)}
      </span>
      <span style={{ minWidth: 80 }}>&nbsp;</span>
    </div>
  );
}
function SectionHdr({ label }: { label: string }) {
  return <div className="px-8 py-2 text-xs font-bold uppercase tracking-wider" style={{ background: "#f8f9fa", color: "#555", borderBottom: "1px solid #e5e5e5" }}>{label}</div>;
}
function Subtotal({ label, value, cur }: { label: string; value: number; cur: string }) {
  return (
    <div className="flex items-center py-2.5" style={{ paddingLeft: 32, paddingRight: 32, background: "#f0fdf4", borderBottom: "2px solid #ec4899" }}>
      <span className="flex-1 text-sm font-bold" style={{ color: "#1a1a2e" }}>{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: "#ec4899", minWidth: 120, textAlign: "right" }}>{fmtVal(value, cur)}</span>
      <span style={{ minWidth: 80 }}>&nbsp;</span>
    </div>
  );
}
function Total({ label, value, cur }: { label: string; value: number; cur: string }) {
  return (
    <div className="flex items-center py-3" style={{ paddingLeft: 32, paddingRight: 32, background: "#1a1a2e" }}>
      <span className="flex-1 text-sm font-bold" style={{ color: "#fff" }}>{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: "#ec4899", minWidth: 120, textAlign: "right" }}>{fmtVal(value, cur)}</span>
      <span style={{ minWidth: 80 }}>&nbsp;</span>
    </div>
  );
}

// ── Month range helpers ───────────────────────────────────────────────────────
function buildMonthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let [cy, cm] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  while ((cy < ty || (cy === ty && cm <= tm)) && months.length < 120) {
    months.push(`${cy}-${String(cm).padStart(2, "0")}`);
    if (++cm > 12) { cm = 1; cy++; }
  }
  return months;
}
function mLabel(mk: string) {
  const [y, mo] = mk.split("-");
  return ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+mo] + " '" + y.slice(2);
}
function monthEnd(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  // Use the day number only — never toISOString(), which shifts to UTC and can
  // roll the last day of the month back by one in +HH timezones (e.g. SAST).
  const lastDay = new Date(y, m, 0).getDate();
  return `${mk}-${String(lastDay).padStart(2, "0")}`;
}

// ── ZAR formatter: R12 500.00 ─────────────────────────────────────────────────
function fmtZAR(n: number): string {
  const abs = Math.abs(n);
  const [int, dec] = abs.toFixed(2).split(".");
  const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `R ${intFormatted}.${dec}`;
}

const COST_TYPE_LABELS: Record<string, string> = {
  operational: "Operational", sadaqah: "Sadaqah", zakat: "Zakat",
  owner_draw: "Owner's Draw", capex: "CapEx", personal: "Personal",
};

// ── Shared input styles ──────────────────────────────────────────────────────
const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

// ── Main component ───────────────────────────────────────────────────────────
export function AccountingClient({ invoices, costs, income: initialIncome, cashflow: initialCashflow, accounts, afsLines, autoByYear, finYears, currentFinYear, fiscalYearStart, taxRate, orgName, orgRegNo, orgVatNo, orgAddress, currency, intangibleAssets = 0, defaultStart, defaultEnd }: Props) {
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const router = useRouter();
  // Optimistic mirror of bank-balance snapshots so deletes reflect instantly.
  const { items: cashflow, remove: removeBalance } = useOptimisticList(initialCashflow, toast);
  // Optimistic mirror of other-income entries so deletes reflect instantly.
  const { items: income, remove: removeIncome } = useOptimisticList(initialIncome, toast);
  const [tab, setTab] = useState<"is" | "bs" | "coe" | "cf" | "notes" | "bank" | "income">("is");
  // AFS financial-year selector (shared across statement tabs)
  const [afsFinYear, setAfsFinYear] = useState(currentFinYear);
  // Other-income entry form
  const [incomeBusy, setIncomeBusy] = useState(false);
  const [incomeDate, setIncomeDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Bank recon state
  const [addBusy, setAddBusy] = useState(false);
  const [balRecordDate, setBalRecordDate] = useState(() => new Date().toISOString().slice(0, 10));


  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleDeleteBalance(id: number) {
    if (!await confirm("Delete this snapshot?", "This bank balance record will be permanently removed.")) return;
    const ok = await removeBalance(id, () => deleteBankBalance(id), { success: "Snapshot deleted" });
    if (ok) router.refresh();
  }

  async function handleDeleteIncome(id: number) {
    if (!await confirm("Delete this income entry?", "The entry and its auto-created bank credit will be removed.")) return;
    const ok = await removeIncome(id, () => deleteIncome(id), { success: "Income entry deleted" });
    if (ok) router.refresh();
  }

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)}
      className="px-3 py-2 text-xs font-semibold rounded transition-colors"
      style={{ background: tab === t ? "var(--accent)" : "var(--card3)", color: tab === t ? "#fff" : "var(--muted)", border: "1px solid var(--border)" }}>
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-2 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>Financial statements & reconciliation</p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5 mb-4 print:hidden">
        {tabBtn("is", "Income Statement")}
        {tabBtn("bs", "Balance Sheet")}
        {tabBtn("coe", "Changes in Equity")}
        {tabBtn("cf", "Cash Flow")}
        {tabBtn("notes", "Notes")}
        {tabBtn("bank", "Bank Recon")}
        {tabBtn("income", "Other Income")}
      </div>

      {/* ── Income Statement ─────────────────────────────────────────────── */}

      {/* ── Balance Sheet ────────────────────────────────────────────────── */}
      {(tab === "is" || tab === "bs" || tab === "coe" || tab === "cf" || tab === "notes") && (
        <AfsStatements
          statement={tab === "is" ? "income_statement" : tab === "bs" ? "balance_sheet" : tab === "coe" ? "changes_in_equity" : tab === "cf" ? "cash_flow" : "notes"}
          afsLines={afsLines}
          autoByYear={autoByYear}
          finYear={afsFinYear}
          finYears={finYears}
          onFinYearChange={setAfsFinYear}
          fiscalYearStart={fiscalYearStart}
          taxRate={taxRate}
          currency={currency}
          canEdit={true}
          orgName={orgName}
          orgRegNo={orgRegNo}
          orgVatNo={orgVatNo}
          orgAddress={orgAddress}
          invoices={invoices}
          costs={costs}
          income={income}
        />
      )}

      {/* ── Bank Reconciliation ──────────────────────────────────────────── */}
      {tab === "bank" && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const sortedCf = [...cashflow].sort((a, b) => b.record_date.localeCompare(a.record_date));

        // Latest snapshot per account (sortedCf is desc so first hit per key = most recent)
        const latestByAcct: Record<string, Cashflow> = {};
        for (const entry of sortedCf) {
          const key = String(entry.account_id ?? "unassigned");
          if (!latestByAcct[key]) latestByAcct[key] = entry;
        }
        const acctEntries = Object.values(latestByAcct);
        const totalBankBal = acctEntries.length > 0 ? acctEntries.reduce((s, e) => s + e.balance, 0) : null;
        const latestSnapshotDate = acctEntries.length > 0 ? acctEntries.map(e => e.record_date).sort().reverse()[0] : null;
        const multiAccount = acctEntries.length > 1;

        return (
          <div>
            {/* Latest bank balance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>
                  Latest Bank Balance{multiAccount ? ` (${acctEntries.length} accounts)` : ""}
                </div>
                <div className="text-xl font-bold font-mono" style={{ color: "var(--accent)" }}>
                  {totalBankBal != null ? `${currency} ${fmt(totalBankBal)}` : "—"}
                </div>
                {latestSnapshotDate && <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>latest: {fdateShort(latestSnapshotDate)}</div>}
              </div>
            </div>

            {/* Per-account breakdown when multiple accounts */}
            {multiAccount && (
              <div className="flex flex-wrap gap-2 mb-5">
                {acctEntries.map(e => {
                  const acc = accounts.find(a => a.id === e.account_id);
                  return (
                    <div key={e.id} className="rounded-lg px-3 py-2 flex items-center gap-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--muted2)" }}>{acc?.name ?? "Unassigned"}</p>
                        <p className="text-sm font-bold font-mono" style={{ color: "var(--accent)" }}>{currency} {fmt(e.balance)}</p>
                      </div>
                      <p className="text-xs" style={{ color: "var(--muted2)" }}>{fdateShort(e.record_date)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Snapshot Form */}
            <form
              onSubmit={async e => {
                e.preventDefault();
                setAddBusy(true);
                try {
                  await saveBankBalance(new FormData(e.currentTarget));
                  toast.success("Balance snapshot saved");
                  (e.target as HTMLFormElement).reset();
                  setBalRecordDate(new Date().toISOString().slice(0, 10));
                } catch { toast.error("Failed to save snapshot"); }
                finally { setAddBusy(false); }
              }}
              className="rounded-lg p-4 mb-5"
              style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                  <DateInput name="record_date" value={balRecordDate} onChange={setBalRecordDate} placeholder="Select date" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Account</label>
                  <select name="account_id"
                    className="w-full px-3 py-2 rounded border text-sm outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--muted)" }}>
                    <option value="">— Optional —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Actual Bank Balance *</label>
                  <input name="balance" type="number" step="0.01" required placeholder="0.00"
                    className="w-full px-3 py-2 rounded border text-sm outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                  <input name="notes" placeholder="e.g. Month-end statement…"
                    className="w-full px-3 py-2 rounded border text-sm outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                </div>
              </div>
              <button type="submit" disabled={addBusy}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--accent)", color: "#fff", opacity: addBusy ? .6 : 1 }}>
                {addBusy ? "Saving…" : "+ Save Snapshot"}
              </button>
            </form>

            {/* Balance History */}
            {sortedCf.length === 0 ? (
              <div className="rounded-lg p-12 text-center" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold mb-1">No balance snapshots yet</p>
                <p className="text-xs" style={{ color: "var(--muted2)" }}>Log your bank balance above to keep a running record.</p>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {/* Mobile Cards */}
                <div className="sm:hidden divide-y" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
                  {sortedCf.map(entry => {
                    const acc = accounts.find(a => a.id === entry.account_id);
                    return (
                      <div key={entry.id} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm">{fdateShort(entry.record_date)}</div>
                          <div className="text-xs truncate" style={{ color: "var(--muted2)" }}>
                            {acc?.name ? `${acc.name}${entry.notes ? " · " : ""}` : ""}{entry.notes || ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold font-mono text-sm" style={{ color: "var(--accent)" }}>{currency} {fmt(entry.balance)}</span>
                          <button onClick={() => handleDeleteBalance(entry.id)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: "var(--danger-bg)", color: "var(--red-c)" }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                        {["Date", "Account", "Bank Balance", "Notes", ""].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCf.map(entry => {
                        const acc = accounts.find(a => a.id === entry.account_id);
                        return (
                          <tr key={entry.id} className="border-b hover:bg-[var(--card3)] transition-colors" style={{ borderColor: "var(--border)" }}>
                            <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdateShort(entry.record_date)}</td>
                            <td className="px-3 py-2.5" style={{ color: "var(--muted)" }}>{acc?.name || "—"}</td>
                            <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: "var(--accent)" }}>{currency} {fmt(entry.balance)}</td>
                            <td className="px-3 py-2.5 max-w-[220px] truncate" style={{ color: "var(--muted2)" }}>{entry.notes || "—"}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteBalance(entry.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg"
                                style={{ background: "var(--danger-bg)", color: "var(--red-c)" }}><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Other Income ─────────────────────────────────────────────────── */}
      {tab === "income" && (() => {
        const sortedIncome = [...income].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
        const total = sortedIncome.reduce((s, r) => s + r.amount, 0);
        return (
          <div>
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold mb-1">Record non-invoice income</p>
              <p className="text-xs" style={{ color: "var(--muted2)" }}>
                Asset sales, interest, refunds and other money-in that isn&apos;t an invoice. Each entry appears in your
                Income Statement and auto-creates a matching credit in the bank ledger.
              </p>
            </div>

            {/* Add Income Form */}
            <form
              onSubmit={async e => {
                e.preventDefault();
                const form = e.currentTarget;
                setIncomeBusy(true);
                try {
                  await createIncome(new FormData(form));
                  toast.success("Income recorded — a bank credit was added. Update your bank balance snapshot below.");
                  form.reset();
                  setIncomeDate(new Date().toISOString().slice(0, 10));
                  setTab("bank");
                  router.refresh();
                } catch { toast.error("Failed to record income"); }
                finally { setIncomeBusy(false); }
              }}
              className="rounded-lg p-4 mb-5"
              style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                  <DateInput name="transaction_date" value={incomeDate} onChange={setIncomeDate} placeholder="Select date" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Income Type *</label>
                  <select name="income_type" defaultValue="asset_sale" className={inp} style={inpS}>
                    {INCOME_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Amount *</label>
                  <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className={inp} style={inpS} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Bank Account</label>
                  <select name="account_id" className={inp} style={inpS}>
                    <option value="">— Optional —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                  <input name="description" placeholder="e.g. Sold company cellphone" className={inp} style={inpS} />
                </div>
                <div className="sm:col-span-2 md:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Reference</label>
                  <input name="reference" placeholder="Optional ref / note" className={inp} style={inpS} />
                </div>
              </div>
              <button type="submit" disabled={incomeBusy}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--accent)", color: "#fff", opacity: incomeBusy ? .6 : 1 }}>
                {incomeBusy ? "Saving…" : "+ Record Income"}
              </button>
            </form>

            {/* Income History */}
            {sortedIncome.length === 0 ? (
              <div className="rounded-lg p-12 text-center" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold mb-1">No other income recorded yet</p>
                <p className="text-xs" style={{ color: "var(--muted2)" }}>Record your first non-invoice income above.</p>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                        {["Date", "Type", "Description", "Account", "Amount", ""].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedIncome.map(r => {
                        const acc = accounts.find(a => a.id === r.account_id);
                        return (
                          <tr key={r.id} className="border-b hover:bg-[var(--card3)] transition-colors" style={{ borderColor: "var(--border)" }}>
                            <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdateShort(r.transaction_date)}</td>
                            <td className="px-3 py-2.5" style={{ color: "var(--muted)" }}>{INCOME_TYPE_LABELS[r.income_type] ?? "Other Income"}</td>
                            <td className="px-3 py-2.5 max-w-[220px] truncate" style={{ color: "var(--muted)" }}>{r.description || "—"}</td>
                            <td className="px-3 py-2.5" style={{ color: "var(--muted2)" }}>{acc?.name || "—"}</td>
                            <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: "var(--accent)" }}>{currency} {fmt(r.amount)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <button onClick={() => handleDeleteIncome(r.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg"
                                style={{ background: "var(--danger-bg)", color: "var(--red-c)" }}><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-2.5 font-semibold" colSpan={4} style={{ color: "var(--muted2)" }}>Total Other Income</td>
                        <td className="px-3 py-2.5 font-mono font-bold" style={{ color: "var(--accent)" }}>{currency} {fmt(total)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <ConfirmDialog {...dialogProps} confirmLabel="Delete" />
    </div>
  );
}
