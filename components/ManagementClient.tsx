"use client";

import Link from "next/link";
import { Building2, Users, Plus, ChevronRight, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { createOrganization, deleteOrganization } from "@/server-actions/auth";
import { useOptimisticList } from "@/hooks/useOptimisticList";
import { setActiveOrganization } from "@/server-actions/auth";

type ManagedOrg = {
  id: string;
  name: string;
  currency: string;
  callerRole: string;
  memberCount: number;
  isActive: boolean;
};

type Props = {
  orgs: ManagedOrg[];
};

const ORG_COLORS = [
  "#EC4899", "#8B5CF6", "#F59E0B", "#3B82F6", "#EC4899", "#EF4444", "#06B6D4",
];

const inputCss = {
  background: "var(--card2)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as React.CSSProperties;

function orgInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?";
}

export function ManagementClient({ orgs: initialOrgs }: Props) {
  const toast = useToast();
  const { items: orgs, remove } = useOptimisticList(initialOrgs, toast);

  async function handleDelete(org: ManagedOrg) {
    if (!confirm(`Delete "${org.name}"? This will permanently remove all its data including invoices, customers, and leads. This cannot be undone.`)) return;
    void remove(org.id, () => deleteOrganization(org.id), { success: "Organisation deleted" });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Management</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Create and manage your organisations
        </p>
      </div>

      {/* Org list */}
      {orgs.length > 0 && (
        <div className="space-y-3">
          {orgs.map((org, i) => {
            const color = ORG_COLORS[i % ORG_COLORS.length];
            return (
              <div
                key={org.id}
                className="rounded-xl p-4 flex items-center gap-4"
                style={{
                  background: "var(--card2)",
                  border: `1px solid ${org.isActive ? "rgba(236,72,153,0.35)" : "var(--border)"}`,
                  boxShadow: org.isActive ? "0 0 0 1px rgba(236,72,153,0.1)" : undefined,
                }}
              >
                {/* Initials */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0 select-none"
                  style={{ background: `${color}22`, color }}
                >
                  {orgInitials(org.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{org.name}</p>
                    {org.isActive && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(236,72,153,0.15)", color: "var(--accent)" }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--muted2)" }}>
                    <span className="capitalize">{org.callerRole}</span>
                    <span>·</span>
                    <span>{org.currency}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Users size={10} />{org.memberCount}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {!org.isActive && (
                    <form action={setActiveOrganization}>
                      <input type="hidden" name="org_id" value={org.id} />
                      <button
                        type="submit"
                        className="text-xs px-2.5 py-1.5 rounded-lg border transition-opacity hover:opacity-75"
                        style={{ borderColor: "var(--border)", color: "var(--muted2)" }}
                        title="Switch to this org"
                      >
                        Switch
                      </button>
                    </form>
                  )}
                  <Link
                    href={`/settings/organisations/${org.id}`}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-75"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  >
                    Manage
                    <ChevronRight size={12} />
                  </Link>
                  {org.callerRole === "owner" && (
                    <button
                      onClick={() => handleDelete(org)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                      style={{ color: "var(--red-c)" }}
                      title="Delete organisation"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create new org */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(236,72,153,0.1)" }}
          >
            <Plus size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold">New Organisation</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Each org has isolated data, its own users, and separate billing
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
                style={inputCss}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
                Currency
              </label>
              <select name="currency" defaultValue="ZAR" className="w-full rounded-lg border text-sm px-3 py-2 outline-none" style={inputCss}>
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

      {/* Nav hint */}
      <p className="text-xs pb-2" style={{ color: "var(--muted2)" }}>
        Click <strong>Manage</strong> on any org to add users, set roles, create user accounts, or send invites.
      </p>
    </div>
  );
}
