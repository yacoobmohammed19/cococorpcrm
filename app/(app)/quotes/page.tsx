import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { QuotesClient } from "@/components/QuotesClient";

export default async function QuotesPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();
  const [{ data: quotes }, { data: customers }, { data: products }, { data: org }] = await Promise.all([
    supabase.from("fact_quotes").select("id, quote_number, customer_id, status, amount, valid_until, notes, created_at")
      .eq("org_id", orgId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("dim_customers").select("id, name").eq("org_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("dim_products").select("id, name, sku, unit_price, is_active").eq("org_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("organizations").select("currency").eq("id", orgId).single(),
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
