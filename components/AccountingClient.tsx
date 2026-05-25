"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, Printer } from "lucide-react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import {
  saveBankBalance,
  deleteBankBalance,
  createReconAdjustment,
} from "@/server-actions/banking";

type Invoice = { id: number; amount: number; status: string; transaction_date: string; customer_id: number };
type Cost = { id: number; amount: number; transaction_date: string; cost_category_id: number | null; category_name: string; cost_type: string; include_in_pnl: boolean };
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
  cashflow: Cashflow[];
  accounts: Account[];
  orgName: string;
  orgRegNo: string;
  currency: string;
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
    <div className="flex items-center py-2.5" style={{ paddingLeft: 32, paddingRight: 32, background: "#f0fdf4", borderBottom: "2px solid #10b981" }}>
      <span className="flex-1 text-sm font-bold" style={{ color: "#1a1a2e" }}>{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: "#10b981", minWidth: 120, textAlign: "right" }}>{fmtVal(value, cur)}</span>
      <span style={{ minWidth: 80 }}>&nbsp;</span>
    </div>
  );
}
function Total({ label, value, cur }: { label: string; value: number; cur: string }) {
  return (
    <div className="flex items-center py-3" style={{ paddingLeft: 32, paddingRight: 32, background: "#1a1a2e" }}>
      <span className="flex-1 text-sm font-bold" style={{ color: "#fff" }}>{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: "#10b981", minWidth: 120, textAlign: "right" }}>{fmtVal(value, cur)}</span>
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
  return new Date(y, m, 0).toISOString().slice(0, 10);
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

// ── System balance calculator ────────────────────────────────────────────────
// asOfDate is used for per-row reconciliation. Pass null to get the all-time
// cumulative figure (matches the dashboard's unfiltered "Calculated Rev−OPEX").
function calcSystemBalance(invoices: Invoice[], costs: Cost[], asOfDate: string | null): number {
  const revenue = invoices
    .filter(i => (i.status === "Completed" || i.status === "Paid") && (!asOfDate || i.transaction_date <= asOfDate))
    .reduce((s, i) => s + i.amount, 0);
  const totalCosts = costs
    .filter(c => !asOfDate || c.transaction_date <= asOfDate)
    .reduce((s, c) => s + c.amount, 0);
  return revenue - totalCosts;
}

// ── Main component ───────────────────────────────────────────────────────────
export function AccountingClient({ invoices, costs, cashflow, accounts, orgName, orgRegNo, currency, defaultStart, defaultEnd }: Props) {
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const router = useRouter();
  const [tab, setTab] = useState<"is" | "bs" | "bank">("is");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [pnlView, setPnlView] = useState<"operational" | "full">("operational");
  const [isView, setIsView] = useState<"statement" | "monthly">("statement");
  const [bsView, setBsView] = useState<"statement" | "monthly">("statement");

  // Bank recon state
  const [addBusy, setAddBusy] = useState(false);
  const [balRecordDate, setBalRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [resolveEntry, setResolveEntry] = useState<Cashflow | null>(null);
  const [resolveDate, setResolveDate] = useState("");
  const [resolveBusy, setResolveBusy] = useState(false);
  const [resolveType, setResolveType] = useState<"income" | "cost">("income");


  // ── IS / BS data ─────────────────────────────────────────────────────────
  const isData = useMemo(() => {
    const inPeriod = (d: string) => d >= start && d <= end;
    const completed = invoices.filter(i => i.status === "Completed" && inPeriod(i.transaction_date));
    const pending = invoices.filter(i => i.status === "Pending" && inPeriod(i.transaction_date));
    const revenue = completed.reduce((s, i) => s + i.amount, 0);
    const pendingRev = pending.reduce((s, i) => s + i.amount, 0);

    const periodCosts = costs.filter(c => inPeriod(c.transaction_date));
    const opCosts = periodCosts.filter(c => c.include_in_pnl);
    const nonOpCosts = periodCosts.filter(c => !c.include_in_pnl);

    const byCat: Record<string, number> = {};
    opCosts.forEach(c => { const cat = c.category_name || "Other"; byCat[cat] = (byCat[cat] || 0) + c.amount; });

    const totalOpCosts = opCosts.reduce((s, c) => s + c.amount, 0);
    const operatingProfit = revenue - totalOpCosts;

    // Non-operational breakdown by cost_type
    const byType: Record<string, number> = {};
    nonOpCosts.forEach(c => { byType[c.cost_type] = (byType[c.cost_type] || 0) + c.amount; });
    const totalNonOp = nonOpCosts.reduce((s, c) => s + c.amount, 0);
    const netCashImpact = revenue - totalOpCosts - totalNonOp;

    return { revenue, pendingRev, byCat, totalCosts: totalOpCosts, operatingProfit, byType, totalNonOp, netCashImpact };
  }, [invoices, costs, start, end]);

  const bsData = useMemo(() => {
    const latestByAcct: Record<string, number> = {};
    cashflow.forEach(r => {
      const key = String(r.account_id || "unknown");
      if (!latestByAcct[key] || r.record_date > (cashflow.find(x => String(x.account_id || "unknown") === key)?.record_date || "")) {
        latestByAcct[key] = r.balance;
      }
    });
    const totalCash = Object.values(latestByAcct).reduce((s, b) => s + b, 0);
    const totalRevenue = invoices.filter(i => i.status === "Completed").reduce((s, i) => s + i.amount, 0);
    const totalCosts = costs.reduce((s, c) => s + c.amount, 0);
    const totalPending = invoices.filter(i => i.status === "Pending").reduce((s, i) => s + i.amount, 0);
    return { totalCash, retainedEarnings: totalRevenue - totalCosts, totalPending };
  }, [invoices, costs, cashflow]);

  // ── Monthly IS data ───────────────────────────────────────────────────────
  const isMonthly = useMemo(() => {
    const months = buildMonthRange(start, end);
    return months.map(mk => {
      const me = monthEnd(mk);
      const ms = mk + "-01";
      const inMonth = (d: string) => d >= ms && d <= me;
      const revenue = invoices.filter(i => i.status === "Completed" && inMonth(i.transaction_date)).reduce((s, i) => s + i.amount, 0);
      const opCosts = costs.filter(c => inMonth(c.transaction_date) && c.include_in_pnl);
      const byCat: Record<string, number> = {};
      opCosts.forEach(c => { const cat = c.category_name || "Other"; byCat[cat] = (byCat[cat] || 0) + c.amount; });
      const totalCosts = opCosts.reduce((s, c) => s + c.amount, 0);
      return { mk, revenue, byCat, totalCosts, profit: revenue - totalCosts };
    });
  }, [invoices, costs, start, end]);

  const isMonthlyAllCats = useMemo(() => {
    const s = new Set<string>();
    isMonthly.forEach(m => Object.keys(m.byCat).forEach(c => s.add(c)));
    return [...s].sort();
  }, [isMonthly]);

  // ── Monthly BS data ───────────────────────────────────────────────────────
  const bsMonthly = useMemo(() => {
    const months = buildMonthRange(start, end);
    return months.map(mk => {
      const me = monthEnd(mk);
      const cumRevenue = invoices.filter(i => i.status === "Completed" && i.transaction_date <= me).reduce((s, i) => s + i.amount, 0);
      const cumCosts = costs.filter(c => c.transaction_date <= me).reduce((s, c) => s + c.amount, 0);
      const latestByAcct: Record<string, number> = {};
      [...cashflow].filter(r => r.record_date <= me).sort((a, b) => a.record_date.localeCompare(b.record_date))
        .forEach(r => { latestByAcct[String(r.account_id ?? "unassigned")] = r.balance; });
      const cash = Object.keys(latestByAcct).length > 0 ? Object.values(latestByAcct).reduce((s, b) => s + b, 0) : null;
      return { mk, retainedEarnings: cumRevenue - cumCosts, cash };
    });
  }, [invoices, costs, cashflow, start, end]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleDeleteBalance(id: number) {
    if (!await confirm("Delete this snapshot?", "This bank balance record will be permanently removed.")) return;
    const ok = await runAction(() => deleteBankBalance(id), toast, "Snapshot deleted");
    if (ok) router.refresh();
  }

  function handleResolveClick(entry: Cashflow) {
    const sysBal = calcSystemBalance(invoices, costs, entry.record_date);
    const variance = entry.balance - sysBal;
    setResolveType(variance > 0 ? "income" : "cost");
    setResolveDate(entry.record_date);
    setResolveEntry(entry);
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
        {tabBtn("bank", "Bank Recon")}
      </div>

      {/* ── Income Statement ─────────────────────────────────────────────── */}
      {tab === "is" && (
        <>
          <div className="flex flex-wrap gap-3 items-center mb-4 p-3 rounded-lg print:hidden" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Start</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border outline-none"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>End</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border outline-none"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            {/* Statement / Monthly toggle */}
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              {(["statement", "monthly"] as const).map(v => (
                <button key={v} onClick={() => setIsView(v)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ background: isView === v ? "var(--accent)" : "var(--card3)", color: isView === v ? "#fff" : "var(--muted)" }}>
                  {v === "statement" ? "Statement" : "Monthly"}
                </button>
              ))}
            </div>
            {/* Operational / Full toggle (statement view only) */}
            {isView === "statement" && (
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                {(["operational", "full"] as const).map(v => (
                  <button key={v} onClick={() => setPnlView(v)}
                    className="px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{ background: pnlView === v ? "var(--accent)" : "var(--card3)", color: pnlView === v ? "#fff" : "var(--muted)" }}>
                    {v === "operational" ? "Operational" : "Full Business"}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => window.print()}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
              style={{ background: "var(--card3)", border: "1px solid var(--border)", color: "var(--muted)" }}>
              <Printer size={12} /> Print
            </button>
          </div>

          {/* ── Monthly view ── */}
          {isView === "monthly" && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ background: "var(--card2)", borderColor: "var(--border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
                  Monthly Income Statement — Operational
                </h3>
                <span className="text-xs" style={{ color: "var(--muted2)" }}>{mLabel(start.slice(0,7))} → {mLabel(end.slice(0,7))}</span>
              </div>
              <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                      <th className="px-3 py-2.5 text-left font-semibold sticky left-0 z-10 min-w-[160px]" style={{ background: "var(--card)", color: "var(--muted2)" }}>Line Item</th>
                      {isMonthly.map(m => (
                        <th key={m.mk} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "var(--muted2)", minWidth: 90 }}>{mLabel(m.mk)}</th>
                      ))}
                      <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "var(--muted2)" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Revenue */}
                    <tr className="border-b" style={{ borderColor: "var(--border)", background: "rgba(16,185,129,.04)" }}>
                      <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: "rgba(16,185,129,.06)", color: "var(--accent)" }}>Revenue</td>
                      {isMonthly.map(m => (
                        <td key={m.mk} className="px-3 py-2 text-right font-mono whitespace-nowrap" style={{ color: m.revenue > 0 ? "var(--accent)" : "var(--muted2)" }}>
                          {m.revenue > 0 ? fmtZAR(m.revenue) : "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap" style={{ color: "var(--accent)" }}>
                        {fmtZAR(isMonthly.reduce((s, m) => s + m.revenue, 0))}
                      </td>
                    </tr>
                    {/* Cost rows */}
                    {isMonthlyAllCats.map(cat => (
                      <tr key={cat} className="border-b" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2 pl-5 sticky left-0 z-10" style={{ background: "var(--card2)", color: "var(--muted)" }}>{cat}</td>
                        {isMonthly.map(m => {
                          const v = m.byCat[cat] || 0;
                          return (
                            <td key={m.mk} className="px-3 py-2 text-right font-mono whitespace-nowrap" style={{ color: v > 0 ? "var(--red-c)" : "var(--muted2)" }}>
                              {v > 0 ? fmtZAR(v) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap" style={{ color: "var(--red-c)" }}>
                          {fmtZAR(isMonthly.reduce((s, m) => s + (m.byCat[cat] || 0), 0))}
                        </td>
                      </tr>
                    ))}
                    {/* Total Costs */}
                    <tr className="border-b border-t-2" style={{ borderColor: "var(--border2)" }}>
                      <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: "var(--card)", color: "var(--muted2)" }}>Total Costs</td>
                      {isMonthly.map(m => (
                        <td key={m.mk} className="px-3 py-2 text-right font-mono whitespace-nowrap font-semibold" style={{ color: "var(--red-c)" }}>
                          {m.totalCosts > 0 ? fmtZAR(m.totalCosts) : "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-mono font-bold whitespace-nowrap" style={{ color: "var(--red-c)" }}>
                        {fmtZAR(isMonthly.reduce((s, m) => s + m.totalCosts, 0))}
                      </td>
                    </tr>
                    {/* Profit */}
                    <tr style={{ background: "#1a1a2e" }}>
                      <td className="px-3 py-2.5 font-bold sticky left-0 z-10" style={{ background: "#1a1a2e", color: "#fff" }}>Operating Profit</td>
                      {isMonthly.map(m => (
                        <td key={m.mk} className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap"
                          style={{ color: m.profit >= 0 ? "#10b981" : "#ef4444" }}>
                          {fmtZAR(m.profit)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap"
                        style={{ color: isMonthly.reduce((s, m) => s + m.profit, 0) >= 0 ? "#10b981" : "#ef4444" }}>
                        {fmtZAR(isMonthly.reduce((s, m) => s + m.profit, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Operational view ── */}
          {isView === "statement" && pnlView === "operational" && (
            <div className="rounded-lg overflow-hidden" style={{ background: "#fff", color: "#111", boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>
              <div className="px-8 py-6" style={{ background: "#1a1a2e", color: "#fff" }}>
                <h2 className="text-lg font-bold">{orgName}</h2>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.6)" }}>OPERATIONAL P&L{orgRegNo ? ` | Reg: ${orgRegNo}` : ""}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>For the period: {fdate(start)} to {fdate(end)}</p>
              </div>
              <div className="flex text-xs font-bold uppercase tracking-wider py-2" style={{ paddingLeft: 32, paddingRight: 32, background: "#f8f9fa", color: "#888", borderBottom: "1px solid #e5e5e5" }}>
                <span className="flex-1">Description</span>
                <span style={{ minWidth: 140, textAlign: "right" }}>Amount (ZAR)</span>
                <span style={{ minWidth: 80 }}>&nbsp;</span>
              </div>
              <SectionHdr label="REVENUE" />
              <Row label="Turnover (Completed Invoices)" value={isData.revenue} cur={currency} />
              <Row label="Deferred Revenue (Pending)" value={0} cur={currency} note={`${fmtZAR(isData.pendingRev)} not yet earned`} />
              {isData.revenue > 0 && <Subtotal label="TOTAL REVENUE" value={isData.revenue} cur={currency} />}
              <SectionHdr label="OPERATING EXPENSES" />
              {Object.entries(isData.byCat).map(([cat, val]) => (
                <Row key={cat} label={cat} value={-val} cur={currency} indent={1} />
              ))}
              {Object.keys(isData.byCat).length === 0 && <Row label="No operational costs recorded in period" value={0} cur={currency} />}
              <Subtotal label="TOTAL OPERATING EXPENSES" value={-isData.totalCosts} cur={currency} />
              <SectionHdr label="PROFIT" />
              <Total label="OPERATING PROFIT / (LOSS)" value={isData.operatingProfit} cur={currency} />
            </div>
          )}

          {/* ── Full business view ── */}
          {isView === "statement" && pnlView === "full" && (
            <div className="rounded-lg overflow-hidden" style={{ background: "#fff", color: "#111", boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>
              <div className="px-8 py-6" style={{ background: "#1a1a2e", color: "#fff" }}>
                <h2 className="text-lg font-bold">{orgName}</h2>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.6)" }}>FULL BUSINESS VIEW{orgRegNo ? ` | Reg: ${orgRegNo}` : ""}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>For the period: {fdate(start)} to {fdate(end)}</p>
              </div>
              <div className="flex text-xs font-bold uppercase tracking-wider py-2" style={{ paddingLeft: 32, paddingRight: 32, background: "#f8f9fa", color: "#888", borderBottom: "1px solid #e5e5e5" }}>
                <span className="flex-1">Description</span>
                <span style={{ minWidth: 140, textAlign: "right" }}>Amount (ZAR)</span>
                <span style={{ minWidth: 80 }}>&nbsp;</span>
              </div>
              <SectionHdr label="OPERATIONAL P&L" />
              <Row label="Revenue (Completed Invoices)" value={isData.revenue} cur={currency} />
              <Row label="Operational Costs" value={-isData.totalCosts} cur={currency} indent={1} />
              <Subtotal label="OPERATING PROFIT / (LOSS)" value={isData.operatingProfit} cur={currency} />

              {Object.keys(isData.byType).length > 0 && (
                <>
                  <SectionHdr label="NON-OPERATIONAL COSTS" />
                  {Object.entries(isData.byType).map(([type, val]) => (
                    <Row key={type} label={COST_TYPE_LABELS[type] ?? type} value={-val} cur={currency} indent={1} />
                  ))}
                  <Subtotal label="TOTAL NON-OPERATIONAL" value={-isData.totalNonOp} cur={currency} />
                </>
              )}

              <SectionHdr label="NET POSITION" />
              <div className="flex items-center py-3" style={{ paddingLeft: 32, paddingRight: 32, background: "#1a1a2e" }}>
                <span className="flex-1 text-sm font-bold" style={{ color: "#fff" }}>NET CASH IMPACT</span>
                <span className="font-mono text-sm font-bold" style={{ color: isData.netCashImpact >= 0 ? "#10b981" : "#ef4444", minWidth: 140, textAlign: "right" }}>
                  {fmtZAR(isData.netCashImpact)}
                </span>
                <span style={{ minWidth: 80 }}>&nbsp;</span>
              </div>
              {isData.pendingRev > 0 && (
                <div className="px-8 py-2 text-xs italic" style={{ color: "#888", background: "#f9f9f9" }}>
                  Note: {fmtZAR(isData.pendingRev)} pending revenue not included above.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Balance Sheet ────────────────────────────────────────────────── */}
      {tab === "bs" && (
        <>
          <div className="flex flex-wrap gap-3 items-center justify-between mb-3 print:hidden">
            {/* Statement / Monthly toggle */}
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              {(["statement", "monthly"] as const).map(v => (
                <button key={v} onClick={() => setBsView(v)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ background: bsView === v ? "var(--accent)" : "var(--card3)", color: bsView === v ? "#fff" : "var(--muted)" }}>
                  {v === "statement" ? "Statement" : "Monthly Trend"}
                </button>
              ))}
            </div>
            {bsView === "statement" && (
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
                style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                <Printer size={12} /> Print
              </button>
            )}
          </div>

          {/* ── BS Statement (current) ── */}
          {bsView === "statement" && (
            <div className="rounded-lg overflow-hidden" style={{ background: "#fff", color: "#111", boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>
              <div className="px-8 py-6" style={{ background: "#1a1a2e", color: "#fff" }}>
                <h2 className="text-lg font-bold">{orgName}</h2>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.6)" }}>BALANCE SHEET (SIMPLIFIED)</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>As at {fdate(new Date().toISOString().slice(0, 10))}</p>
              </div>
              <SectionHdr label="ASSETS" />
              <Row label="Cash and Cash Equivalents" value={bsData.totalCash} cur={currency} />
              <Row label="Trade Receivables (Pending Invoices)" value={bsData.totalPending} cur={currency} />
              <Subtotal label="TOTAL ASSETS" value={bsData.totalCash + bsData.totalPending} cur={currency} />
              <SectionHdr label="EQUITY" />
              <Row label="Retained Earnings (Revenue – Costs)" value={bsData.retainedEarnings} cur={currency} />
              <Total label="TOTAL EQUITY" value={bsData.retainedEarnings} cur={currency} />
              <div className="px-8 py-3 text-xs italic" style={{ color: "#888", background: "#f9f9f9" }}>
                Note: Simplified view. Use a dedicated accounting system for PPE, loans, and other adjustments.
              </div>
            </div>
          )}

          {/* ── BS Monthly Trend ── */}
          {bsView === "monthly" && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ background: "var(--card2)", borderColor: "var(--border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
                  Balance Sheet — Month-End Positions
                </h3>
                <span className="text-xs" style={{ color: "var(--muted2)" }}>{mLabel(start.slice(0,7))} → {mLabel(end.slice(0,7))}</span>
              </div>
              <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                      <th className="px-3 py-2.5 text-left font-semibold sticky left-0 z-10 min-w-[180px]" style={{ background: "var(--card)", color: "var(--muted2)" }}>Line Item</th>
                      {bsMonthly.map(m => (
                        <th key={m.mk} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "var(--muted2)", minWidth: 100 }}>
                          {mLabel(m.mk)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Cash */}
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: "var(--card2)", color: "var(--muted)" }}>Cash (Bank Snapshots)</td>
                      {bsMonthly.map(m => (
                        <td key={m.mk} className="px-3 py-2 text-right font-mono whitespace-nowrap"
                          style={{ color: m.cash !== null ? "var(--accent)" : "var(--muted2)" }}>
                          {m.cash !== null ? fmtZAR(m.cash) : "—"}
                        </td>
                      ))}
                    </tr>
                    {/* Retained Earnings */}
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: "var(--card2)", color: "var(--muted)" }}>Retained Earnings</td>
                      {bsMonthly.map(m => (
                        <td key={m.mk} className="px-3 py-2 text-right font-mono whitespace-nowrap"
                          style={{ color: m.retainedEarnings >= 0 ? "var(--foreground)" : "var(--red-c)" }}>
                          {fmtZAR(m.retainedEarnings)}
                        </td>
                      ))}
                    </tr>
                    {/* Total Equity */}
                    <tr style={{ background: "#1a1a2e" }}>
                      <td className="px-3 py-2.5 font-bold sticky left-0 z-10" style={{ background: "#1a1a2e", color: "#fff" }}>Total Equity</td>
                      {bsMonthly.map(m => (
                        <td key={m.mk} className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap"
                          style={{ color: m.retainedEarnings >= 0 ? "#10b981" : "#ef4444" }}>
                          {fmtZAR(m.retainedEarnings)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 text-xs italic" style={{ background: "var(--card)", color: "var(--muted2)", borderTop: "1px solid var(--border)" }}>
                Each column = position as at last day of that month. Cash shown only where a bank snapshot exists for the month. Retained Earnings = cumulative completed revenue − cumulative costs.
              </div>
            </div>
          )}
        </>
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

        const sysBalToday = calcSystemBalance(invoices, costs, null);
        const currentVariance = totalBankBal != null ? totalBankBal - sysBalToday : null;
        const varColor = currentVariance === null ? "var(--muted2)"
          : Math.abs(currentVariance) < 1 ? "var(--accent)"
          : Math.abs(currentVariance) / Math.max(Math.abs(totalBankBal ?? 1), 1) < 0.05 ? "var(--amber-c)"
          : "var(--red-c)";

        return (
          <div>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>
                  Total Bank Balance{multiAccount ? ` (${acctEntries.length} accounts)` : ""}
                </div>
                <div className="text-xl font-bold font-mono" style={{ color: "var(--accent)" }}>
                  {totalBankBal != null ? `${currency} ${fmt(totalBankBal)}` : "—"}
                </div>
                {latestSnapshotDate && <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>latest: {fdateShort(latestSnapshotDate)}</div>}
              </div>
              <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>System Balance (Today)</div>
                <div className="text-xl font-bold font-mono" style={{ color: "var(--purple-c)" }}>
                  {currency} {fmt(sysBalToday)}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Completed revenue − costs</div>
              </div>
              <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Variance</div>
                <div className="text-xl font-bold font-mono" style={{ color: varColor }}>
                  {currentVariance === null ? "—"
                    : Math.abs(currentVariance) < 1 ? "✓ Balanced"
                    : `${currentVariance >= 0 ? "+" : ""}${currency} ${fmt(currentVariance)}`}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>
                  {currentVariance === null ? "No snapshots yet"
                    : Math.abs(currentVariance) < 1 ? "Records match bank"
                    : currentVariance > 0 ? "Bank higher — possible unrecorded income"
                    : "Bank lower — possible unrecorded cost"}
                </div>
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
                <p className="text-xs" style={{ color: "var(--muted2)" }}>Add your first bank balance above to start reconciling.</p>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {/* Mobile Cards */}
                <div className="sm:hidden divide-y" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
                  {sortedCf.map(entry => {
                    const sysBal = calcSystemBalance(invoices, costs, entry.record_date);
                    const variance = entry.balance - sysBal;
                    const isBalanced = Math.abs(variance) < 1;
                    const acc = accounts.find(a => a.id === entry.account_id);
                    const vc = isBalanced ? "var(--accent)"
                      : Math.abs(variance) / Math.max(Math.abs(entry.balance), 1) < 0.05 ? "var(--amber-c)"
                      : "var(--red-c)";
                    return (
                      <div key={entry.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">{fdateShort(entry.record_date)}</span>
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full" style={{ background: vc + "22", color: vc }}>
                            {isBalanced ? "✓ Balanced" : `${variance >= 0 ? "+" : ""}${currency} ${fmt(variance)}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="rounded-xl p-2.5" style={{ background: "var(--card)" }}>
                            <p className="text-xs mb-0.5" style={{ color: "var(--muted2)" }}>Bank Balance</p>
                            <p className="font-bold font-mono text-sm" style={{ color: "var(--accent)" }}>{currency} {fmt(entry.balance)}</p>
                          </div>
                          <div className="rounded-xl p-2.5" style={{ background: "var(--card)" }}>
                            <p className="text-xs mb-0.5" style={{ color: "var(--muted2)" }}>System Balance</p>
                            <p className="font-bold font-mono text-sm" style={{ color: "var(--purple-c)" }}>{currency} {fmt(sysBal)}</p>
                          </div>
                        </div>
                        {(entry.notes || acc) && (
                          <p className="text-xs mb-3" style={{ color: "var(--muted2)" }}>
                            {acc && <span>{acc.name} </span>}{entry.notes}
                          </p>
                        )}
                        <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                          {!isBalanced && (
                            <button onClick={() => handleResolveClick(entry)}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold"
                              style={{ background: "rgba(245,158,11,.12)", color: "var(--amber-c)", border: "1px solid var(--amber-c)" }}>
                              Resolve Variance
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteBalance(entry.id)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
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
                        {["Date", "Account", "Bank Balance", "System Balance", "Variance", "Notes", ""].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCf.map(entry => {
                        const sysBal = calcSystemBalance(invoices, costs, entry.record_date);
                        const variance = entry.balance - sysBal;
                        const isBalanced = Math.abs(variance) < 1;
                        const acc = accounts.find(a => a.id === entry.account_id);
                        const vc = isBalanced ? "var(--accent)"
                          : Math.abs(variance) / Math.max(Math.abs(entry.balance), 1) < 0.05 ? "var(--amber-c)"
                          : "var(--red-c)";
                        return (
                          <tr key={entry.id} className="border-b hover:bg-[var(--card3)] transition-colors" style={{ borderColor: "var(--border)" }}>
                            <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdateShort(entry.record_date)}</td>
                            <td className="px-3 py-2.5" style={{ color: "var(--muted)" }}>{acc?.name || "—"}</td>
                            <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: "var(--accent)" }}>{currency} {fmt(entry.balance)}</td>
                            <td className="px-3 py-2.5 font-mono" style={{ color: "var(--purple-c)" }}>{currency} {fmt(sysBal)}</td>
                            <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap" style={{ color: vc }}>
                              {isBalanced ? "✓ Balanced" : `${variance >= 0 ? "+" : ""}${currency} ${fmt(variance)}`}
                            </td>
                            <td className="px-3 py-2.5 max-w-[160px] truncate" style={{ color: "var(--muted2)" }}>{entry.notes || "—"}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex gap-1">
                                {!isBalanced && (
                                  <button onClick={() => handleResolveClick(entry)}
                                    className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                                    style={{ background: "rgba(245,158,11,.12)", color: "var(--amber-c)", border: "1px solid var(--amber-c)" }}>
                                    Resolve
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteBalance(entry.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                                  style={{ background: "var(--danger-bg)", color: "var(--red-c)" }}><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 text-xs" style={{ background: "var(--card)", color: "var(--muted2)", borderTop: "1px solid var(--border)" }}>
                  System Balance = all completed invoices − all costs up to snapshot date
                </div>
              </div>
            )}

            {/* Resolve Modal */}
            {resolveEntry && (() => {
              const sysBal = calcSystemBalance(invoices, costs, resolveEntry.record_date);
              const variance = resolveEntry.balance - sysBal;
              const absVar = Math.abs(variance);
              const isIncome = variance > 0;
              return (
                <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center overflow-y-auto sm:py-10 sm:px-4"
                  style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
                  onClick={e => { if (e.target === e.currentTarget) setResolveEntry(null); }}>
                  <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                    <div className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: "var(--border)" }} />
                    <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-base font-semibold">Resolve Variance</h2>
                      <button onClick={() => setResolveEntry(null)} className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--card3)] transition-colors" style={{ color: "var(--muted2)" }}><X size={18} /></button>
                    </div>
                    <div className="p-5">
                      {/* Summary */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {([
                          ["Bank Balance", `${currency} ${fmt(resolveEntry.balance)}`, "var(--accent)"],
                          ["System Balance", `${currency} ${fmt(sysBal)}`, "var(--purple-c)"],
                          ["Variance", `${variance >= 0 ? "+" : ""}${currency} ${fmt(variance)}`, isIncome ? "var(--amber-c)" : "var(--red-c)"],
                        ] as const).map(([l, v, c]) => (
                          <div key={l} className="rounded p-2.5 text-center" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
                            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
                            <div className="text-sm font-bold font-mono" style={{ color: c }}>{v}</div>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs mb-4 p-3 rounded" style={{
                        background: isIncome ? "rgba(245,158,11,.1)" : "rgba(239,68,68,.1)",
                        color: isIncome ? "var(--amber-c)" : "var(--red-c)",
                        border: `1px solid ${isIncome ? "var(--amber-c)" : "var(--red-c)"}`,
                      }}>
                        {isIncome
                          ? `Your bank shows ${currency} ${fmt(absVar)} more than your system records — likely unrecorded income.`
                          : `Your bank shows ${currency} ${fmt(absVar)} less than your system records — likely an unrecorded cost.`}
                      </p>

                      <form onSubmit={async e => {
                        e.preventDefault();
                        setResolveBusy(true);
                        try {
                          await createReconAdjustment(new FormData(e.currentTarget));
                          setResolveEntry(null);
                          toast.success("Adjustment created — variance will update");
                        } catch { toast.error("Failed to create adjustment"); }
                        finally { setResolveBusy(false); }
                      }}>
                        <input type="hidden" name="type" value={resolveType} />

                        {/* Adjustment type toggle */}
                        <div className="mb-3">
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--muted2)" }}>Adjustment Type</label>
                          <div className="flex rounded overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                            {(["income", "cost"] as const).map(t => (
                              <button key={t} type="button" onClick={() => setResolveType(t)}
                                className="flex-1 py-2 text-xs font-semibold transition-colors"
                                style={{
                                  background: resolveType === t ? (t === "income" ? "var(--accent)" : "var(--red-c)") : "var(--background)",
                                  color: resolveType === t ? "#fff" : "var(--muted)",
                                }}>
                                {t === "income" ? "▲ Add Income" : "▼ Add Cost"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                            <input name="description"
                              defaultValue={`Bank Reconciliation Adjustment — ${fdateShort(resolveEntry.record_date)}`}
                              className={inp} style={inpS} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Amount</label>
                              <input name="amount" type="number" step="0.01" min="0.01"
                                defaultValue={absVar.toFixed(2)}
                                className={inp} style={inpS} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date</label>
                              <DateInput name="date" value={resolveDate} onChange={setResolveDate} placeholder="Select date" />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                          <button type="button" onClick={() => setResolveEntry(null)}
                            className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                            Cancel
                          </button>
                          <button type="submit" disabled={resolveBusy}
                            className="flex-1 py-2 text-sm font-semibold rounded"
                            style={{ background: "var(--accent)", color: "#fff", opacity: resolveBusy ? .6 : 1 }}>
                            {resolveBusy ? "Creating…" : "Create Adjustment"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      <ConfirmDialog {...dialogProps} confirmLabel="Delete" />
    </div>
  );
}
