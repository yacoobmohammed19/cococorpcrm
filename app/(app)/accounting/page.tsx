import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { AccountingClient } from "@/components/AccountingClient";

export default async function AccountingPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const now = new Date();
  const fyStart = `${now.getFullYear()}-01-01`;
  const fyEnd = now.toISOString().slice(0, 10);

  const [{ data: invoices }, { data: costs }, { data: cashflow }, { data: org }, { data: accounts }] = await Promise.all([
    supabase.from("fact_invoices").select("id, amount, status, transaction_date, customer_id").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_costs").select("id, amount, transaction_date, cost_category_id, cost_type, include_in_pnl, dim_cost_categories(name)").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_cashflow").select("id, balance, account_id, record_date, notes").eq("org_id", orgId).order("record_date", { ascending: false }),
    supabase.from("organizations").select("currency, name, reg_no").eq("id", orgId).single(),
    supabase.from("dim_accounts").select("id, name").eq("org_id", orgId).order("name"),
  ]);

  const currency = org?.currency || "ZAR";
  const cur = currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "R";

  return (
    <section>
      <AccountingClient
        invoices={(invoices || []).map(i => ({ id: i.id, amount: Number(i.amount || 0), status: i.status || "", transaction_date: i.transaction_date || "", customer_id: i.customer_id }))}
        costs={(costs || []).map(c => ({ id: c.id, amount: Number(c.amount || 0), transaction_date: c.transaction_date || "", cost_category_id: c.cost_category_id, category_name: (c.dim_cost_categories as unknown as { name: string } | null)?.name ?? "Other", cost_type: ((c as Record<string, unknown>).cost_type as string) ?? "operational", include_in_pnl: (c as Record<string, unknown>).include_in_pnl !== false }))}
        cashflow={(cashflow || []).map(r => ({ id: r.id, balance: Number(r.balance || 0), account_id: r.account_id, record_date: r.record_date || "", notes: r.notes ?? null }))}
        accounts={(accounts || []).map(a => ({ id: a.id, name: a.name }))}
        orgName={org?.name || "Company"}
        orgRegNo={org?.reg_no || ""}
        currency={cur}
        defaultStart={fyStart}
        defaultEnd={fyEnd}
      />
    </section>
  );
}
