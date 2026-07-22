"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Check, X, Printer } from "lucide-react";
import { useToast } from "@/components/Toast";
import { BS_SECTIONS, CASH_FLOW_SECTIONS, type StatementKey } from "@/lib/afs/catalog";
import { finYearRange, type AutoFigures } from "@/lib/afs/compute";
import { buildStatement, type SavedAfsRow, type RenderLine } from "@/lib/afs/merge";
import { saveAfsStatement, setTaxRate } from "@/server-actions/afs";

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
};

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
}: Props) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RenderLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [rateInput, setRateInput] = useState(String(taxRate));
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
    if (statement !== "income_statement") return currentLines;
    const inc = currentLines.filter(l => l.section === "revenue").reduce((s, l) => s + l.amount, 0);
    const exp = currentLines.filter(l => l.section === "expenses").reduce((s, l) => s + l.amount, 0);
    const suggested = Math.round(Math.max(inc - exp, 0) * (taxRate / 100) * 100) / 100;
    return currentLines.map(l => (l.line_key === "tax_expense" && !l.overridden ? { ...l, amount: suggested } : l));
  }, [currentLines, statement, taxRate]);

  const shown = editing ? draft : displayCurrent;
  const inSection = (sec: string) => shown.filter(l => l.section === sec);
  const secTotal = (sec: string) => inSection(sec).reduce((s, l) => s + l.amount, 0);
  const sumSides = (side: string) =>
    sections.filter(s => s.side === side).reduce((tot, s) => tot + secTotal(s.key), 0);

  // Balance sheet grand totals
  const totalAssets = sumSides("assets");
  const totalEqLiab = sumSides("eqliab");
  const balanceDiff = totalAssets - totalEqLiab;

  // Income statement figures (positive magnitudes; expenses subtract)
  const isIncome = statement === "income_statement";
  const incomeTotal = shown.filter(l => l.section === "revenue").reduce((s, l) => s + l.amount, 0);
  const expenseTotal = shown.filter(l => l.section === "expenses").reduce((s, l) => s + l.amount, 0);
  const pbt = incomeTotal - expenseTotal;
  const taxAmount = shown.filter(l => l.section === "tax").reduce((s, l) => s + l.amount, 0);
  const profitForYear = pbt - taxAmount;
  const priorIncome = priorLines.filter(l => l.section === "revenue").reduce((s, l) => s + l.amount, 0);
  const priorExpense = priorLines.filter(l => l.section === "expenses").reduce((s, l) => s + l.amount, 0);
  const priorPbt = priorIncome - priorExpense;
  const priorTaxLine = priorLines.find(l => l.line_key === "tax_expense");
  const priorTax = priorTaxLine && priorTaxLine.overridden ? priorTaxLine.amount : Math.max(priorPbt, 0) * (taxRate / 100);
  const priorProfit = priorPbt - priorTax;

  function startEdit() {
    let base = currentLines.map(l => ({ ...l }));
    if (statement === "income_statement") {
      const inc = base.filter(l => l.section === "revenue").reduce((s, l) => s + l.amount, 0);
      const exp = base.filter(l => l.section === "expenses").reduce((s, l) => s + l.amount, 0);
      const suggested = Math.round(Math.max(inc - exp, 0) * (taxRate / 100) * 100) / 100;
      base = base.map(l => (l.line_key === "tax_expense" && !l.overridden ? { ...l, amount: suggested } : l));
    }
    setDraft(base);
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
        {canEdit && !editing && (
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
        <div className="flex text-xs font-bold uppercase tracking-wider py-2" style={{ paddingLeft: 20, paddingRight: 20, background: "#f8f9fa", color: "#888", borderBottom: "1px solid #e5e5e5" }}>
          <span className="flex-1">Description</span>
          <span style={{ minWidth: 130, textAlign: "right" }}>FY{finYear}</span>
          {!editing && <span style={{ minWidth: 130, textAlign: "right" }}>FY{finYear - 1}</span>}
        </div>

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
        ) : isIncome ? (
          <>
            {sectionBlock({ key: "revenue", label: "Revenue & Other Income" })}
            {sectionBlock({ key: "expenses", label: "Expenses" })}
            {grandTotal("PROFIT BEFORE TAX", pbt, priorPbt)}
            {sectionBlock({ key: "tax", label: "Taxation" })}
            {grandTotal("PROFIT FOR THE YEAR", profitForYear, priorProfit)}
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
