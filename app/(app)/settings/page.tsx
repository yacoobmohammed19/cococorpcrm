import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { SettingsShell } from "@/components/SettingsShell";

export default async function SettingsPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: org }, { data: statuses }, { data: payTypes }, { data: costCats }, { data: accounts }] = await Promise.all([
    supabase.from("organizations").select("name, reg_no, vat_no, address, phone, email, bank_holder, bank_name, bank_account, bank_branch, currency, fiscal_year_start, logo_url, feature_flags").eq("id", orgId).single(),
    supabase.from("dim_statuses").select("id, name, category").order("id"),
    supabase.from("dim_payment_types").select("id, name, description").order("id"),
    supabase.from("dim_cost_categories").select("id, name, description").order("id"),
    supabase.from("dim_accounts").select("id, name, account_type").order("id"),
  ]);

  return (
    <SettingsShell
      org={org}
      orgId={orgId}
      statuses={statuses || []}
      payTypes={payTypes || []}
      costCats={costCats || []}
      accounts={accounts || []}
    />
  );
}
