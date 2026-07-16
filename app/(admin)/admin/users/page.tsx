import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ROLE_COLORS: Record<string, string> = {
  owner: "var(--accent)", admin: "var(--purple-c)", member: "var(--amber-c)",
  viewer: "var(--muted2)", operator: "var(--pink)",
};

export default async function AdminUsersPage() {
  const admin = createAdminClient();

  const [usersRes, { data: memberships }, { data: orgs }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("memberships").select("user_id, org_id, role"),
    admin.from("organizations").select("id, name"),
  ]);

  const orgName = new Map((orgs ?? []).map((o) => [String(o.id), o.name as string]));

  const membershipsByUser = new Map<string, { org: string; orgId: string; role: string }[]>();
  for (const m of memberships ?? []) {
    const list = membershipsByUser.get(m.user_id as string) ?? [];
    list.push({
      org: orgName.get(String(m.org_id)) ?? "Unknown",
      orgId: String(m.org_id),
      role: m.role as string,
    });
    membershipsByUser.set(m.user_id as string, list);
  }

  const users = (usersRes.data?.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? u.id,
      orgs: membershipsByUser.get(u.id) ?? [],
      lastSignIn: u.last_sign_in_at,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted2)" }}>
          Every account on the platform and the organisations they belong to.
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div
          className="hidden sm:grid grid-cols-[1.4fr_2fr_0.8fr] gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: "var(--card2)", color: "var(--muted2)", borderBottom: "1px solid var(--border)" }}
        >
          <span>User</span>
          <span>Organisations</span>
          <span>Last sign-in</span>
        </div>

        {users.map((u, i) => (
          <div
            key={u.id}
            className="grid grid-cols-1 sm:grid-cols-[1.4fr_2fr_0.8fr] gap-2 sm:gap-3 sm:items-center px-4 py-3"
            style={{
              background: i % 2 === 0 ? "var(--card)" : "var(--card2)",
              borderBottom: i < users.length - 1 ? "1px solid var(--border)" : undefined,
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
              >
                {u.email.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-sm font-medium truncate">{u.email}</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {u.orgs.length === 0 ? (
                <span className="text-xs" style={{ color: "var(--muted2)" }}>No organisation</span>
              ) : (
                u.orgs.map((o) => (
                  <Link
                    key={o.orgId}
                    href={`/admin/organisations/${o.orgId}`}
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full transition-opacity hover:opacity-75"
                    style={{ background: "var(--card3)", color: "var(--foreground)" }}
                  >
                    {o.org}
                    <span
                      className="font-bold uppercase text-[9px] tracking-wide"
                      style={{ color: ROLE_COLORS[o.role] ?? "var(--muted2)" }}
                    >
                      {o.role}
                    </span>
                  </Link>
                ))
              )}
            </div>

            <span className="text-xs" style={{ color: "var(--muted2)" }}>
              {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "Never"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
