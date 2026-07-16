import Link from "next/link";
import { Building2, Users, UserCog, ChevronRight, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const admin = createAdminClient();

  const [{ data: orgs }, { data: memberships }, usersRes] = await Promise.all([
    admin.from("organizations").select("id, name, currency").order("name"),
    admin.from("memberships").select("org_id, user_id, role"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const totalUsers = usersRes.data?.users.length ?? 0;
  const memberList = memberships ?? [];

  const countByOrg = new Map<string, number>();
  for (const m of memberList) {
    const key = String(m.org_id);
    countByOrg.set(key, (countByOrg.get(key) ?? 0) + 1);
  }
  const usersWithoutOrg = totalUsers - new Set(memberList.map((m) => m.user_id)).size;

  const orgList = (orgs ?? []).map((o) => ({
    id: String(o.id),
    name: o.name as string,
    currency: (o.currency as string) ?? "ZAR",
    members: countByOrg.get(String(o.id)) ?? 0,
  }));

  const stats = [
    { label: "Organisations", value: orgList.length, Icon: Building2, color: "var(--accent)" },
    { label: "Users", value: totalUsers, Icon: Users, color: "var(--blue-c)" },
    { label: "Unassigned users", value: usersWithoutOrg, Icon: UserCog, color: "var(--amber-c)" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Platform overview</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted2)" }}>
            Every organisation and user across CocoCorp.
          </p>
        </div>
        <Link
          href="/admin/organisations"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-transform active:scale-95"
          style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 8px 24px var(--accent-glow)" }}
        >
          <Plus size={16} />
          New organisation
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
            >
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{value}</p>
              <p className="text-xs mt-1.5" style={{ color: "var(--muted2)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Org list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
            Organisations
          </h2>
          <Link href="/admin/organisations" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            Manage all →
          </Link>
        </div>

        {orgList.length === 0 ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: "var(--card)", border: "1px dashed var(--border2)" }}>
            <p className="text-sm font-medium">No organisations yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>
              Create the first one to start onboarding customers.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {orgList.map((org, i) => (
              <Link
                key={org.id}
                href={`/admin/organisations/${org.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--card2)]"
                style={{
                  background: i % 2 === 0 ? "var(--card)" : "var(--card2)",
                  borderBottom: i < orgList.length - 1 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black"
                  style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                >
                  {org.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{org.name}</p>
                  <p className="text-xs" style={{ color: "var(--muted2)" }}>
                    {org.currency} · {org.members} {org.members === 1 ? "member" : "members"}
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: "var(--muted2)" }} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
