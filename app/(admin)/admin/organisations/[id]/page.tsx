import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminOrgManager } from "@/components/admin/AdminOrgManager";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = await params;
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, currency")
    .eq("id", orgId)
    .single();
  if (!org) notFound();

  const [{ data: memberships }, usersRes] = await Promise.all([
    admin.from("memberships").select("user_id, role").eq("org_id", orgId),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const authUsers = usersRes.data?.users ?? [];
  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? u.id]));

  const roleOrder = ["owner", "admin", "member", "viewer", "operator"];
  const members = (memberships ?? [])
    .map((m) => ({
      user_id: m.user_id as string,
      email: emailById.get(m.user_id as string) ?? (m.user_id as string),
      role: m.role as string,
    }))
    .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || a.email.localeCompare(b.email));

  return (
    <div className="space-y-6">
      <Link
        href="/admin/organisations"
        className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
        style={{ color: "var(--muted2)" }}
      >
        <ChevronLeft size={14} />
        All organisations
      </Link>

      <AdminOrgManager
        orgId={String(org.id)}
        orgName={org.name as string}
        currency={(org.currency as string) ?? "ZAR"}
        members={members}
      />
    </div>
  );
}
