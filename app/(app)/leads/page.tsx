import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId, getCurrentOrgRole } from "@/lib/supabase/org";
import { resolveLeadStages } from "@/lib/lead-stages";
import { LeadsClient } from "@/components/LeadsClient";

export default async function LeadsPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();
  const currentRole = await getCurrentOrgRole();

  const [{ data: leads }, { data: statuses }, { data: customers }, { data: products }, { data: org }, { data: operatorMemberships }] = await Promise.all([
    supabase
      .from("fact_leads")
      .select("id, name, phone, contact, lead_date, status_id, last_follow_up, opportunity_value, opportunity_weighted, weight, total_revenue, secured_revenue, contacted, responded, developed, completed, customer_id, created_at, assigned_to")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("dim_statuses").select("id, name").eq("org_id", orgId).order("id"),
    supabase.from("dim_customers").select("id, name").eq("org_id", orgId).is("deleted_at", null).order("name"),
    supabase.from("dim_products").select("id, name, unit_price, is_active").eq("org_id", orgId).is("deleted_at", null).eq("is_active", true).order("name"),
    supabase.from("organizations").select("currency, feature_flags").eq("id", orgId).single(),
    supabase.from("memberships").select("user_id").eq("org_id", orgId).eq("role", "operator"),
  ]);

  // Resolve operator emails for the assignment dropdown (admin/owner only)
  let operators: { user_id: string; email: string }[] = [];
  if (["owner", "admin"].includes(currentRole ?? "") && (operatorMemberships?.length ?? 0) > 0) {
    const admin = createAdminClient();
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const operatorIds = new Set((operatorMemberships ?? []).map(m => String(m.user_id)));
    operators = (authData?.users ?? [])
      .filter(u => operatorIds.has(u.id))
      .map(u => ({ user_id: u.id, email: u.email ?? u.id }));
  }

  return (
    <section>
      <LeadsClient
        leads={(leads || []).map(l => ({ ...l, product_id: null, assigned_to: l.assigned_to ?? null }))}
        statuses={statuses || []}
        customers={customers || []}
        products={(products || []).map(p => ({ id: p.id, name: p.name, unit_price: Number(p.unit_price) }))}
        currency={org?.currency || "ZAR"}
        operators={operators}
        currentRole={currentRole ?? "member"}
        stages={resolveLeadStages(org?.feature_flags)}
      />
    </section>
  );
}
