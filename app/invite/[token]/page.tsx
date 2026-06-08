import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  // Look up the token — use service role since the user may not be authenticated yet
  const { data: invite } = await admin
    .from("invite_tokens")
    .select("id, org_id, email, role, expires_at, used_at")
    .eq("token", token)
    .single();

  const isValid =
    invite &&
    !invite.used_at &&
    new Date(invite.expires_at) > new Date();

  if (!isValid) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <div
          className="rounded-xl border p-8 max-w-sm w-full space-y-3"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="text-4xl">🔗</div>
          <h1 className="text-xl font-bold">Invalid or expired invite</h1>
          <p style={{ color: "var(--muted)" }}>
            This invite link has already been used or has expired. Ask your team admin to send a new invite.
          </p>
          <Link
            href="/login"
            className="inline-block mt-2 text-sm font-semibold"
            style={{ color: "var(--accent)" }}
          >
            Go to login →
          </Link>
        </div>
      </main>
    );
  }

  // Check if the user is already logged in
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in — send to signup with invite token pre-filled
    redirect(`/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invite.email)}`);
  }

  // Route through the API handler so it can set the org cookie (impossible from a server component)
  redirect(`/api/accept-invite?token=${encodeURIComponent(token)}`);
}
