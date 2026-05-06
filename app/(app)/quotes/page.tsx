import { createServerClient } from "@/lib/supabase/server";
import { QuotesClient } from "@/components/QuotesClient";

export default async function QuotesPage() {
  const supabase = await createServerClient();
  const [{ data: quotes }, { data: customers }, { data: products }, { data: org }] = await Promise.all([
    supabase.from("fact_quotes").select("id, quote_number, customer_id, status, amount, valid_until, notes, created_at")
      .is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("dim_customers").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("dim_products").select("id, name, sku, unit_price, is_active").is("deleted_at", null).order("name"),
    supabase.from("organizations").select("currency").single(),
  ]);

  const currency = org?.currency || "ZAR";

  return (
    <section>
      <QuotesClient
        quotes={quotes || []}
        customers={customers || []}
        products={(products || []).map(p => ({ ...p, sku: p.sku ?? null }))}
        currency={currency}
      />
    </section>
  );
}
