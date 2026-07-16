import { redirect } from "next/navigation";
import { Building2, Mail } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { isSuperAdminUser } from "@/lib/supabase/platform";
import { signout } from "@/server-actions/auth";

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Super admins run the platform — send them to the control tower.
    if (isSuperAdminUser(user)) redirect("/admin");

    // Already in an org? Off to the app.
    const { data: memberships } = await supabase
      .from("memberships").select("org_id").eq("user_id", user.id).limit(1);
    if (memberships && memberships.length > 0) redirect("/dashboard");
  }

  // No org and not a super admin — organisations are provisioned centrally now,
  // so there's nothing to self-create here. Point them at their administrator.
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4" style={{ background: "var(--background)" }}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5 text-center"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "var(--accent-subtle)" }}
        >
          <Building2 size={22} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">No workspace yet</h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
            Your account isn&apos;t linked to an organisation. Organisations are set up by
            your CocoCorp administrator — ask them to invite you or allocate your account.
          </p>
        </div>

        <a
          href="mailto:corpCoco70@gmail.com?subject=CocoCorp%20access%20request"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Mail size={15} />
          Request access
        </a>

        <form action={signout}>
          <button
            type="submit"
            className="text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: "var(--muted2)" }}
          >
            Sign in with a different account
          </button>
        </form>
      </div>
    </main>
  );
}
