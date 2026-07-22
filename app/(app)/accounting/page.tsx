import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { AccountingClient } from "@/components/AccountingClient";
import { computeCapex } from "@/lib/capex";
import { computeAutoFigures, finYearRange, type AutoFigures } from "@/lib/afs/compute";
import { DEFAULT_TAX_RATE } from "@/lib/afs/catalog";

export default async function AccountingPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const now = new Date();
  const fyStart = `${now.getFullYear()}-01-01`;
  const fyEnd = now.toISOString().slice(0, 10);

  const [{ data: invoices }, { data: costs }, { data: income }, { data: cashflow }, { data: org }, { data: accounts }, { data: afsLines }, { data: capexProjects }, { data: capexTimes }] = await Promise.all([
    supabase.from("fact_invoices").select("id, amount, status, transaction_date, customer_id").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_costs").select("id, amount, transaction_date, cost_category_id, cost_type, include_in_pnl, dim_cost_categories(name)").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_income").select("id, amount, transaction_date, description, income_type, account_id").eq("org_id", orgId).is("deleted_at", null).order("transaction_date", { ascending: false }),
    supabase.from("fact_cashflow").select("id, balance, account_id, record_date, notes").eq("org_id", orgId).order("record_date", { ascending: false }),
    supabase.from("organizations").select("currency, name, reg_no, vat_no, address, fiscal_year_start, feature_flags, default_hourly_rate").eq("id", orgId).single(),
    supabase.from("dim_accounts").select("id, name").eq("org_id", orgId).order("name"),
    supabase.from("fact_afs_lines").select("id, fin_year, statement, section, line_key, label, amount, is_custom, sort, note").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("rd_projects").select("id, finalized_at, is_capex, amortisation_months, hourly_rate_override").eq("org_id", orgId).eq("is_capex", true).is("deleted_at", null),
    supabase.from("time_entries").select("entity_id, minutes").eq("org_id", orgId).eq("entity_type", "rd_project"),
  ]);

  // Capitalised-development net book value as at any date → Intangible Assets.
  const capexMinutes: Record<number, number> = {};
  (capexTimes || []).forEach((t) => {
    const id = Number(t.entity_id);
    capexMinutes[id] = (capexMinutes[id] || 0) + Number(t.minutes || 0);
  });
  const defaultRate = Number(org?.default_hourly_rate ?? 1000);
  const intangiblesAsOf = (asOf: string) =>
    (capexProjects || []).reduce((sum, p) => {
      const hours = (capexMinutes[p.id] || 0) / 60;
      const c = computeCapex(
        { is_capex: true, amortisation_months: p.amortisation_months ?? null, hourly_rate_override: p.hourly_rate_override != null ? Number(p.hourly_rate_override) : null, finalized_at: p.finalized_at ?? null },
        hours, defaultRate, asOf
      );
      return sum + c.netBookValue;
    }, 0);

  const intangibleAssets = intangiblesAsOf(fyEnd);

  // ── AFS: auto figures per financial year ────────────────────────────────
  const fyStartMonth = Number(org?.fiscal_year_start ?? 3);
  const currentFinYear = fyStartMonth <= 1
    ? now.getFullYear()
    : (now.getMonth() + 1 >= fyStartMonth ? now.getFullYear() + 1 : now.getFullYear());
  const finYears = Array.from({ length: 6 }, (_, i) => currentFinYear - 5 + i);

  const invRows = (invoices || []).map(i => ({ amount: Number(i.amount || 0), status: i.status || "", transaction_date: i.transaction_date || "" }));
  const costRows = (costs || []).map(c => ({ amount: Number(c.amount || 0), transaction_date: c.transaction_date || "" }));
  const incRows = (income || []).map(r => ({ amount: Number(r.amount || 0), transaction_date: r.transaction_date || "" }));
  const cfRows = (cashflow || []).map(r => ({ balance: Number(r.balance || 0), account_id: r.account_id, record_date: r.record_date || "" }));

  const autoByYear: Record<number, AutoFigures> = {};
  for (const y of finYears) {
    const { start, end } = finYearRange(y, fyStartMonth);
    autoByYear[y] = computeAutoFigures({
      fyStart: start, fyEnd: end,
      invoices: invRows, costs: costRows, income: incRows, cashflow: cfRows,
      intangibles: intangiblesAsOf(end),
    });
  }

  const taxRate = Number((org?.feature_flags as Record<string, unknown> | null)?.tax_rate ?? DEFAULT_TAX_RATE);

  const currency = org?.currency || "ZAR";
  const cur = currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "R";

  return (
    <section>
      <AccountingClient
        invoices={(invoices || []).map(i => ({ id: i.id, amount: Number(i.amount || 0), status: i.status || "", transaction_date: i.transaction_date || "", customer_id: i.customer_id }))}
        costs={(costs || []).map(c => ({ id: c.id, amount: Number(c.amount || 0), transaction_date: c.transaction_date || "", cost_category_id: c.cost_category_id, category_name: (c.dim_cost_categories as unknown as { name: string } | null)?.name ?? "Other", cost_type: ((c as Record<string, unknown>).cost_type as string) ?? "operational", include_in_pnl: (c as Record<string, unknown>).include_in_pnl !== false }))}
        income={(income || []).map(r => ({ id: r.id, amount: Number(r.amount || 0), transaction_date: r.transaction_date || "", description: r.description ?? null, income_type: (r.income_type as string) ?? "other", account_id: r.account_id ?? null }))}
        cashflow={(cashflow || []).map(r => ({ id: r.id, balance: Number(r.balance || 0), account_id: r.account_id, record_date: r.record_date || "", notes: r.notes ?? null }))}
        accounts={(accounts || []).map(a => ({ id: a.id, name: a.name }))}
        afsLines={(afsLines || []).map(r => ({ id: r.id, fin_year: r.fin_year, statement: r.statement, section: r.section, line_key: r.line_key ?? null, label: r.label, amount: Number(r.amount || 0), is_custom: !!r.is_custom, sort: r.sort ?? 0, note: r.note ?? null }))}
        autoByYear={autoByYear}
        finYears={finYears}
        currentFinYear={currentFinYear}
        fiscalYearStart={fyStartMonth}
        taxRate={taxRate}
        orgName={org?.name || "Company"}
        orgRegNo={org?.reg_no || ""}
        orgVatNo={org?.vat_no || ""}
        orgAddress={org?.address || ""}
        currency={cur}
        intangibleAssets={intangibleAssets}
        defaultStart={fyStart}
        defaultEnd={fyEnd}
      />
    </section>
  );
}
