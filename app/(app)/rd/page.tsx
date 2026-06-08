import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId, getCurrentOrgRole } from "@/lib/supabase/org";
import { RdClient } from "@/components/RdClient";

export default async function RdPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();
  const currentRole = await getCurrentOrgRole();

  const [
    { data: statuses },
    { data: projects },
    { data: org },
    { data: memberMemberships },
  ] = await Promise.all([
    supabase.from("rd_statuses").select("*").eq("org_id", orgId).order("position"),
    supabase.from("rd_projects").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("organizations").select("currency").single(),
    supabase.from("memberships").select("user_id").eq("org_id", orgId),
  ]);

  // Resolve member emails for assignment dropdown
  let members: { user_id: string; email: string }[] = [];
  if ((memberMemberships?.length ?? 0) > 0) {
    try {
      const admin = createAdminClient();
      const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const memberIds = new Set((memberMemberships ?? []).map(m => String(m.user_id)));
      members = (authData?.users ?? [])
        .filter(u => memberIds.has(u.id))
        .map(u => ({ user_id: u.id, email: u.email ?? u.id }));
    } catch {
      members = [];
    }
  }

  return (
    <section>
      <RdClient
        statuses={statuses || []}
        projects={projects || []}
        members={members}
        currency={org?.currency || "ZAR"}
        currentRole={currentRole ?? "member"}
      />
    </section>
  );
}
