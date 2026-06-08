import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId, getCurrentOrgRole } from "@/lib/supabase/org";
import { TeamClient } from "@/components/TeamClient";

export default async function TeamPage() {
  const role = await getCurrentOrgRole();
  if (!role || !["owner", "admin"].includes(role)) redirect("/settings");

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await getCurrentOrgId();
  const admin = createAdminClient();

  const [{ data: memberships }, { data: invites }, authResult, { data: allMyMemberships }] = await Promise.all([
    supabase.from("memberships").select("user_id, role").eq("org_id", orgId),
    supabase
      .from("invite_tokens")
      .select("id, email, role, expires_at")
      .eq("org_id", orgId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("memberships").select("org_id, role").eq("user_id", user.id).in("role", ["owner", "admin"]),
  ]);

  // Map user_id → email using admin auth list
  const userEmailMap = new Map(
    (authResult.data?.users ?? []).map(u => [u.id, u.email ?? ""])
  );

  const members = (memberships ?? []).map(m => ({
    user_id: String(m.user_id),
    role: m.role,
    email: userEmailMap.get(String(m.user_id)) ?? "Unknown",
  }));

  // Sort: owner first, then admin, then others alphabetically
  const roleOrder = ["owner", "admin", "member", "viewer", "operator"];
  members.sort((a, b) => {
    const ri = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    if (ri !== 0) return ri;
    return a.email.localeCompare(b.email);
  });

  // Other orgs the current user can administer (for multi-org user assignment)
  const otherAdminOrgIds = (allMyMemberships ?? [])
    .filter(m => String(m.org_id) !== String(orgId))
    .map(m => ({ id: String(m.org_id), role: m.role }));
  let adminOrgs: { id: string; name: string; role: string }[] = [];
  if (otherAdminOrgIds.length > 0) {
    const { data: orgNames } = await supabase
      .from("organizations")
      .select("id, name")
      .in("id", otherAdminOrgIds.map(o => o.id));
    adminOrgs = (orgNames ?? []).map(o => ({
      id: String(o.id),
      name: o.name,
      role: otherAdminOrgIds.find(x => x.id === String(o.id))?.role ?? "admin",
    }));
  }

  return (
    <section className="p-4 md:p-0">
      <TeamClient
        members={members}
        invites={invites ?? []}
        currentUserId={user.id}
        currentRole={role}
        adminOrgs={adminOrgs}
      />
    </section>
  );
}
