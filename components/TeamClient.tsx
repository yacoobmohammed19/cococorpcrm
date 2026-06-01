"use client";

import { useState, useTransition } from "react";
import { UserPlus, Trash2, RefreshCw, Mail, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/Toast";
import { inviteUser, revokeInvite, removeMember, updateMemberRole } from "@/server-actions/invites";
import { runAction } from "@/lib/action-utils";

type Member = { user_id: string; email: string; role: string };
type Invite = { id: string; email: string; role: string; expires_at: string };

type Props = {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
  currentRole: string;
};

const ROLES = ["admin", "member", "viewer", "operator"] as const;
const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer", operator: "Operator",
};
const ROLE_COLORS: Record<string, string> = {
  owner: "var(--accent)", admin: "var(--purple-c)", member: "var(--amber-c)",
  viewer: "var(--muted2)", operator: "var(--pink)",
};

const inputCss = {
  background: "var(--card2)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as React.CSSProperties;

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={{ background: `color-mix(in srgb, ${ROLE_COLORS[role] ?? "var(--muted2)"} 15%, transparent)`, color: ROLE_COLORS[role] ?? "var(--muted2)" }}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export function TeamClient({ members, invites, currentUserId, currentRole }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const isAdmin = ["owner", "admin"].includes(currentRole);

  async function handleInvite(formData: FormData) {
    const ok = await runAction(() => inviteUser(formData), toast, "Invite sent!");
    if (ok) setShowInviteForm(false);
  }

  async function handleRevoke(tokenId: string) {
    await runAction(() => revokeInvite(tokenId), toast, "Invite revoked");
  }

  async function handleRemove(userId: string, email: string) {
    if (!confirm(`Remove ${email} from this organisation?`)) return;
    await runAction(() => removeMember(userId), toast, "Member removed");
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await runAction(() => updateMemberRole(userId, newRole), toast, "Role updated");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Team</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Manage who has access to this organisation
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInviteForm(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity active:opacity-80"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <UserPlus size={15} />
            Invite
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInviteForm && isAdmin && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold">Invite a new team member</p>
          <form action={handleInvite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
                  Email address
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="w-full rounded-lg border text-sm px-3 py-2 outline-none"
                  style={inputCss}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
                  Role
                </label>
                <select name="role" className="w-full rounded-lg border text-sm px-3 py-2 outline-none" style={inputCss}>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowInviteForm(false)}
                className="flex-1 py-2 text-sm rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                Cancel
              </button>
              <button type="submit" disabled={pending}
                className="flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2"
                style={{ background: "var(--accent)", color: "#fff", opacity: pending ? .6 : 1 }}>
                <Mail size={14} />
                Send invite
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role legend */}
      <div
        className="rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs"
        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <RoleBadge role="owner" />
          <span style={{ color: "var(--muted)" }}>Full access + billing</span>
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role="admin" />
          <span style={{ color: "var(--muted)" }}>Full access</span>
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role="member" />
          <span style={{ color: "var(--muted)" }}>Read + write, no delete</span>
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role="viewer" />
          <span style={{ color: "var(--muted)" }}>Read only</span>
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role="operator" />
          <span style={{ color: "var(--muted)" }}>Leads only (own)</span>
        </div>
      </div>

      {/* Current members */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>
          Members ({members.length})
        </h2>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {members.map((m, i) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{
                background: i % 2 === 0 ? "var(--card)" : "var(--card2)",
                borderBottom: i < members.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: "rgba(16,185,129,0.15)", color: "var(--accent)" }}
                >
                  {m.email.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.email}</p>
                  {m.user_id === currentUserId && (
                    <p className="text-[11px]" style={{ color: "var(--muted2)" }}>You</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && m.role !== "owner" && m.user_id !== currentUserId ? (
                  <select
                    defaultValue={m.role}
                    onChange={e => startTransition(() => { void handleRoleChange(m.user_id, e.target.value); })}
                    className="text-xs rounded-lg border px-2 py-1"
                    style={inputCss}
                  >
                    {[...ROLES, "owner"].map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {isAdmin && m.user_id !== currentUserId && m.role !== "owner" && (
                  <button
                    onClick={() => startTransition(() => { void handleRemove(m.user_id, m.email); })}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                    style={{ color: "var(--red-c)" }}
                    title="Remove member"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending invites */}
      {isAdmin && invites.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>
            Pending Invites ({invites.length})
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {invites.map((inv, i) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
                style={{
                  background: i % 2 === 0 ? "var(--card)" : "var(--card2)",
                  borderBottom: i < invites.length - 1 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <ShieldCheck size={14} style={{ color: "var(--muted2)" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <p className="text-[11px]" style={{ color: "var(--muted2)" }}>
                      Expires {new Date(inv.expires_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RoleBadge role={inv.role} />
                  <button
                    onClick={() => startTransition(() => { void handleRevoke(inv.id); })}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                    style={{ color: "var(--muted2)" }}
                    title="Revoke invite"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
