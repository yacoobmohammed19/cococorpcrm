import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { ProductsClient } from "@/components/ProductsClient";

export default async function ProductsPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();
  const [{ data: products }, { data: org }] = await Promise.all([
    supabase.from("dim_products").select("id, name, sku, description, unit_price, category, is_active, created_at, location")
      .eq("org_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("organizations").select("currency").eq("id", orgId).single(),
  ]);

  const currency = org?.currency || "ZAR";

  return (
    <section>
      <ProductsClient products={products || []} currency={currency} />
    </section>
  );
}
