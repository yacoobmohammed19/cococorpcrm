import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateOrgForm } from "@/components/admin/CreateOrgForm";

export const dynamic = "force-dynamic";

export default async function AdminOrganisationsPage() {
  const admin = createAdminClient();

  const [{ data: orgs }, { data: memberships }] = await Promise.all([
    admin.from("organizations").select("id, name, currency").order("name"),
    admin.from("memberships").select("org_id"),
  ]);

  const countByOrg = new Map<string, number>();
  for (const m of memberships ?? []) {
    const key = String(m.org_id);
    countByOrg.set(key, (countByOrg.get(key) ?? 0) + 1);
  }

  const orgList = (orgs ?? []).map((o) => ({
    id: String(o.id),
    name: o.name as string,
    currency: (o.currency as string) ?? "ZAR",
    members: countByOrg.get(String(o.id)) ?? 0,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Organisations</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted2)" }}>
          Provision new organisations and manage the ones you already run.
        </p>
      </div>

      <CreateOrgForm />

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>
          All organisations ({orgList.length})
        </h2>
        {orgList.length === 0 ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: "var(--card)", border: "1px dashed var(--border2)" }}>
            <p className="text-sm font-medium">Nothing here yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Create your first organisation above.</p>
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
                  <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted2)" }}>
                    {org.currency} <span>·</span> <Users size={11} /> {org.members}
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
