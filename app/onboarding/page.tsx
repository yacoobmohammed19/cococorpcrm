import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createOrganization } from "@/server-actions/auth";

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // If they already have orgs, send them to the app — they shouldn't be here
    const { data: memberships } = await supabase
      .from("memberships").select("org_id").eq("user_id", user.id).limit(1);
    if (memberships && memberships.length > 0) redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4" style={{ background: "var(--background)" }}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
          >
            <span className="text-white font-black text-sm">C</span>
          </div>
          <h1 className="text-xl font-bold">Set up your organisation</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Create your workspace to get started
          </p>
        </div>

        <form action={createOrganization} className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
              Organisation name *
            </label>
            <input
              name="name"
              required
              placeholder="e.g. Acme Corp"
              className="w-full rounded-lg border text-sm px-3 py-2.5 outline-none focus:ring-1 focus:ring-[var(--accent)]"
              style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
              Currency
            </label>
            <select
              name="currency"
              defaultValue="ZAR"
              className="w-full rounded-lg border text-sm px-3 py-2.5 outline-none"
              style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <option value="ZAR">ZAR — South African Rand</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="AUD">AUD — Australian Dollar</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl font-semibold text-sm mt-2"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Create &amp; continue
          </button>
        </form>
      </div>
    </main>
  );
}
