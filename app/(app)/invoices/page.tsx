import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { InvoicesClient } from "@/components/InvoicesClient";

export default async function InvoicesPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: invoices }, { data: customers }, { data: payTypes }, { data: products }, { data: org }] = await Promise.all([
    supabase
      .from("fact_invoices")
      .select("id, invoice_number, amount, status, transaction_date, due_date, customer_id, description, payment_type_id, dim_payment_types(name)")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false }),
    supabase.from("dim_customers").select("id, name").eq("org_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("dim_payment_types").select("id, name").eq("org_id", orgId).order("name"),
    supabase.from("dim_products").select("id, name, unit_price, sku, is_active").eq("org_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("organizations").select("currency").eq("id", orgId).single(),
  ]);

  const mappedInvoices = (invoices || []).map(inv => ({
    id: inv.id,
    invoice_number: inv.invoice_number ?? null,
    amount: Number(inv.amount || 0),
    status: inv.status || "Pending",
    transaction_date: inv.transaction_date ?? null,
    due_date: (inv as Record<string, unknown>).due_date as string | null ?? null,
    customer_id: inv.customer_id,
    description: (inv as Record<string, unknown>).description as string | null ?? null,
    payment_type_name: (inv.dim_payment_types as unknown as { name: string } | null)?.name ?? null,
  }));

  return (
    <section>
      <InvoicesClient
        invoices={mappedInvoices}
        customers={customers || []}
        paymentTypes={payTypes || []}
        products={(products || []).map(p => ({ id: p.id, name: p.name, unit_price: Number(p.unit_price), sku: p.sku ?? null, is_active: p.is_active ?? true }))}
        currency={org?.currency || "ZAR"}
      />
    </section>
  );
}
