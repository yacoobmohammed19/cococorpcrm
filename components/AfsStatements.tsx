"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Check, X, Printer } from "lucide-react";
import { useToast } from "@/components/Toast";
import { BS_SECTIONS, CASH_FLOW_SECTIONS, type StatementKey } from "@/lib/afs/catalog";
import { finYearRange, type AutoFigures } from "@/lib/afs/compute";
import { buildStatement, type SavedAfsRow, type RenderLine } from "@/lib/afs/merge";
import { saveAfsStatement, setTaxRate } from "@/server-actions/afs";

type IsInvoice = { amount: number; status: string; transaction_date: string };
type IsCost = { amount: number; transaction_date: string; category_name: string; cost_type: string };
type IsIncome = { amount: number; transaction_date: string };

type Props = {
  statement: StatementKey;
  afsLines: SavedAfsRow[];
  autoByYear: Record<number, AutoFigures>;
  finYear: number;
  finYears: number[];
  onFinYearChange: (y: number) => void;
  fiscalYearStart: number;
  taxRate: number;
  currency: string;
  canEdit: boolean;
  orgName: string;
  orgRegNo: string;
  orgVatNo: string;
  orgAddress: string;
  // Raw rows powering the income statement (category breakdown, basis, monthly)
  invoices: IsInvoice[];
  costs: IsCost[];
  income: IsIncome[];
};

// ── Income-statement helpers ───────────────────────────────────────────────
const IS_DRAW = (t: string) => t === "owner_draw" || t === "personal";
const IS_SADAQAH = (t: string) => t === "sadaqah";
const IS_ZAKAT = (t: string) => t === "zakat";
const IS_CAPEX = (t: string) => t === "capex"; // asset purchase → PPE, not a P&L expense

function buildMonths(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  const [ey, em] = end.slice(0, 7).split("-").map(Number);
  while ((y < ey || (y === ey && m <= em)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
function monthLast(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  return `${mk}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}
function mShort(mk: string): string {
  const [y, mo] = mk.split("-");
  return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mo] + " '" + y.slice(2);
}

const STATEMENT_TITLES: Record<StatementKey, string> = {
  balance_sheet: "STATEMENT OF FINANCIAL POSITION",
  income_statement: "STATEMENT OF COMPREHENSIVE INCOME",
  changes_in_equity: "STATEMENT OF CHANGES IN EQUITY",
  cash_flow: "STATEMENT OF CASH FLOWS",
  notes: "NOTES TO THE FINANCIAL STATEMENTS",
};

// Sections per statement, in presentation order, with the grand-total bucket
// each rolls into (for the balance sheet).
function sectionsFor(statement: StatementKey): { key: string; label: string; side?: string }[] {
  if (statement === "balance_sheet") return BS_SECTIONS.map(s => ({ key: s.key, label: s.label, side: s.side }));
  if (statement === "income_statement") return [
    { key: "revenue", label: "Revenue & Other Income" },
    { key: "expenses", label: "Expenses" },
    { key: "tax", label: "Taxation" },
  ];
  if (statement === "cash_flow") return CASH_FLOW_SECTIONS.map(s => ({ key: s.key, label: s.label }));
  if (statement === "changes_in_equity") return [{ key: "equity", label: "Movements in Equity" }];
  return [{ key: "notes", label: "Notes" }];
}

function fmtMoney(n: number, cur: string): string {
  const abs = Math.abs(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? `(${cur} ${abs})` : n === 0 ? "—" : `${cur} ${abs}`;
}

function fyEndLabel(finYear: number, fyStartMonth: number): string {
  const { end } = finYearRange(finYear, fyStartMonth);
  return new Date(end).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

export function AfsStatements({
  statement, afsLines, autoByYear, finYear, finYears, onFinYearChange,
  fiscalYearStart, taxRate, currency, canEdit,
  orgName, orgRegNo, orgVatNo, orgAddress,
  invoices, costs, income,
}: Props) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RenderLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [rateInput, setRateInput] = useState(String(taxRate));
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");
  const [isMonthlyView, setIsMonthlyView] = useState(false);

  // Income statement computed for a financial year on the chosen basis.
  const computeIS = (year: number, b: "accrual" | "cash") => {
    const { start, end } = finYearRange(year, fiscalYearStart);
    const inFy = (d: string) => !!d && d >= start && d <= end;
    const earned = b === "accrual"
      ? (s: string) => s === "Completed" || s === "Paid" || s === "Pending"
      : (s: string) => s === "Completed" || s === "Paid";
    const revenue = invoices.filter(i => earned(i.status) && inFy(i.transaction_date)).reduce((s, i) => s + i.amount, 0);
    const otherIncome = income.filter(r => inFy(r.transaction_date)).reduce((s, r) => s + r.amount, 0);
    const fc = costs.filter(c => inFy(c.transaction_date));
    const byCat: Record<string, number> = {};
    fc.filter(c => !IS_DRAW(c.cost_type) && !IS_SADAQAH(c.cost_type) && !IS_ZAKAT(c.cost_type) && !IS_CAPEX(c.cost_type))
      .forEach(c => { const k = c.category_name || "Other"; byCat[k] = (byCat[k] || 0) + c.amount; });
    const totalOpex = Object.values(byCat).reduce((s, v) => s + v, 0);
    const donations = fc.filter(c => IS_SADAQAH(c.cost_type)).reduce((s, c) => s + c.amount, 0);
    const zakat = fc.filter(c => IS_ZAKAT(c.cost_type)).reduce((s, c) => s + c.amount, 0);
    const amort = autoByYear[year]?.amortisation ?? 0; // R&D amortisation charge
    const pretax = revenue + otherIncome - totalOpex - donations - zakat - amort;
    const tax = Math.max(pretax, 0) * (taxRate / 100);
    return { revenue, otherIncome, byCat, totalOpex, donations, zakat, amort, pretax, tax, profit: pretax - tax };
  };

  const isNow = useMemo(() => computeIS(finYear, basis), [finYear, basis, invoices, costs, income, taxRate, fiscalYearStart]);
  const isPrev = useMemo(() => computeIS(finYear - 1, basis), [finYear, basis, invoices, costs, income, taxRate, fiscalYearStart]);
  const isCatNames = useMemo(() => [...new Set([...Object.keys(isNow.byCat), ...Object.keys(isPrev.byCat)])].sort(), [isNow, isPrev]);

  const isMonthlyData = useMemo(() => {
    const { start, end } = finYearRange(finYear, fiscalYearStart);
    return buildMonths(start, end).map(mk => {
      const lo = `${mk}-01` > start ? `${mk}-01` : start;
      const hiRaw = monthLast(mk);
      const hi = hiRaw < end ? hiRaw : end;
      const m = computeISForRange(lo, hi, basis);
      return { mk, ...m };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finYear, basis, invoices, costs, income, taxRate, fiscalYearStart]);

  function computeISForRange(lo: string, hi: string, b: "accrual" | "cash") {
    const inR = (d: string) => !!d && d >= lo && d <= hi;
    const earned = b === "accrual"
      ? (s: string) => s === "Completed" || s === "Paid" || s === "Pending"
      : (s: string) => s === "Completed" || s === "Paid";
    const revenue = invoices.filter(i => earned(i.status) && inR(i.transaction_date)).reduce((s, i) => s + i.amount, 0);
    const otherIncome = income.filter(r => inR(r.transaction_date)).reduce((s, r) => s + r.amount, 0);
    const fc = costs.filter(c => inR(c.transaction_date) && !IS_DRAW(c.cost_type) && !IS_SADAQAH(c.cost_type) && !IS_ZAKAT(c.cost_type) && !IS_CAPEX(c.cost_type));
    const byCat: Record<string, number> = {};
    fc.forEach(c => { const k = c.category_name || "Other"; byCat[k] = (byCat[k] || 0) + c.amount; });
    const totalOpex = Object.values(byCat).reduce((s, v) => s + v, 0);
    return { revenue, otherIncome, byCat, totalOpex, profit: revenue + otherIncome - totalOpex };
  }

  // ── Cash flow (indirect method), auto-derived from balance-sheet movements ──
  // Balance-sheet line values (auto + saved overrides) for a year, by line_key.
  const bsVals = (year: number): Record<string, number> => {
    const lines = buildStatement("balance_sheet", autoByYear[year], afsLines.filter(r => r.fin_year === year));
    const m: Record<string, number> = {};
    lines.forEach(l => { if (l.line_key) m[l.line_key] = l.amount; });
    return m;
  };
  const computeCF = (year: number) => {
    const cur = bsVals(year);
    const prev = bsVals(year - 1);
    const d = (k: string) => (cur[k] ?? 0) - (prev[k] ?? 0);
    // Operating: profit that flows to retained earnings (pre-tax, drawings excluded)
    // + working-capital movements (a rise in receivables/inventory uses cash;
    // a rise in payables/tax owed releases cash). Intangibles are non-cash, so
    // they (and their matching reserve) are excluded from investing.
    const pretax = computeIS(year, "accrual").pretax;
    const amort = autoByYear[year]?.amortisation ?? 0; // non-cash, added back
    const wc = -d("trade_receivables") - d("inventory") + d("trade_payables") + d("vat_payable") + d("tax_payable");
    const cfo = pretax + amort + wc;
    const invPpe = -d("ppe");
    const invInv = -d("investments");
    const cfi = invPpe + invInv;
    const finLoans = d("long_term_loans") + d("short_term_loans");
    const finCap = d("share_capital");
    const drawings = autoByYear[year]?.drawings ?? 0;
    const finDraw = -drawings;
    const cff = finLoans + finCap + finDraw;
    const net = cfo + cfi + cff;
    const openCash = prev["cash"] ?? 0;
    const closeComputed = openCash + net;
    const closeActual = cur["cash"] ?? 0;
    return { pretax, amort, wc, cfo, invPpe, invInv, cfi, finLoans, finCap, finDraw, cff, net, openCash, closeComputed, closeActual, diff: closeActual - closeComputed };
  };
  const isCf = statement === "cash_flow";
  const cfNow = isCf ? computeCF(finYear) : null;
  const cfPrev = isCf ? computeCF(finYear - 1) : null;
  const [rateBusy, setRateBusy] = useState(false);

  async function saveRate() {
    setRateBusy(true);
    try {
      await setTaxRate(Number(rateInput));
      toast.success("Tax rate saved");
      router.refresh();
    } catch {
      toast.error("Failed to save tax rate");
    } finally {
      setRateBusy(false);
    }
  }

  const sections = sectionsFor(statement);

  // Merged current + prior-year lines (read model)
  const currentLines = useMemo(
    () => buildStatement(statement, autoByYear[finYear], afsLines.filter(r => r.fin_year === finYear)),
    [statement, autoByYear, finYear, afsLines],
  );
  const priorLines = useMemo(
    () => buildStatement(statement, autoByYear[finYear - 1], afsLines.filter(r => r.fin_year === finYear - 1)),
    [statement, autoByYear, finYear, afsLines],
  );
  // Pure auto/default values for the current year — used to detect overrides on save.
  const autoMap = useMemo(() => {
    const m: Record<string, number> = {};
    buildStatement(statement, autoByYear[finYear], []).forEach(l => { if (l.line_key) m[l.line_key] = l.amount; });
    return m;
  }, [statement, autoByYear, finYear]);
  const priorByKey = useMemo(() => {
    const m: Record<string, number> = {};
    priorLines.forEach(l => { if (l.line_key) m[l.line_key] = l.amount; });
    return m;
  }, [priorLines]);

  // For the income statement, prepopulate the tax line with the suggested tax
  // (rate × profit before tax) whenever the user hasn't overridden it.
  const displayCurrent = useMemo(() => {
    if (statement === "income_statement") {
      const inc = currentLines.filter(l => l.section === "revenue").reduce((s, l) => s + l.amount, 0);
      const exp = currentLines.filter(l => l.section === "expenses").reduce((s, l) => s + l.amount, 0);
      const suggested = Math.round(Math.max(inc - exp, 0) * (taxRate / 100) * 100) / 100;
      return currentLines.map(l => (l.line_key === "tax_expense" && !l.overridden ? { ...l, amount: suggested } : l));
    }
    if (statement === "changes_in_equity") {
      // Opening retained earnings = prior year-end retained earnings.
      const opening = autoByYear[finYear - 1]?.retained_earnings ?? 0;
      return currentLines.map(l => (l.line_key === "coe_opening" && !l.overridden ? { ...l, amount: opening } : l));
    }
    return currentLines;
  }, [currentLines, statement, taxRate, autoByYear, finYear]);

  const shown = editing ? draft : displayCurrent;
  const inSection = (sec: string) => shown.filter(l => l.section === sec);
  const secTotal = (sec: string) => inSection(sec).reduce((s, l) => s + l.amount, 0);
  const sumSides = (side: string) =>
    sections.filter(s => s.side === side).reduce((tot, s) => tot + secTotal(s.key), 0);

  // Balance sheet grand totals
  const totalAssets = sumSides("assets");
  const totalEqLiab = sumSides("eqliab");
  const balanceDiff = totalAssets - totalEqLiab;

  const isIncome = statement === "income_statement";

  // Changes in Equity (retained-earnings reconciliation)
  const isCoe = statement === "changes_in_equity";
  const coeOpening = shown.find(l => l.line_key === "coe_opening")?.amount ?? 0;
  const coeProfit = shown.find(l => l.line_key === "coe_profit")?.amount ?? 0;
  const coeDraw = shown.find(l => l.line_key === "coe_dividends")?.amount ?? 0;
  const coeClosing = coeOpening + coeProfit - coeDraw;
  const coeTarget = autoByYear[finYear]?.retained_earnings ?? 0;
  const coeDiff = coeClosing - coeTarget;
  const priorOpening = autoByYear[finYear - 2]?.retained_earnings ?? 0;
  const priorCoeProfit = priorLines.find(l => l.line_key === "coe_profit")?.amount ?? 0;
  const priorCoeDraw = priorLines.find(l => l.line_key === "coe_dividends")?.amount ?? 0;
  const priorClosing = priorOpening + priorCoeProfit - priorCoeDraw;

  function startEdit() {
    // Base the draft on the display model so injected auto values (suggested
    // tax, opening retained earnings) are the starting point.
    setDraft(displayCurrent.map(l => ({ ...l })));
    setEditing(true);
  }
  function cancel() { setEditing(false); setDraft([]); }
  function patch(idx: number, field: "amount" | "label", val: string) {
    setDraft(d => d.map((l, i) => i === idx ? { ...l, [field]: field === "amount" ? Number(val || 0) : val } : l));
  }
  function addCustom(section: string) {
    setDraft(d => [...d, { id: null, line_key: null, section, label: "", amount: 0, is_custom: true, sort: d.length, note: null, auto: false, overridden: true }]);
  }
  function removeLine(idx: number) { setDraft(d => d.filter((_, i) => i !== idx)); }

  async function save() {
    // Persist custom lines and any standard line whose amount differs from its auto default.
    const payload = draft
      .filter(l => l.is_custom ? l.label.trim() !== "" : l.amount !== (autoMap[l.line_key ?? ""] ?? 0))
      .map((l, i) => ({
        section: l.section,
        line_key: l.is_custom ? null : l.line_key,
        label: l.label,
        amount: l.amount,
        is_custom: l.is_custom,
        sort: i,
        note: l.note,
      }));
    setBusy(true);
    try {
      await saveAfsStatement(finYear, statement, JSON.stringify(payload));
      toast.success("Statement saved");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to save statement");
    } finally {
      setBusy(false);
    }
  }

  const isBalanceSheet = statement === "balance_sheet";

  // Render helpers (plain functions returning JSX — not nested components)
  function lineRow(line: RenderLine, idx: number, key: string) {
    const prior = line.line_key ? priorByKey[line.line_key] ?? 0 : 0;
    return (
      <div key={key} className="flex items-center py-2 border-b" style={{ paddingLeft: 28, paddingRight: 20, borderColor: "#eee" }}>
        {editing ? (
          <>
            {line.is_custom ? (
              <input value={line.label} onChange={e => patch(idx, "label", e.target.value)} placeholder="Line description"
                className="flex-1 text-sm px-2 py-1 rounded border" style={{ borderColor: "#ddd", color: "#111" }} />
            ) : (
              <span className="flex-1 text-sm" style={{ color: "#333" }}>{line.label}{line.auto && <span className="ml-2 text-xs" style={{ color: "#aaa" }}>auto</span>}</span>
            )}
            <input type="number" step="0.01" value={line.amount} onChange={e => patch(idx, "amount", e.target.value)}
              className="w-32 text-sm px-2 py-1 rounded border font-mono text-right" style={{ borderColor: "#ddd", color: "#111" }} />
            <button onClick={() => removeLine(idx)} className="ml-2 w-7 h-7 flex items-center justify-center rounded" style={{ color: "#ef4444" }}><Trash2 size={13} /></button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm" style={{ color: "#333" }}>
              {line.label}
              {line.overridden && !line.is_custom && <span className="ml-2 text-xs" style={{ color: "#f59e0b" }}>edited</span>}
            </span>
            <span className="font-mono text-sm" style={{ minWidth: 130, textAlign: "right", color: "#111" }}>{fmtMoney(line.amount, currency)}</span>
            <span className="font-mono text-sm" style={{ minWidth: 130, textAlign: "right", color: "#999" }}>{fmtMoney(prior, currency)}</span>
          </>
        )}
      </div>
    );
  }

  function sectionBlock(sec: { key: string; label: string; side?: string }) {
    const lines = inSection(sec.key);
    const subtotal = secTotal(sec.key);
    const priorSubtotal = priorLines.filter(l => l.section === sec.key).reduce((s, l) => s + l.amount, 0);
    return (
      <div key={sec.key}>
        <div className="px-5 py-2 text-xs font-bold uppercase tracking-wider" style={{ background: "#f8f9fa", color: "#555", borderBottom: "1px solid #e5e5e5" }}>{sec.label}</div>
        {lines.map((line, i) => lineRow(line, draft.indexOf(line), `${sec.key}-${line.line_key ?? (line.id != null ? `id${line.id}` : `c${i}`)}`))}
        {editing && (
          <button onClick={() => addCustom(sec.key)} className="flex items-center gap-1.5 text-xs font-semibold px-5 py-2" style={{ color: "var(--accent)" }}>
            <Plus size={12} /> Add line
          </button>
        )}
        {!editing && lines.length === 0 && (
          <div className="px-7 py-2 text-xs italic border-b" style={{ color: "#bbb", borderColor: "#eee" }}>None</div>
        )}
        <div className="flex items-center py-2 border-b-2" style={{ paddingLeft: 20, paddingRight: 20, background: "#fafafa", borderColor: "#ddd" }}>
          <span className="flex-1 text-sm font-semibold" style={{ color: "#1a1a2e" }}>Total {sec.label}</span>
          <span className="font-mono text-sm font-semibold" style={{ minWidth: 130, textAlign: "right", color: "#111" }}>{fmtMoney(subtotal, currency)}</span>
          {!editing && <span className="font-mono text-sm font-semibold" style={{ minWidth: 130, textAlign: "right", color: "#999" }}>{fmtMoney(priorSubtotal, currency)}</span>}
        </div>
      </div>
    );
  }

  function grandTotal(label: string, value: number, prior: number) {
    return (
      <div className="flex items-center py-3" style={{ paddingLeft: 20, paddingRight: 20, background: "#1a1a2e" }}>
        <span className="flex-1 text-sm font-bold" style={{ color: "#fff" }}>{label}</span>
        <span className="font-mono text-sm font-bold" style={{ minWidth: 130, textAlign: "right", color: "#ec4899" }}>{fmtMoney(value, currency)}</span>
        {!editing && <span className="font-mono text-sm font-bold" style={{ minWidth: 130, textAlign: "right", color: "rgba(255,255,255,.5)" }}>{fmtMoney(prior, currency)}</span>}
      </div>
    );
  }

  function plainRow(label: string, value: number, prior: number, indent = false, k?: string) {
    return (
      <div key={k} className="flex items-center py-2 border-b" style={{ paddingLeft: indent ? 40 : 28, paddingRight: 20, borderColor: "#eee" }}>
        <span className="flex-1 text-sm" style={{ color: "#333" }}>{label}</span>
        <span className="font-mono text-sm" style={{ minWidth: 130, textAlign: "right", color: "#111" }}>{fmtMoney(value, currency)}</span>
        <span className="font-mono text-sm" style={{ minWidth: 130, textAlign: "right", color: "#999" }}>{fmtMoney(prior, currency)}</span>
      </div>
    );
  }

  function subtotalRow(label: string, value: number, prior: number) {
    return (
      <div className="flex items-center py-2 border-b-2" style={{ paddingLeft: 20, paddingRight: 20, background: "#fafafa", borderColor: "#ddd" }}>
        <span className="flex-1 text-sm font-semibold" style={{ color: "#1a1a2e" }}>{label}</span>
        <span className="font-mono text-sm font-semibold" style={{ minWidth: 130, textAlign: "right", color: "#111" }}>{fmtMoney(value, currency)}</span>
        <span className="font-mono text-sm font-semibold" style={{ minWidth: 130, textAlign: "right", color: "#999" }}>{fmtMoney(prior, currency)}</span>
      </div>
    );
  }

  const monthCatNames = [...new Set(isMonthlyData.flatMap(m => Object.keys(m.byCat)))].sort();

  const priorAssets = priorLines.filter(l => BS_SECTIONS.some(s => s.side === "assets" && s.key === l.section)).reduce((s, l) => s + l.amount, 0);
  const priorEqLiab = priorLines.filter(l => BS_SECTIONS.some(s => s.side === "eqliab" && s.key === l.section)).reduce((s, l) => s + l.amount, 0);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4 p-3 rounded-lg print:hidden" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Financial Year</label>
          <select value={finYear} onChange={e => onFinYearChange(Number(e.target.value))} disabled={editing}
            className="px-2 py-1.5 text-xs rounded border outline-none"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
            {finYears.map(y => <option key={y} value={y}>FY{y} (year ended {fyEndLabel(y, fiscalYearStart)})</option>)}
          </select>
        </div>
        {statement === "income_statement" && (
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {(["accrual", "cash"] as const).map(b => (
              <button key={b} onClick={() => setBasis(b)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: basis === b ? "var(--accent)" : "var(--card3)", color: basis === b ? "#fff" : "var(--muted)" }}>
                {b === "accrual" ? "Accrual" : "Cash"}
              </button>
            ))}
          </div>
        )}
        {statement === "income_statement" && (
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {([["statement", "Statement"], ["monthly", "Monthly"]] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => setIsMonthlyView(v === "monthly")}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: (isMonthlyView ? "monthly" : "statement") === v ? "var(--accent)" : "var(--card3)", color: (isMonthlyView ? "monthly" : "statement") === v ? "#fff" : "var(--muted)" }}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        {statement === "income_statement" && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Tax Rate %</label>
            <input type="number" step="0.1" value={rateInput} onChange={e => setRateInput(e.target.value)}
              className="w-16 px-2 py-1.5 text-xs rounded border outline-none"
              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            <button onClick={saveRate} disabled={rateBusy || Number(rateInput) === taxRate}
              className="px-2 py-1.5 text-xs font-semibold rounded" style={{ background: "var(--card3)", border: "1px solid var(--border)", color: "var(--muted)", opacity: rateBusy ? .6 : 1 }}>
              Set
            </button>
          </div>
        )}
        {!editing && (
          <button onClick={() => window.print()} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
            <Printer size={12} /> Print / Save PDF
          </button>
        )}
        {canEdit && !editing && statement !== "income_statement" && statement !== "cash_flow" && (
          <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: "var(--card3)", border: "1px solid var(--border)", color: "var(--muted)" }}>
            <Pencil size={12} /> Edit
          </button>
        )}
        {editing && (
          <div className="ml-auto flex gap-2">
            <button onClick={cancel} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold" style={{ border: "1px solid var(--border)", color: "var(--muted)" }}><X size={12} /> Cancel</button>
            <button onClick={save} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}><Check size={12} /> {busy ? "Saving…" : "Save"}</button>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm 15mm; }
          body * { visibility: hidden !important; }
          .afs-doc, .afs-doc * { visibility: visible !important; }
          .afs-doc { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
        }
      `}</style>

      {/* Statement document */}
      <div className="rounded-lg overflow-hidden afs-doc" style={{ background: "#fff", color: "#111", boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>
        <div className="px-8 py-6" style={{ background: "#1a1a2e", color: "#fff" }}>
          <h2 className="text-lg font-bold">{orgName}</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>
            {[orgRegNo && `Reg: ${orgRegNo}`, orgVatNo && `VAT: ${orgVatNo}`].filter(Boolean).join("  |  ")}
          </p>
          {orgAddress && <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{orgAddress}</p>}
          <p className="text-xs mt-2 font-semibold" style={{ color: "rgba(255,255,255,.8)" }}>{STATEMENT_TITLES[statement]}</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>as at {fyEndLabel(finYear, fiscalYearStart)}</p>
        </div>
        {!(isIncome && isMonthlyView) && (
          <div className="flex text-xs font-bold uppercase tracking-wider py-2" style={{ paddingLeft: 20, paddingRight: 20, background: "#f8f9fa", color: "#888", borderBottom: "1px solid #e5e5e5" }}>
            <span className="flex-1">Description</span>
            <span style={{ minWidth: 130, textAlign: "right" }}>FY{finYear}</span>
            {!editing && <span style={{ minWidth: 130, textAlign: "right" }}>FY{finYear - 1}</span>}
          </div>
        )}

        {isBalanceSheet ? (
          <>
            <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "#eef", color: "#334" }}>Assets</div>
            {sections.filter(s => s.side === "assets").map(s => sectionBlock(s))}
            {grandTotal("TOTAL ASSETS", totalAssets, priorAssets)}
            <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "#eef", color: "#334" }}>Equity &amp; Liabilities</div>
            {sections.filter(s => s.side === "eqliab").map(s => sectionBlock(s))}
            {grandTotal("TOTAL EQUITY & LIABILITIES", totalEqLiab, priorEqLiab)}
            {/* Balance check */}
            <div className="flex items-center py-3" style={{ paddingLeft: 20, paddingRight: 20, background: Math.abs(balanceDiff) < 1 ? "#f0fdf4" : "#fef2f2" }}>
              <span className="flex-1 text-sm font-bold" style={{ color: "#1a1a2e" }}>Balance Check (Assets − Equity &amp; Liabilities)</span>
              <span className="font-mono text-sm font-bold" style={{ minWidth: 130, textAlign: "right", color: Math.abs(balanceDiff) < 1 ? "#16a34a" : "#ef4444" }}>
                {Math.abs(balanceDiff) < 1 ? "✓ Balanced" : fmtMoney(balanceDiff, currency)}
              </span>
            </div>
          </>
        ) : isIncome && isMonthlyView ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #e5e5e5" }}>
                  <th className="px-3 py-2.5 text-left font-semibold sticky left-0 z-10 min-w-[160px]" style={{ background: "#f8f9fa", color: "#888" }}>Line Item</th>
                  {isMonthlyData.map(m => <th key={m.mk} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "#888", minWidth: 90 }}>{mShort(m.mk)}</th>)}
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "#888" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b" style={{ borderColor: "#eee", background: "rgba(236,72,153,.04)" }}>
                  <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: "rgba(236,72,153,.04)", color: "#ec4899" }}>Revenue</td>
                  {isMonthlyData.map(m => <td key={m.mk} className="px-3 py-2 text-right font-mono whitespace-nowrap" style={{ color: "#111" }}>{m.revenue > 0 ? fmtMoney(m.revenue, currency) : "—"}</td>)}
                  <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: "#111" }}>{fmtMoney(isMonthlyData.reduce((s, m) => s + m.revenue, 0), currency)}</td>
                </tr>
                {isMonthlyData.some(m => m.otherIncome > 0) && (
                  <tr className="border-b" style={{ borderColor: "#eee" }}>
                    <td className="px-3 py-2 pl-5 sticky left-0 z-10" style={{ background: "#fff", color: "#333" }}>Other Income</td>
                    {isMonthlyData.map(m => <td key={m.mk} className="px-3 py-2 text-right font-mono whitespace-nowrap" style={{ color: "#111" }}>{m.otherIncome > 0 ? fmtMoney(m.otherIncome, currency) : "—"}</td>)}
                    <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: "#111" }}>{fmtMoney(isMonthlyData.reduce((s, m) => s + m.otherIncome, 0), currency)}</td>
                  </tr>
                )}
                {monthCatNames.map(cat => (
                  <tr key={cat} className="border-b" style={{ borderColor: "#eee" }}>
                    <td className="px-3 py-2 pl-5 sticky left-0 z-10" style={{ background: "#fff", color: "#666" }}>{cat}</td>
                    {isMonthlyData.map(m => <td key={m.mk} className="px-3 py-2 text-right font-mono whitespace-nowrap" style={{ color: "#b91c1c" }}>{(m.byCat[cat] || 0) > 0 ? fmtMoney(m.byCat[cat], currency) : "—"}</td>)}
                    <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: "#b91c1c" }}>{fmtMoney(isMonthlyData.reduce((s, m) => s + (m.byCat[cat] || 0), 0), currency)}</td>
                  </tr>
                ))}
                <tr className="border-b border-t-2" style={{ borderColor: "#ddd" }}>
                  <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: "#fafafa", color: "#333" }}>Total Operating Expenses</td>
                  {isMonthlyData.map(m => <td key={m.mk} className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap" style={{ color: "#b91c1c" }}>{m.totalOpex > 0 ? fmtMoney(m.totalOpex, currency) : "—"}</td>)}
                  <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "#b91c1c" }}>{fmtMoney(isMonthlyData.reduce((s, m) => s + m.totalOpex, 0), currency)}</td>
                </tr>
                <tr style={{ background: "#1a1a2e" }}>
                  <td className="px-3 py-2.5 font-bold sticky left-0 z-10" style={{ background: "#1a1a2e", color: "#fff" }}>Profit</td>
                  {isMonthlyData.map(m => <td key={m.mk} className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap" style={{ color: m.profit >= 0 ? "#ec4899" : "#ef4444" }}>{fmtMoney(m.profit, currency)}</td>)}
                  <td className="px-3 py-2.5 text-right font-mono font-bold" style={{ color: isMonthlyData.reduce((s, m) => s + m.profit, 0) >= 0 ? "#ec4899" : "#ef4444" }}>{fmtMoney(isMonthlyData.reduce((s, m) => s + m.profit, 0), currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : isIncome ? (
          <>
            <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "#eef", color: "#334" }}>Income</div>
            {plainRow("Revenue", isNow.revenue, isPrev.revenue)}
            {(isNow.otherIncome !== 0 || isPrev.otherIncome !== 0) && plainRow("Other Income", isNow.otherIncome, isPrev.otherIncome, true)}
            {subtotalRow("Total Income", isNow.revenue + isNow.otherIncome, isPrev.revenue + isPrev.otherIncome)}
            <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "#eef", color: "#334" }}>Operating Expenses</div>
            {isCatNames.length === 0 && <div className="px-7 py-2 text-xs italic border-b" style={{ color: "#bbb", borderColor: "#eee" }}>None</div>}
            {isCatNames.map(cat => plainRow(cat, isNow.byCat[cat] || 0, isPrev.byCat[cat] || 0, true, cat))}
            {subtotalRow("Total Operating Expenses", isNow.totalOpex, isPrev.totalOpex)}
            {(isNow.donations !== 0 || isPrev.donations !== 0) && plainRow("Donations (Sadaqah)", isNow.donations, isPrev.donations)}
            {(isNow.zakat !== 0 || isPrev.zakat !== 0) && plainRow("Zakat", isNow.zakat, isPrev.zakat)}
            {(isNow.amort !== 0 || isPrev.amort !== 0) && plainRow("Amortisation (Capitalised R&D)", isNow.amort, isPrev.amort)}
            {grandTotal("PROFIT BEFORE TAX", isNow.pretax, isPrev.pretax)}
            {plainRow(`Taxation (${taxRate}%)`, isNow.tax, isPrev.tax)}
            {grandTotal("PROFIT FOR THE YEAR", isNow.profit, isPrev.profit)}
          </>
        ) : isCoe && !editing ? (
          <>
            {plainRow("Opening Retained Earnings", coeOpening, priorOpening)}
            {plainRow("Add: Profit for the Year", coeProfit, priorCoeProfit)}
            {plainRow("Less: Drawings / Distributions", -coeDraw, -priorCoeDraw)}
            {grandTotal("CLOSING RETAINED EARNINGS", coeClosing, priorClosing)}
            <div className="flex items-center py-3" style={{ paddingLeft: 20, paddingRight: 20, background: Math.abs(coeDiff) < 1 ? "#f0fdf4" : "#fef2f2" }}>
              <span className="flex-1 text-sm font-bold" style={{ color: "#1a1a2e" }}>Reconciles to Balance Sheet retained earnings</span>
              <span className="font-mono text-sm font-bold" style={{ minWidth: 130, textAlign: "right", color: Math.abs(coeDiff) < 1 ? "#16a34a" : "#ef4444" }}>
                {Math.abs(coeDiff) < 1 ? "✓" : fmtMoney(coeDiff, currency)}
              </span>
            </div>
          </>
        ) : isCf && cfNow && cfPrev ? (
          <>
            <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "#eef", color: "#334" }}>Operating Activities</div>
            {plainRow("Profit before tax", cfNow.pretax, cfPrev.pretax)}
            {(cfNow.amort !== 0 || cfPrev.amort !== 0) && plainRow("Add: Amortisation (non-cash)", cfNow.amort, cfPrev.amort)}
            {plainRow("Working capital movements", cfNow.wc, cfPrev.wc)}
            {subtotalRow("Cash from Operating Activities", cfNow.cfo, cfPrev.cfo)}
            <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "#eef", color: "#334" }}>Investing Activities</div>
            {plainRow("Purchase of Property, Plant & Equipment", cfNow.invPpe, cfPrev.invPpe)}
            {plainRow("Investments", cfNow.invInv, cfPrev.invInv)}
            {subtotalRow("Cash from Investing Activities", cfNow.cfi, cfPrev.cfi)}
            <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "#eef", color: "#334" }}>Financing Activities</div>
            {plainRow("Loans raised / (repaid)", cfNow.finLoans, cfPrev.finLoans)}
            {plainRow("Share capital issued", cfNow.finCap, cfPrev.finCap)}
            {plainRow("Drawings / distributions", cfNow.finDraw, cfPrev.finDraw)}
            {subtotalRow("Cash from Financing Activities", cfNow.cff, cfPrev.cff)}
            {grandTotal("NET CHANGE IN CASH", cfNow.net, cfPrev.net)}
            {plainRow("Cash at beginning of year", cfNow.openCash, cfPrev.openCash)}
            {grandTotal("CASH AT END OF YEAR", cfNow.closeComputed, cfPrev.closeComputed)}
            <div className="flex items-center py-3" style={{ paddingLeft: 20, paddingRight: 20, background: Math.abs(cfNow.diff) < 1 ? "#f0fdf4" : "#fff7ed" }}>
              <span className="flex-1 text-sm" style={{ color: "#555" }}>Cash per latest bank snapshot{Math.abs(cfNow.diff) >= 1 ? " — see note" : " ✓"}</span>
              <span className="font-mono text-sm font-semibold" style={{ minWidth: 130, textAlign: "right", color: Math.abs(cfNow.diff) < 1 ? "#16a34a" : "#d97706" }}>{fmtMoney(cfNow.closeActual, currency)}</span>
              {!editing && <span className="font-mono text-sm" style={{ minWidth: 130, textAlign: "right", color: "#999" }}>{fmtMoney(cfPrev.closeActual, currency)}</span>}
            </div>
            {Math.abs(cfNow.diff) >= 1 && (
              <div className="px-8 py-2 text-xs italic" style={{ color: "#b45309", background: "#fff7ed" }}>
                {fmtMoney(cfNow.diff, currency)} of the closing cash isn&apos;t explained by the movements above — usually a balance-sheet item not yet captured (opening balance, capital, loan) or a snapshot that isn&apos;t at year-end.
              </div>
            )}
          </>
        ) : (
          sections.map(s => sectionBlock(s))
        )}

        <div className="px-8 py-3 text-xs italic print:hidden" style={{ color: "#888", background: "#f9f9f9" }}>
          Auto lines are prepopulated from your records; edit to override or add custom lines. Comparative column = prior financial year.
        </div>
        {/* Signature block (statutory sign-off) */}
        <div className="px-8 py-8" style={{ borderTop: "1px solid #e5e5e5" }}>
          <div className="flex flex-wrap gap-10 text-xs" style={{ color: "#333" }}>
            <div>
              <div style={{ width: 200, borderBottom: "1px solid #999", height: 28 }} />
              <p className="mt-1">Prepared by</p>
            </div>
            <div>
              <div style={{ width: 200, borderBottom: "1px solid #999", height: 28 }} />
              <p className="mt-1">Public Officer</p>
            </div>
            <div>
              <div style={{ width: 140, borderBottom: "1px solid #999", height: 28 }} />
              <p className="mt-1">Date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
