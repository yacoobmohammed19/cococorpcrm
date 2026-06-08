import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { OrgDetailClient } from "@/components/OrgDetailClient";

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = await params;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify caller is at least admin of this org
  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
    redirect("/settings/organisations");
  }

  const activeOrgId = await getCurrentOrgId();

  // Fetch org details
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, currency")
    .eq("id", orgId)
    .single();

  if (!org) notFound();

  // Fetch all members with their emails via admin client (auth.users not accessible via RLS)
  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("memberships")
    .select("user_id, role")
    .eq("org_id", orgId);

  const memberUserIds = (memberships ?? []).map(m => m.user_id);
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });

  const members = (memberships ?? []).map(m => {
    const authUser = authUsers.users.find(u => u.id === m.user_id);
    return {
      user_id: m.user_id,
      email: authUser?.email ?? m.user_id,
      role: m.role,
    };
  }).sort((a, b) => {
    const order = ["owner", "admin", "member", "viewer", "operator"];
    return order.indexOf(a.role) - order.indexOf(b.role);
  });

  // Fetch pending invites for this org
  const { data: invites } = await supabase
    .from("invite_tokens")
    .select("id, email, role, expires_at")
    .eq("org_id", orgId)
    .gt("expires_at", new Date().toISOString());

  void memberUserIds;

  return (
    <section className="space-y-6">
      <div>
        <Link
          href="/settings/organisations"
          className="inline-flex items-center gap-1.5 text-xs mb-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted2)" }}
        >
          <ChevronLeft size={13} />
          All Organisations
        </Link>
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wider font-bold" style={{ color: "var(--muted2)" }}>
            {org.currency}
          </p>
        </div>
      </div>

      <OrgDetailClient
        orgId={orgId}
        orgName={org.name}
        isActive={orgId === activeOrgId}
        callerRole={myMembership.role}
        currentUserId={user.id}
        members={members}
        invites={invites ?? []}
      />
    </section>
  );
}
