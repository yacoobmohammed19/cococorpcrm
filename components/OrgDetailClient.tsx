"use client";

import { useState, useTransition } from "react";
import {
  UserPlus, Trash2, RefreshCw, Mail, ShieldCheck, KeyRound,
  Copy, Check, ArrowLeftRight, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  removeOrgMember, updateOrgMemberRole, createOrgUser, inviteOrgUser,
} from "@/server-actions/invites";
import { setActiveOrganization, deleteOrganization } from "@/server-actions/auth";
import { runAction } from "@/lib/action-utils";

type Member = { user_id: string; email: string; role: string };
type Invite = { id: string; email: string; role: string; expires_at: string };

type Props = {
  orgId: string;
  orgName: string;
  isActive: boolean;
  callerRole: string;
  currentUserId: string;
  members: Member[];
  invites: Invite[];
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
      style={{
        background: `color-mix(in srgb, ${ROLE_COLORS[role] ?? "var(--muted2)"} 15%, transparent)`,
        color: ROLE_COLORS[role] ?? "var(--muted2)",
      }}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded transition-colors shrink-0"
      style={{ color: copied ? "var(--accent)" : "var(--muted2)" }}
      title="Copy"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function CredentialsModal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  const rows = [
    { label: "Login URL", value: loginUrl },
    { label: "Email", value: email },
    { label: "Password", value: password },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="rounded-2xl p-6 w-full max-w-md space-y-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
            <KeyRound size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h3 className="font-bold text-base">User Created</h3>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Share these login credentials with the user</p>
          </div>
        </div>
        <div className="space-y-2 rounded-xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
          {rows.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{label}</p>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <code className="text-sm flex-1 truncate">{value}</code>
                <CopyBtn text={value} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Store these securely — the password is not recoverable from here.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

export function OrgDetailClient({
  orgId, orgName, isActive, callerRole, currentUserId, members, invites,
}: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<null | "invite" | "create">(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  const isAdmin = ["owner", "admin"].includes(callerRole);
  const isOwner = callerRole === "owner";
  const [deletePending, setDeletePending] = useState(false);

  async function handleDeleteOrg() {
    if (!confirm(`Delete "${orgName}"?\n\nThis permanently removes all data for this organisation — invoices, customers, leads, and all users. This cannot be undone.`)) return;
    setDeletePending(true);
    await runAction(() => deleteOrganization(orgId), toast, "Organisation deleted");
    setDeletePending(false);
  }

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const role = String(fd.get("role") ?? "member");
    const ok = await runAction(() => inviteOrgUser(orgId, email, role), toast, "Invite sent!");
    if (ok) setPanel(null);
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const role = String(fd.get("role") ?? "member");
    const emailSnap = email;
    const passSnap = password;
    const ok = await runAction(() => createOrgUser(orgId, email, password, role), toast, "User created!");
    if (ok) {
      setCreatedCreds({ email: emailSnap, password: passSnap });
      setCreateEmail(""); setCreatePassword(""); setPanel(null);
    }
  }

  async function handleRemove(userId: string, email: string) {
    if (!confirm(`Remove ${email} from ${orgName}?`)) return;
    await runAction(() => removeOrgMember(userId, orgId), toast, "Member removed");
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await runAction(() => updateOrgMemberRole(userId, orgId, newRole), toast, "Role updated");
  }

  return (
    <>
      {createdCreds && (
        <CredentialsModal
          email={createdCreds.email}
          password={createdCreds.password}
          onClose={() => setCreatedCreds(null)}
        />
      )}

      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">{orgName}</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
              Manage members and permissions for this organisation
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isActive && (
              <form action={setActiveOrganization}>
                <input type="hidden" name="org_id" value={orgId} />
                <button
                  type="submit"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity active:opacity-80"
                  style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  <ArrowLeftRight size={14} />
                  Switch to this org
                </button>
              </form>
            )}
            {isActive && (
              <span
                className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                style={{ background: "rgba(16,185,129,0.15)", color: "var(--accent)" }}
              >
                Active
              </span>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => setPanel(panel === "invite" ? null : "invite")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity active:opacity-80"
                  style={{
                    background: panel === "invite" ? "var(--accent)" : "var(--card2)",
                    color: panel === "invite" ? "#fff" : "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Mail size={15} />
                  Invite
                </button>
                {isOwner && (
                  <button
                    onClick={() => setPanel(panel === "create" ? null : "create")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity active:opacity-80"
                    style={{
                      background: panel === "create" ? "var(--purple-c)" : "var(--card2)",
                      color: panel === "create" ? "#fff" : "var(--foreground)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <UserPlus size={15} />
                    Create User
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Invite panel */}
        {panel === "invite" && isAdmin && (
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-sm font-semibold">Invite a team member by email</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                They&apos;ll receive an email link to join this organisation.
              </p>
            </div>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
                    Email address
                  </label>
                  <input
                    name="email" type="email" required
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
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setPanel(null)}
                  className="flex-1 py-2 text-sm rounded-lg border"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                  Cancel
                </button>
                <button type="submit" disabled={pending}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2"
                  style={{ background: "var(--accent)", color: "#fff", opacity: pending ? 0.6 : 1 }}>
                  <Mail size={14} />
                  Send invite
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create user panel */}
        {panel === "create" && isOwner && (
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <KeyRound size={15} style={{ color: "var(--purple-c)" }} />
              <div>
                <p className="text-sm font-semibold">Create user with credentials</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Account is created immediately — share the login details with the user.
                </p>
              </div>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
                    Email address
                  </label>
                  <input
                    name="email" type="email" required
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-lg border text-sm px-3 py-2 outline-none"
                    style={inputCss}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
                    Password
                  </label>
                  <input
                    name="password" type="text" required minLength={6}
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                    className="w-full rounded-lg border text-sm px-3 py-2 outline-none font-mono"
                    style={inputCss}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
                  Role
                </label>
                <select name="role" className="w-full rounded-lg border text-sm px-3 py-2 outline-none" style={inputCss}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setPanel(null); setCreateEmail(""); setCreatePassword(""); }}
                  className="flex-1 py-2 text-sm rounded-lg border"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={pending}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2"
                  style={{ background: "var(--purple-c)", color: "#fff", opacity: pending ? 0.6 : 1 }}>
                  <UserPlus size={14} />
                  Create &amp; show credentials
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
          {(["owner", "admin", "member", "viewer", "operator"] as const).map(r => (
            <div key={r} className="flex items-center gap-2">
              <RoleBadge role={r} />
              <span style={{ color: "var(--muted)" }}>
                {r === "owner" ? "Full access + billing"
                  : r === "admin" ? "Full access"
                  : r === "member" ? "Read + write, no delete"
                  : r === "viewer" ? "Read only"
                  : "Leads only (own)"}
              </span>
            </div>
          ))}
        </div>

        {/* Members */}
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

        {/* Danger zone — owner only */}
        {isOwner && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.04)" }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: "var(--red-c)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--red-c)" }}>Danger Zone</p>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-medium">Delete this organisation</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  Permanently removes all data — invoices, customers, leads, and all users. Cannot be undone.
                </p>
              </div>
              <button
                onClick={handleDeleteOrg}
                disabled={deletePending}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold shrink-0 transition-opacity hover:opacity-80"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "var(--red-c)",
                  opacity: deletePending ? 0.5 : 1,
                }}
              >
                <Trash2 size={13} />
                Delete Organisation
              </button>
            </div>
          </div>
        )}

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
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--muted2)" }}
                      title="Revoke (use Team settings)"
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
    </>
  );
}
