import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId, getCurrentOrgRole } from "@/lib/supabase/org";
import { createOrganization } from "@/server-actions/auth";
import { Building2, Plus } from "lucide-react";

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
                style={{ background: org.isActive ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)" }}
              >
                <Building2 size={16} style={{ color: org.isActive ? "var(--accent)" : "var(--muted2)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{org.name}</p>
                  {org.isActive && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(16,185,129,0.15)", color: "var(--accent)" }}
                    >
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs capitalize" style={{ color: "var(--muted2)" }}>
                  {org.role} · {org.currency}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create new org */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.1)" }}
          >
            <Plus size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold">Create New Organisation</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Each organisation has its own isolated data, team, and billing
            </p>
          </div>
        </div>

        <form action={createOrganization} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
                Organisation name *
              </label>
              <input
                name="name"
                required
                placeholder="e.g. Acme Corp"
                className="w-full rounded-lg border text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)]"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
                Currency
              </label>
              <select
                name="currency"
                defaultValue="ZAR"
                className="w-full rounded-lg border text-sm px-3 py-2 outline-none"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <option value="ZAR">ZAR — South African Rand</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="AUD">AUD — Australian Dollar</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity active:opacity-80"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Create Organisation
          </button>
        </form>
      </div>
    </section>
  );
}
