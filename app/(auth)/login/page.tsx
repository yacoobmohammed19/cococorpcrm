import Link from "next/link";
import Image from "next/image";
import {
  Building2, ChevronRight, LogOut, Plus, ArrowRight,
  Users, FileText, Wallet, Megaphone,
} from "lucide-react";
import { login, setActiveOrganization, signout } from "@/server-actions/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { SubmitButton } from "@/components/Spinner";

// The four product surfaces CocoCorp ships — real content, not decoration.
const MODULES = [
  { icon: Users, label: "Leads & pipeline", note: "Track every deal to close" },
  { icon: FileText, label: "Invoicing & quotes", note: "Bill and get paid faster" },
  { icon: Wallet, label: "Accounting", note: "Cashflow, costs, reconciliation" },
  { icon: Megaphone, label: "Marketing", note: "Campaigns and performance" },
];

// The Coco aperture — dashed concentric rings, the brand's signature mark.
function ApertureMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="14" stroke="white" strokeWidth="2.5" strokeDasharray="4 3" />
      <circle cx="20" cy="20" r="7" fill="white" opacity="0.9" />
      <circle cx="20" cy="20" r="3" fill="var(--pink)" />
    </svg>
  );
}

// Large ambient version of the mark — the signature atmosphere behind the brand panel.
function ApertureBackdrop() {
  const rings = [40, 78, 116, 154, 192, 230, 268];
  return (
    <svg
      className="auth-rings absolute pointer-events-none"
      style={{ bottom: "-160px", left: "-140px", width: 620, height: 620 }}
      viewBox="0 0 620 620"
      fill="none"
      aria-hidden
    >
      {rings.map((r, i) => (
        <circle
          key={r}
          cx="310"
          cy="310"
          r={r}
          stroke="var(--pink)"
          strokeWidth={i === 0 ? 3 : 1.5}
          strokeDasharray={`${6 + i * 2} ${8 + i * 3}`}
          opacity={0.5 - i * 0.055}
        />
      ))}
      <circle cx="310" cy="310" r="18" fill="var(--pink)" opacity="0.35" />
    </svg>
  );
}

// Left brand panel — profiles CocoCorp as the product. Always ink-dark for brand identity.
function BrandPanel() {
  return (
    <div
      className="relative overflow-hidden flex flex-col justify-between p-8 lg:p-12"
      style={{
        background: "linear-gradient(155deg, #232127 0%, #141316 58%, #1B181E 100%)",
        color: "#F5F4F2",
      }}
    >
      <ApertureBackdrop />
      <div
        className="auth-glow absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none"
        style={{ background: "var(--pink)", opacity: 0.5 }}
        aria-hidden
      />

      {/* Wordmark */}
      <div className="relative auth-rise" style={{ animationDelay: "0.02s" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
            style={{ background: "linear-gradient(135deg, var(--pink) 0%, var(--accent-hover) 100%)" }}
          >
            <ApertureMark size={26} />
          </div>
          <span className="text-2xl font-bold tracking-[0.2em]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            <span style={{ color: "var(--pink)" }}>COCO</span>
            <span>CORP</span>
          </span>
        </div>
      </div>

      {/* Positioning + modules */}
      <div className="relative mt-10 lg:mt-0">
        <p
          className="auth-rise text-[11px] font-bold uppercase tracking-[0.28em] mb-4"
          style={{ color: "var(--pink)", animationDelay: "0.08s" }}
        >
          The business operating system
        </p>
        <h2
          className="auth-rise text-3xl lg:text-[2.6rem] leading-[1.05] font-bold max-w-md"
          style={{ fontFamily: "var(--font-display), sans-serif", letterSpacing: "0.01em", animationDelay: "0.12s" }}
        >
          Run the whole business from one place.
        </h2>

        <ul className="mt-8 space-y-3 hidden lg:block">
          {MODULES.map((m, i) => {
            const Icon = m.icon;
            return (
              <li
                key={m.label}
                className="auth-rise flex items-center gap-3.5"
                style={{ animationDelay: `${0.18 + i * 0.06}s` }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(236,72,153,0.14)", border: "1px solid rgba(236,72,153,0.25)" }}
                >
                  <Icon size={16} style={{ color: "var(--pink)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{m.label}</p>
                  <p className="text-xs" style={{ color: "rgba(245,244,242,0.55)" }}>{m.note}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Pricing CTA — made prominent */}
      <div className="relative mt-10 auth-rise" style={{ animationDelay: "0.44s" }}>
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="flex-1">
            <p className="text-xs" style={{ color: "rgba(245,244,242,0.6)" }}>Plans from</p>
            <p className="text-lg font-bold">
              R499<span className="text-sm font-normal" style={{ color: "rgba(245,244,242,0.6)" }}>/mo</span>
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold shrink-0 transition-transform active:scale-95 hover:opacity-90"
            style={{ background: "var(--pink)", color: "#fff" }}
          >
            See plans &amp; pricing
            <ArrowRight size={15} />
          </Link>
        </div>
        <p className="text-xs mt-2.5 text-center lg:text-left" style={{ color: "rgba(245,244,242,0.45)" }}>
          14-day free trial · no credit card required
        </p>
      </div>
    </div>
  );
}

// Split-screen shell — dark brand panel + light auth panel. Stacks on mobile.
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]" style={{ background: "var(--background)" }}>
      <BrandPanel />
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm auth-rise" style={{ animationDelay: "0.1s" }}>
          {children}
        </div>
      </div>
    </main>
  );
}

type PickerOrg = {
  id: string;
  name: string;
  currency: string;
  logoUrl: string | null;
  role: string;
  isActive: boolean;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string; select?: string }>;
}) {
  const { error, invite } = await searchParams;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ────────────────────────────────────────────────────────────────
  // Authenticated → workspace picker. Also the "switch org" screen.
  // ────────────────────────────────────────────────────────────────
  if (user) {
    const { data: memberships } = await supabase
      .from("memberships")
      .select("role, organizations(id, name, currency, logo_url)")
      .eq("user_id", user.id);

    let activeOrgId = "";
    try {
      activeOrgId = await getCurrentOrgId();
    } catch {
      /* no active org yet */
    }

    const orgs: PickerOrg[] = (memberships ?? [])
      .map((m) => {
        const org = Array.isArray(m.organizations)
          ? (m.organizations[0] as { id: string; name: string; currency: string; logo_url: string | null })
          : (m.organizations as { id: string; name: string; currency: string; logo_url: string | null } | null);
        return {
          id: org?.id ?? "",
          name: org?.name ?? "Unnamed",
          currency: org?.currency ?? "ZAR",
          logoUrl: org?.logo_url ?? null,
          role: m.role,
          isActive: org?.id === activeOrgId,
        };
      })
      .filter((o) => o.id)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

    return (
      <AuthLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Choose a workspace</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted2)" }}>
            Signed in as {user.email}
          </p>
        </div>

        {orgs.length > 0 ? (
          <div className="space-y-2.5">
            {orgs.map((org) => (
              <form key={org.id} action={setActiveOrganization}>
                <input type="hidden" name="org_id" value={org.id} />
                <SubmitButton
                  spinnerSize={16}
                  className="group w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all hover:-translate-y-0.5"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                    style={{ background: org.isActive ? "var(--accent-subtle)" : "var(--card3)" }}
                  >
                    {org.logoUrl ? (
                      <Image src={org.logoUrl} alt={org.name} width={44} height={44} className="object-contain" unoptimized />
                    ) : (
                      <Building2 size={19} style={{ color: org.isActive ? "var(--accent)" : "var(--muted2)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{org.name}</p>
                      {org.isActive && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs capitalize" style={{ color: "var(--muted2)" }}>
                      {org.role} · {org.currency}
                    </p>
                  </div>
                  <ChevronRight
                    size={17}
                    style={{ color: "var(--muted2)" }}
                    className="shrink-0 transition-transform group-hover:translate-x-0.5"
                  />
                </SubmitButton>
              </form>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl px-4 py-6 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-medium">No workspaces yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>
              Create an organisation to get started.
            </p>
          </div>
        )}

        <Link
          href="/onboarding"
          className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl text-sm font-semibold transition-colors hover:opacity-80"
          style={{ background: "var(--card2)", border: "1px dashed var(--border2)", color: "var(--foreground)" }}
        >
          <Plus size={15} />
          Create organisation
        </Link>

        <form action={signout} className="mt-4 text-center">
          <SubmitButton
            spinnerSize={13}
            className="inline-flex items-center gap-2 text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: "var(--muted2)" }}
          >
            <LogOut size={13} />
            Sign in with a different account
          </SubmitButton>
        </form>
      </AuthLayout>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Signed out → credential form.
  // ────────────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted2)" }}>
          Sign in to your CocoCorp workspace
        </p>
      </div>

      {error && (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-sm flex items-start gap-2"
          style={{ background: "var(--danger-bg)", border: "1px solid var(--red-c)", color: "var(--red-c)" }}
        >
          <span className="mt-px shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      <form action={login} className="space-y-4">
        {invite && <input type="hidden" name="invite" value={invite} />}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--muted2)" }}>
            Email <span style={{ color: "var(--red-c)" }}>*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
              Password <span style={{ color: "var(--red-c)" }}>*</span>
            </label>
            <Link href="/reset-password" className="text-xs font-semibold transition-colors hover:opacity-70" style={{ color: "var(--accent)" }}>
              Forgot?
            </Link>
          </div>
          <input
            name="password"
            type="password"
            required
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
        </div>
        <SubmitButton
          pendingLabel="Signing in…"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold tracking-wide mt-1 transition-transform active:scale-[0.98]"
          style={{ background: "linear-gradient(90deg, var(--pink) 0%, var(--accent-hover) 100%)", color: "#fff", boxShadow: "0 8px 24px var(--accent-glow)" }}
        >
          Sign in →
        </SubmitButton>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="text-xs" style={{ color: "var(--muted2)" }}>New to CocoCorp?</span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      <Link
        href={invite ? `/signup?invite=${invite}` : "/signup"}
        className="block w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-colors hover:opacity-80"
        style={{ background: "var(--card2)", border: "1px solid var(--border2)", color: "var(--foreground)" }}
      >
        Create your organisation
      </Link>

      <div className="mt-6 flex items-center justify-center gap-4 text-xs" style={{ color: "var(--muted2)" }}>
        <Link href="/pricing" className="font-semibold transition-colors hover:opacity-70" style={{ color: "var(--accent)" }}>
          Plans &amp; pricing
        </Link>
        <span aria-hidden>·</span>
        <a href="mailto:corpCoco70@gmail.com" className="transition-colors hover:opacity-70">
          Contact sales
        </a>
      </div>
    </AuthLayout>
  );
}
