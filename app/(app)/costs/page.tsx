import { createServerClient } from "@/lib/supabase/server";
import { CostsClient } from "@/components/CostsClient";

export default async function CostsPage() {
  const supabase = await createServerClient();

  const [{ data: costs }, { data: categories }, { data: accounts }, { data: customers }, { data: org }] = await Promise.all([
    supabase
      .from("fact_costs")
      .select("id, transaction_date, cost_details, amount, recouped, cost_category_id, account_id, customer_id, dim_cost_categories(name), dim_accounts(name), dim_customers(name)")
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false }),
    supabase.from("dim_cost_categories").select("id, name").order("name"),
    supabase.from("dim_accounts").select("id, name").order("name"),
    supabase.from("dim_customers").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("organizations").select("currency").single(),
  ]);

  const mappedCosts = (costs || []).map(c => ({
    id: c.id,
    transaction_date: c.transaction_date || "",
    cost_details: (c as Record<string, unknown>).cost_details as string | null ?? null,
    category_name: (c.dim_cost_categories as unknown as { name: string } | null)?.name ?? null,
    amount: Number(c.amount || 0),
    account_name: (c.dim_accounts as unknown as { name: string } | null)?.name ?? null,
    recouped: (c as Record<string, unknown>).recouped as string | null ?? null,
    cost_category_id: c.cost_category_id ?? null,
    account_id: c.account_id ?? null,
    customer_id: (c as Record<string, unknown>).customer_id as number | null ?? null,
    customer_name: (c.dim_customers as unknown as { name: string } | null)?.name ?? null,
  }));

  return (
    <section>
      <CostsClient
        costs={mappedCosts}
        categories={categories || []}
        accounts={accounts || []}
        customers={customers || []}
        currency={org?.currency || "ZAR"}
      />
    </section>
  );
}
