import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId, getCurrentOrgRole } from "@/lib/supabase/org";
import { Building2, ChevronRight } from "lucide-react";

export default async function OrganisationsPage() {
  const role = await getCurrentOrgRole();
  if (!role || !["owner", "admin"].includes(role)) redirect("/settings");

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const activeOrgId = await getCurrentOrgId();

  // All orgs the current user belongs to
  const { data: memberships } = await supabase
    .from("memberships")
    .select("role, organizations(id, name, currency)")
    .eq("user_id", user.id);

  const orgs = (memberships ?? []).map(m => {
    const org = Array.isArray(m.organizations)
      ? (m.organizations[0] as { id: string; name: string; currency: string })
      : (m.organizations as { id: string; name: string; currency: string } | null);
    return {
      id: org?.id ?? "",
      name: org?.name ?? "Unnamed",
      currency: org?.currency ?? "ZAR",
      role: m.role,
      isActive: org?.id === activeOrgId,
    };
  }).filter(o => o.id);

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Organisations</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Manage your organisations or create a new one
        </p>
      </div>

      {/* Org list */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>
          Your Organisations ({orgs.length})
        </h2>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {orgs.map((org, i) => (
            <div
              key={org.id}
              className="flex items-center gap-4 px-4 py-3"
              style={{
                background: i % 2 === 0 ? "var(--card)" : "var(--card2)",
                borderBottom: i < orgs.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: org.isActive ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.06)" }}
              >
                <Building2 size={16} style={{ color: org.isActive ? "var(--accent)" : "var(--muted2)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{org.name}</p>
                  {org.isActive && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(236,72,153,0.15)", color: "var(--accent)" }}
                    >
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs capitalize" style={{ color: "var(--muted2)" }}>
                  {org.role} · {org.currency}
                </p>
              </div>
              {["owner", "admin"].includes(org.role) && (
                <Link
                  href={`/settings/organisations/${org.id}`}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 transition-opacity hover:opacity-70"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  Manage
                  <ChevronRight size={12} />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--muted2)" }}>
        Need a new organisation? Organisations are provisioned by your CocoCorp administrator.
      </p>
    </section>
  );
}
