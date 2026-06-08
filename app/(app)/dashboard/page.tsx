import { createServerClient } from "@/lib/supabase/server";
import { DashboardCharts } from "@/components/DashboardCharts";

export default async function DashboardPage() {
  const supabase = await createServerClient();

  const [
    { data: leads },
    { data: invoices },
    { data: costs },
    { data: cashflow },
    { data: customers },
    { data: statuses },
    { data: paymentTypes },
    { data: costCategories },
    { data: accounts },
    { data: org },
  ] = await Promise.all([
    supabase.from("fact_leads").select("id, name, status_id, lead_date, opportunity_value, opportunity_weighted, weight, last_follow_up, contacted, responded, developed, completed, created_at, total_revenue").is("deleted_at", null),
    supabase.from("fact_invoices").select("id, amount, status, transaction_date, customer_id, payment_type_id, due_date").is("deleted_at", null),
    supabase.from("fact_costs").select("id, amount, transaction_date, cost_category_id, include_in_pnl").is("deleted_at", null),
    supabase.from("fact_cashflow").select("id, balance, record_date, account_id").order("record_date", { ascending: false }),
    supabase.from("dim_customers").select("id, name").is("deleted_at", null),
    supabase.from("dim_statuses").select("id, name").order("id"),
    supabase.from("dim_payment_types").select("id, name"),
    supabase.from("dim_cost_categories").select("id, name"),
    supabase.from("dim_accounts").select("id, name"),
    supabase.from("organizations").select("currency, name, fiscal_year_start, dashboard_settings").single(),
  ]);

  // Bank balance: sum latest snapshot per account
  const cfData = cashflow || [];
  const latestByAcct: Record<string, { balance: number; record_date: string }> = {};
  for (const entry of cfData) {
    const key = String((entry as { account_id?: number | null }).account_id ?? "unassigned");
    const existing = latestByAcct[key];
    if (!existing || entry.record_date > existing.record_date) {
      latestByAcct[key] = { balance: Number(entry.balance), record_date: entry.record_date };
    }
  }
  const acctValues = Object.values(latestByAcct);
  const bankBalance = acctValues.length > 0 ? acctValues.reduce((s, e) => s + e.balance, 0) : 0;
  const bankLastDate: string | null = acctValues.length > 0
    ? acctValues.map(e => e.record_date).sort().reverse()[0]
    : null;

  return (
    <section>
      <DashboardCharts
        rawLeads={leads || []}
        rawInvoices={invoices || []}
        rawCosts={costs || []}
        rawCashflow={cashflow || []}
        customers={customers || []}
        statuses={statuses || []}
        paymentTypes={paymentTypes || []}
        costCategories={costCategories || []}
        accounts={accounts || []}
        currency={org?.currency || "ZAR"}
        orgName={org?.name || "CocoCRM"}
        bankBalance={bankBalance}
        bankLastDate={bankLastDate}
        fiscalYearStart={org?.fiscal_year_start ?? 3}
        savedDashboardSettings={(org?.dashboard_settings as Record<string, unknown>) ?? {}}
      />
    </section>
  );
}
