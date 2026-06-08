import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { ManagementClient } from "@/components/ManagementClient";

export default async function ManagementPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const activeOrgId = await getCurrentOrgId();

  // All orgs where caller is owner or admin
  const { data: adminMemberships } = await supabase
    .from("memberships")
    .select("role, org_id, organizations(id, name, currency)")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"]);

  if (!adminMemberships || adminMemberships.length === 0) {
    redirect("/settings");
  }

  const adminOrgIds = adminMemberships.map(m => m.org_id as string);

  // Get member counts for each org
  const admin = createAdminClient();
  const { data: allMemberships } = await admin
    .from("memberships")
    .select("org_id")
    .in("org_id", adminOrgIds);

  const countMap = new Map<string, number>();
  for (const m of allMemberships ?? []) {
    const key = String(m.org_id);
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const orgs = adminMemberships.map(m => {
    const org = Array.isArray(m.organizations)
      ? (m.organizations[0] as { id: string; name: string; currency: string })
      : (m.organizations as { id: string; name: string; currency: string } | null);
    const orgId = org?.id ?? "";
    return {
      id: orgId,
      name: org?.name ?? "Unnamed",
      currency: org?.currency ?? "ZAR",
      callerRole: m.role as string,
      memberCount: countMap.get(orgId) ?? 0,
      isActive: String(orgId) === String(activeOrgId),
    };
  }).filter(o => o.id).sort((a, b) => Number(b.isActive) - Number(a.isActive));

  return <ManagementClient orgs={orgs} />;
}
