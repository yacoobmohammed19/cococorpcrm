import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { getCachedDimensions, getCachedOrgMeta } from "@/lib/supabase/cache";
import { ReportBuilder } from "@/components/ReportBuilder";

export default async function ReportsPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [
    { data: leads },
    { data: invoices },
    { data: costs },
    { data: cashflow },
    dims,
    orgMeta,
  ] = await Promise.all([
    supabase.from("fact_leads").select("id, name, status_id, lead_date, opportunity_value, opportunity_weighted, weight, total_revenue").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_invoices").select("id, amount, status, transaction_date, customer_id, payment_type_id").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_costs").select("id, amount, transaction_date, cost_category_id, include_in_pnl").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_cashflow").select("id, balance, record_date, account_id").eq("org_id", orgId).order("record_date", { ascending: false }),
    getCachedDimensions(orgId),
    getCachedOrgMeta(orgId),
  ]);

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
          Slice and dice your fact data — group, aggregate, and visualise across any dimension
        </p>
      </div>
      <ReportBuilder
        rawInvoices={invoices || []}
        rawLeads={leads || []}
        rawCosts={costs || []}
        rawCashflow={cashflow || []}
        customers={dims.customers}
        statuses={dims.statuses}
        paymentTypes={dims.paymentTypes}
        costCategories={dims.costCategories}
        accounts={dims.accounts}
        currency={orgMeta?.currency || "ZAR"}
      />
    </section>
  );
}
