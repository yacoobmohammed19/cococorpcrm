import type { AutoSource } from "./catalog";

// Auto-derived figures for one financial year, computed from the fact tables
// as at the year-end (balance-sheet items) or over the year (income items).
export type AutoFigures = Record<AutoSource, number>;

type Inv = { amount: number; status: string; transaction_date: string };
type Cost = { amount: number; transaction_date: string; cost_type?: string };
type Income = { amount: number; transaction_date: string };
type Cashflow = { balance: number; account_id: number | null; record_date: string };

const isCompleted = (s: string) => s === "Completed" || s === "Paid";

// Owner's draws / personal spend are distributions of equity, not business
// expenses: they leave the Income Statement and appear as drawings in the
// Statement of Changes in Equity.
const DRAWING_TYPES = new Set(["owner_draw", "personal"]);
const isDrawing = (c: Cost) => DRAWING_TYPES.has(c.cost_type ?? "operational");
// Charity is an expense (charge against profit), shown on its own lines.
const isSadaqah = (c: Cost) => (c.cost_type ?? "") === "sadaqah";
const isZakat = (c: Cost) => (c.cost_type ?? "") === "zakat";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Financial-year date window, labelled by the calendar year in which the year
 * ENDS. `fyStartMonth` is 1-12 (SA default 3 = March start ⇒ Feb year-end).
 * A January start means the FY runs Jan–Dec of `finYear`.
 */
export function finYearRange(finYear: number, fyStartMonth: number): { start: string; end: string } {
  const m = Math.min(Math.max(Math.round(fyStartMonth || 3), 1), 12);
  if (m === 1) {
    return { start: `${finYear}-01-01`, end: `${finYear}-12-31` };
  }
  const start = `${finYear - 1}-${pad(m)}-01`;
  // Last day of the month before the start month, in finYear.
  const endD = new Date(finYear, m - 1, 0);
  const end = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
  return { start, end };
}

export function computeAutoFigures(opts: {
  fyStart: string;
  fyEnd: string;
  invoices: Inv[];
  costs: Cost[];
  income: Income[];
  cashflow: Cashflow[];
  intangibles: number; // capex net book value as at fyEnd (computed by caller)
}): AutoFigures {
  const { fyStart, fyEnd } = opts;
  const inFy = (d: string) => d >= fyStart && d <= fyEnd;

  // ── Balance-sheet figures: cumulative "as at" year-end ──
  const retainedEarnings =
    opts.invoices.filter((i) => isCompleted(i.status) && i.transaction_date <= fyEnd).reduce((s, i) => s + i.amount, 0) +
    opts.income.filter((r) => r.transaction_date <= fyEnd).reduce((s, r) => s + r.amount, 0) -
    opts.costs.filter((c) => c.transaction_date <= fyEnd).reduce((s, c) => s + c.amount, 0);

  const tradeReceivables = opts.invoices
    .filter((i) => i.status === "Pending" && i.transaction_date <= fyEnd)
    .reduce((s, i) => s + i.amount, 0);

  // Cash = latest snapshot per account with record_date <= year-end.
  const latest: Record<string, { d: string; b: number }> = {};
  for (const r of opts.cashflow) {
    if (r.record_date > fyEnd) continue;
    const k = String(r.account_id ?? "unassigned");
    if (!latest[k] || r.record_date > latest[k].d) latest[k] = { d: r.record_date, b: r.balance };
  }
  const cash = Object.values(latest).reduce((s, x) => s + x.b, 0);

  // ── Income-statement figures: within the financial year ──
  const revenue = opts.invoices
    .filter((i) => isCompleted(i.status) && inFy(i.transaction_date))
    .reduce((s, i) => s + i.amount, 0);
  const otherIncome = opts.income.filter((r) => inFy(r.transaction_date)).reduce((s, r) => s + r.amount, 0);
  const fyCosts = opts.costs.filter((c) => inFy(c.transaction_date));
  const drawings = fyCosts.filter((c) => isDrawing(c)).reduce((s, c) => s + c.amount, 0);
  const donations = fyCosts.filter((c) => isSadaqah(c)).reduce((s, c) => s + c.amount, 0);
  const zakat = fyCosts.filter((c) => isZakat(c)).reduce((s, c) => s + c.amount, 0);
  // Operating expenses exclude drawings (equity) and charity (shown separately).
  const totalExpenses = fyCosts
    .filter((c) => !isDrawing(c) && !isSadaqah(c) && !isZakat(c))
    .reduce((s, c) => s + c.amount, 0);
  const profitForYear = revenue + otherIncome - totalExpenses - donations - zakat;

  return {
    cash,
    trade_receivables: tradeReceivables,
    intangibles: opts.intangibles,
    retained_earnings: retainedEarnings,
    revenue,
    other_income: otherIncome,
    total_expenses: totalExpenses,
    drawings,
    donations,
    zakat,
    profit_for_year: profitForYear,
  };
}
