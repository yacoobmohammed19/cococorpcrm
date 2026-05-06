import { createServerClient } from "@/lib/supabase/server";
import { ProductsClient } from "@/components/ProductsClient";

export default async function ProductsPage() {
  const supabase = await createServerClient();
  const [{ data: products }, { data: org }] = await Promise.all([
    supabase.from("dim_products").select("id, name, sku, description, unit_price, category, is_active, created_at, location")
      .is("deleted_at", null).order("name"),
    supabase.from("organizations").select("currency").single(),
  ]);

  const currency = org?.currency || "ZAR";

  return (
    <section>
      <ProductsClient products={products || []} currency={currency} />
    </section>
  );
}
