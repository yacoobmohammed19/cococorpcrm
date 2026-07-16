"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserPlus, Trash2, Save, AlertTriangle, KeyRound, Copy, Check } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";
import { runAction } from "@/lib/action-utils";
import {
  adminUpdateOrg, adminDeleteOrg, adminAllocateUser, adminRemoveMember, adminSetMemberRole,
} from "@/server-actions/admin";

type Member = { user_id: string; email: string; role: string };

type Props = {
  orgId: string;
  orgName: string;
  currency: string;
  members: Member[];
};

const ROLES = ["owner", "admin", "member", "viewer", "operator"] as const;
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

const card = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-sm)",
} as React.CSSProperties;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="rounded-2xl p-6 w-full max-w-md space-y-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--accent-subtle)" }}>
            <KeyRound size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h3 className="font-bold text-base">Account created</h3>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Share these login details with the user</p>
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
          Store these securely — the password can&apos;t be recovered from here.
        </p>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl font-semibold text-sm" style={{ background: "var(--accent)", color: "#fff" }}>
          Done
        </button>
      </div>
    </div>
  );
}

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

export function AdminOrgManager({ orgId, orgName, currency, members }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [allocEmail, setAllocEmail] = useState("");
  const [allocPassword, setAllocPassword] = useState("");
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  // Wrap an action with toast + server-state refresh.
  async function run(fn: () => Promise<unknown>, success: string) {
    const ok = await runAction(fn, toast, success);
    if (ok) router.refresh();
    return ok;
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    await run(() => adminUpdateOrg(orgId, fd), "Organisation updated");
    setSaving(false);
  }

  async function handleAllocate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const role = String(fd.get("role") ?? "member");
    const password = String(fd.get("password") ?? "");
    setAllocating(true);
    try {
      const { created } = await adminAllocateUser(orgId, email, role, password || undefined);
      toast.success(created ? "Account created & allocated" : "User allocated");
      // Only a newly-created account has credentials worth surfacing.
      if (created) setCreatedCreds({ email: email.toLowerCase(), password });
      setAllocEmail(""); setAllocPassword("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not allocate user");
    } finally {
      setAllocating(false);
    }
  }

  function handleRoleChange(userId: string, role: string) {
    startTransition(() => { void run(() => adminSetMemberRole(userId, orgId, role), "Role updated"); });
  }

  function handleRemove(userId: string, email: string) {
    if (!confirm(`Remove ${email} from ${orgName}? Their account stays, but they lose access to this org.`)) return;
    startTransition(() => { void run(() => adminRemoveMember(userId, orgId), "Member removed"); });
  }

  async function handleDelete() {
    if (!confirm(`Delete "${orgName}"?\n\nThis permanently removes ALL of this organisation's data — invoices, customers, leads and memberships. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await adminDeleteOrg(orgId);
      toast.success("Organisation deleted");
      // Navigate away only — the server action already revalidated the list.
      // Do NOT router.refresh() here: it would re-render this now-deleted
      // [id] route server-side and throw during that render.
      router.replace("/admin/organisations");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete organisation");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {createdCreds && (
        <CredentialsModal
          email={createdCreds.email}
          password={createdCreds.password}
          onClose={() => setCreatedCreds(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "var(--accent-subtle)" }}>
          <Building2 size={20} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">{orgName}</h1>
          <p className="text-sm" style={{ color: "var(--muted2)" }}>
            {members.length} {members.length === 1 ? "member" : "members"} · {currency}
          </p>
        </div>
      </div>

      {/* Edit org */}
      <form onSubmit={handleSave} className="rounded-2xl p-5 space-y-4" style={card}>
        <p className="text-sm font-bold">Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
              Organisation name
            </label>
            <input
              name="name"
              required
              defaultValue={orgName}
              className="w-full rounded-lg border text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)]"
              style={inputCss}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
              Currency
            </label>
            <select name="currency" defaultValue={currency} className="w-full rounded-lg border text-sm px-3 py-2 outline-none" style={inputCss}>
              <option value="ZAR">ZAR — South African Rand</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="AUD">AUD — Australian Dollar</option>
              <option value="CAD">CAD — Canadian Dollar</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity active:opacity-80"
          style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? <Spinner size={14} /> : <Save size={14} />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      {/* Allocate user */}
      <form onSubmit={handleAllocate} className="rounded-2xl p-5 space-y-4" style={card}>
        <div className="flex items-center gap-2">
          <UserPlus size={16} style={{ color: "var(--accent)" }} />
          <div>
            <p className="text-sm font-bold">Allocate a user</p>
            <p className="text-xs" style={{ color: "var(--muted2)" }}>
              Existing accounts are added instantly. New emails need a password to create the account.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
              Email
            </label>
            <input
              name="email" type="email" required
              value={allocEmail}
              onChange={(e) => setAllocEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-lg border text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)]"
              style={inputCss}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
              Role
            </label>
            <select name="role" defaultValue="member" className="w-full rounded-lg border text-sm px-3 py-2 outline-none" style={inputCss}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: "var(--muted2)" }}>
            <KeyRound size={12} /> Password <span className="normal-case font-normal">(only needed for a brand-new account)</span>
          </label>
          <input
            name="password" type="text" minLength={6}
            value={allocPassword}
            onChange={(e) => setAllocPassword(e.target.value)}
            placeholder="Min. 6 characters"
            autoComplete="new-password"
            className="w-full rounded-lg border text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono"
            style={inputCss}
          />
        </div>
        <button
          type="submit"
          disabled={allocating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity active:opacity-80"
          style={{ background: "var(--primary)", color: "var(--primary-fg)", opacity: allocating ? 0.6 : 1 }}
        >
          {allocating ? <Spinner size={14} /> : <UserPlus size={14} />}
          {allocating ? "Allocating…" : "Allocate user"}
        </button>
      </form>

      {/* Members */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>
          Members ({members.length})
        </h2>
        {members.length === 0 ? (
          <div className="rounded-2xl px-4 py-8 text-center" style={{ background: "var(--card)", border: "1px dashed var(--border2)" }}>
            <p className="text-sm font-medium">No members yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Allocate a user above to give this org an owner.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
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
                    style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                  >
                    {m.email.slice(0, 1).toUpperCase()}
                  </div>
                  <p className="text-sm font-medium truncate">{m.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    defaultValue={m.role}
                    disabled={pending}
                    onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                    className="text-xs rounded-lg border px-2 py-1"
                    style={inputCss}
                    aria-label={`Role for ${m.email}`}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button
                    onClick={() => handleRemove(m.user_id, m.email)}
                    disabled={pending}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                    style={{ color: "var(--red-c)" }}
                    title="Remove from organisation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: "var(--muted2)" }}>
          <RoleBadge role="owner" /> full access + billing ·
          <RoleBadge role="operator" /> leads only
        </p>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl p-5 space-y-3" style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.04)" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} style={{ color: "var(--red-c)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--red-c)" }}>Danger zone</p>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Permanently delete this organisation and all of its data.
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold shrink-0 transition-opacity hover:opacity-80"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", color: "var(--red-c)", opacity: deleting ? 0.5 : 1 }}
          >
            {deleting ? <Spinner size={13} /> : <Trash2 size={13} />}
            {deleting ? "Deleting…" : "Delete organisation"}
          </button>
        </div>
      </div>
    </div>
  );
}
