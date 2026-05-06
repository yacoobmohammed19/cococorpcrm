import { createServerClient } from "@/lib/supabase/server";
import { BillingClient } from "@/components/BillingClient";

export default async function BillingPage() {
  const supabase = await createServerClient();

  const [{ data: invoices }, { data: customers }, { data: org }] = await Promise.all([
    supabase
      .from("fact_invoices")
      .select("id, customer_id, transaction_date, invoice_number, amount, status, description, payment_type_id, dim_payment_types(name)")
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false }),
    supabase.from("dim_customers").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("organizations").select("currency, fiscal_year_start").single(),
  ]);

  const fiscalStart = org?.fiscal_year_start ?? 3;
  const now = new Date();
  const fyMonth = fiscalStart - 1; // 0-indexed
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

  return (
    <section>
      <BillingClient
        invoices={mappedInvoices}
        customers={customers || []}
        currency={org?.currency || "ZAR"}
        fiscalYearFrom={fiscalYearFrom}
      />
    </section>
  );
}
