import Link from "next/link";
import Image from "next/image";
import { login } from "@/server-actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  const admin = createAdminClient();
  const { data: orgData } = await admin
    .from("organizations")
    .select("name, logo_url")
    .limit(1)
    .single();

  const logoUrl = orgData?.logo_url || null;
  const orgName = orgData?.name || null;
  return (
    <main className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--background)" }}>

      {/* Background accent blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--pink)" }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: "var(--accent)" }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {logoUrl ? (
            <div className="mb-4">
              <Image
                src={logoUrl}
                alt={orgName || "Organisation logo"}
                width={160}
                height={80}
                className="object-contain"
                style={{ maxHeight: 80 }}
                unoptimized
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-2xl"
              style={{ background: "linear-gradient(135deg, var(--pink) 0%, var(--accent) 100%)" }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="14" stroke="white" strokeWidth="2.5" strokeDasharray="4 3" />
                <circle cx="20" cy="20" r="7" fill="white" opacity="0.9" />
                <circle cx="20" cy="20" r="3" fill="white" />
              </svg>
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-widest">
            {orgName
              ? <span style={{ color: "var(--foreground)" }}>{orgName}</span>
              : <><span style={{ color: "var(--pink)" }}>COCO</span><span style={{ color: "var(--foreground)" }}>CORP</span></>
            }
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--muted2)" }}>
            Sign in to your workspace
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 shadow-2xl"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>

          {error && (
            <div className="mb-5 rounded-xl px-4 py-3 text-sm flex items-start gap-2"
              style={{ background: "rgba(239,68,68,.10)", border: "1px solid var(--red-c)", color: "var(--red-c)" }}>
              <span className="mt-px shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form action={login} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--muted2)" }}>
                Organisation <span style={{ color: "var(--red-c)" }}>*</span>
              </label>
              <input name="org_name" required placeholder="Your organisation name"
                className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--muted2)" }}>
                Email <span style={{ color: "var(--red-c)" }}>*</span>
              </label>
              <input name="email" type="email" required placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--muted2)" }}>
                Password <span style={{ color: "var(--red-c)" }}>*</span>
              </label>
              <input name="password" type="password" required placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <button type="submit"
              className="w-full py-3 rounded-xl text-sm font-bold tracking-wide mt-2 transition-opacity active:opacity-80"
              style={{ background: "linear-gradient(90deg, var(--pink) 0%, var(--accent) 100%)", color: "#fff" }}>
              Sign in →
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--muted2)" }}>New here?</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          <Link href="/signup"
            className="block w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-colors hover:opacity-80"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
            Create organisation
          </Link>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: "var(--muted2)" }}>
          Powered by CocoCRM ·{" "}
          <Link href="/pricing" style={{ color: "var(--accent)" }}>Plans &amp; Pricing</Link>
        </p>
      </div>
    </main>
  );
}
