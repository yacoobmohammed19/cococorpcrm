import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { BillingClient } from "@/components/BillingClient";

export default async function BillingPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: invoices }, { data: customers }, { data: costs }, { data: org }, { data: invoiceStatuses }] = await Promise.all([
    supabase
      .from("fact_invoices")
      .select("id, customer_id, transaction_date, invoice_number, amount, status, description, payment_type_id, dim_payment_types(name)")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false }),
    supabase.from("dim_customers").select("id, name").eq("org_id", orgId).is("deleted_at", null).order("name"),
    supabase
      .from("fact_costs")
      .select("id, amount, transaction_date, include_in_pnl")
      .eq("org_id", orgId)
      .is("deleted_at", null),
    supabase.from("organizations").select("currency, fiscal_year_start").eq("id", orgId).single(),
    supabase.from("dim_invoice_statuses").select("id, name, color").eq("org_id", orgId).order("position"),
  ]);

  const fiscalStart = org?.fiscal_year_start ?? 3;
  const now = new Date();
  const fyMonth = fiscalStart - 1;
  const fyYear = now.getMonth() >= fyMonth ? now.getFullYear() : now.getFullYear() - 1;
  const fiscalYearFrom = `${fyYear}-${String(fiscalStart).padStart(2, "0")}`;

  const mappedInvoices = (invoices || []).map(inv => ({
    id: inv.id,
    customer_id: inv.customer_id,
    transaction_date: inv.transaction_date || "",
    invoice_number: inv.invoice_number || "",
    amount: Number(inv.amount || 0),
    status: inv.status || "Pending",
    description: (inv as Record<string, unknown>).description as string | null ?? null,
    payment_type_name: (inv.dim_payment_types as unknown as { name: string } | null)?.name ?? null,
  }));

  const mappedCosts = (costs || []).map(c => ({
    id: c.id,
    amount: Number(c.amount || 0),
    transaction_date: c.transaction_date || "",
    include_in_pnl: (c as Record<string, unknown>).include_in_pnl !== false,
  }));

  return (
    <section>
      <BillingClient
        invoices={mappedInvoices}
        customers={customers || []}
        costs={mappedCosts}
        currency={org?.currency || "ZAR"}
        fiscalYearFrom={fiscalYearFrom}
        invoiceStatuses={invoiceStatuses || []}
      />
    </section>
  );
}
