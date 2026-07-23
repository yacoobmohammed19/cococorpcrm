// Static catalog of STANDARD Annual Financial Statement lines, in IFRS-for-SMEs
// / SARS order. Each line optionally maps to an `auto` figure the app computes
// (see lib/afs/compute.ts); the rest default to 0 and are filled in by the user.

export type StatementKey =
  | "balance_sheet"
  | "income_statement"
  | "changes_in_equity"
  | "cash_flow"
  | "notes";

export type AutoSource =
  | "cash"
  | "trade_receivables"
  | "intangibles"
  | "intangibles_gross"
  | "amortisation"
  | "ppe"
  | "retained_earnings"
  | "revenue"
  | "other_income"
  | "total_expenses"
  | "drawings"
  | "donations"
  | "zakat"
  | "profit_for_year";

export type CatalogLine = {
  statement: StatementKey;
  section: string;
  line_key: string;
  label: string;
  auto?: AutoSource;
};

// Balance-sheet sections, in presentation order. `side` drives which grand
// total a section rolls into (TOTAL ASSETS vs TOTAL EQUITY & LIABILITIES).
export const BS_SECTIONS = [
  { key: "non_current_assets", label: "Non-Current Assets", side: "assets" },
  { key: "current_assets", label: "Current Assets", side: "assets" },
  { key: "equity", label: "Equity", side: "eqliab" },
  { key: "non_current_liabilities", label: "Non-Current Liabilities", side: "eqliab" },
  { key: "current_liabilities", label: "Current Liabilities", side: "eqliab" },
] as const;

export const CASH_FLOW_SECTIONS = [
  { key: "operating", label: "Cash Flow from Operating Activities" },
  { key: "investing", label: "Cash Flow from Investing Activities" },
  { key: "financing", label: "Cash Flow from Financing Activities" },
] as const;

export const CATALOG: CatalogLine[] = [
  // ── Statement of Financial Position ──────────────────────────────────────
  { statement: "balance_sheet", section: "non_current_assets", line_key: "ppe", label: "Property, Plant & Equipment", auto: "ppe" },
  { statement: "balance_sheet", section: "non_current_assets", line_key: "intangibles", label: "Intangible Assets", auto: "intangibles" },
  { statement: "balance_sheet", section: "non_current_assets", line_key: "investments", label: "Investments" },
  { statement: "balance_sheet", section: "current_assets", line_key: "inventory", label: "Inventory" },
  { statement: "balance_sheet", section: "current_assets", line_key: "trade_receivables", label: "Trade & Other Receivables", auto: "trade_receivables" },
  { statement: "balance_sheet", section: "current_assets", line_key: "cash", label: "Cash & Cash Equivalents", auto: "cash" },
  { statement: "balance_sheet", section: "equity", line_key: "share_capital", label: "Share Capital" },
  { statement: "balance_sheet", section: "equity", line_key: "retained_earnings", label: "Retained Earnings", auto: "retained_earnings" },
  // Equity counterpart to capitalised development (own work capitalised): the
  // intangible asset's value is matched here so the sheet balances.
  { statement: "balance_sheet", section: "equity", line_key: "capitalised_dev", label: "Capitalised Development Reserve", auto: "intangibles_gross" },
  { statement: "balance_sheet", section: "non_current_liabilities", line_key: "long_term_loans", label: "Long-Term Loans" },
  { statement: "balance_sheet", section: "non_current_liabilities", line_key: "deferred_tax", label: "Deferred Tax" },
  { statement: "balance_sheet", section: "current_liabilities", line_key: "trade_payables", label: "Trade & Other Payables" },
  { statement: "balance_sheet", section: "current_liabilities", line_key: "vat_payable", label: "VAT Payable" },
  { statement: "balance_sheet", section: "current_liabilities", line_key: "tax_payable", label: "Income Tax Payable" },
  { statement: "balance_sheet", section: "current_liabilities", line_key: "short_term_loans", label: "Short-Term Loans" },

  // ── Income Statement (statutory layout) ──────────────────────────────────
  { statement: "income_statement", section: "revenue", line_key: "revenue", label: "Revenue", auto: "revenue" },
  { statement: "income_statement", section: "revenue", line_key: "other_income", label: "Other Income", auto: "other_income" },
  { statement: "income_statement", section: "expenses", line_key: "operating_expenses", label: "Operating Expenses", auto: "total_expenses" },
  { statement: "income_statement", section: "expenses", line_key: "donations", label: "Donations (Sadaqah)", auto: "donations" },
  { statement: "income_statement", section: "expenses", line_key: "zakat", label: "Zakat", auto: "zakat" },
  { statement: "income_statement", section: "expenses", line_key: "depreciation", label: "Depreciation & Amortisation" },
  { statement: "income_statement", section: "expenses", line_key: "finance_costs", label: "Finance Costs" },
  { statement: "income_statement", section: "tax", line_key: "tax_expense", label: "Taxation" },

  // ── Statement of Changes in Equity (retained-earnings reconciliation) ────
  // coe_opening is prepopulated from the prior year-end in the component.
  { statement: "changes_in_equity", section: "equity", line_key: "coe_opening", label: "Opening Retained Earnings" },
  { statement: "changes_in_equity", section: "equity", line_key: "coe_profit", label: "Profit for the Year", auto: "profit_for_year" },
  { statement: "changes_in_equity", section: "equity", line_key: "coe_dividends", label: "Less: Drawings / Distributions", auto: "drawings" },

  // ── Statement of Cash Flows (indirect method; user-completed scaffold) ────
  { statement: "cash_flow", section: "operating", line_key: "cf_profit", label: "Profit Before Tax" },
  { statement: "cash_flow", section: "operating", line_key: "cf_depreciation", label: "Adjustment: Depreciation & Amortisation" },
  { statement: "cash_flow", section: "operating", line_key: "cf_working_capital", label: "Working Capital Changes" },
  { statement: "cash_flow", section: "operating", line_key: "cf_tax_paid", label: "Taxation Paid" },
  { statement: "cash_flow", section: "investing", line_key: "cf_ppe", label: "Purchase of Property, Plant & Equipment" },
  { statement: "cash_flow", section: "investing", line_key: "cf_investments", label: "Investments Made" },
  { statement: "cash_flow", section: "financing", line_key: "cf_loans", label: "Loans Raised / (Repaid)" },
  { statement: "cash_flow", section: "financing", line_key: "cf_capital", label: "Share Capital Issued" },
  { statement: "cash_flow", section: "financing", line_key: "cf_dividends", label: "Dividends Paid" },

  // ── Notes (scaffold headings; free-text via note field) ──────────────────
  { statement: "notes", section: "notes", line_key: "accounting_policies", label: "1. Accounting Policies" },
  { statement: "notes", section: "notes", line_key: "ppe_note", label: "2. Property, Plant & Equipment" },
  { statement: "notes", section: "notes", line_key: "receivables_note", label: "3. Trade & Other Receivables" },
  { statement: "notes", section: "notes", line_key: "payables_note", label: "4. Trade & Other Payables" },
  { statement: "notes", section: "notes", line_key: "tax_note", label: "5. Taxation" },
];

export const AFS_LABELS: Record<string, string> = Object.fromEntries(
  CATALOG.map((c) => [c.line_key, c.label]),
);

export const DEFAULT_TAX_RATE = 27; // SA company income tax rate (%)
