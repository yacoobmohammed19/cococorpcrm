"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { isSuperAdminUser } from "@/lib/supabase/platform";

// Cookie that carries the active org — bypasses Supabase JWT refresh latency
const ORG_COOKIE = "coco_active_org";
const ORG_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
};

async function setOrgCookie(orgId: string) {
  const jar = await cookies();
  jar.set(ORG_COOKIE, String(orgId), ORG_COOKIE_OPTS);
}

async function clearOrgCookie() {
  const jar = await cookies();
  jar.delete(ORG_COOKIE);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const inviteToken = String(formData.get("invite") ?? "").trim();
  const supabase = await createServerClient();

  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    redirect("/login?error=" + encodeURIComponent(authError.message));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=" + encodeURIComponent("Authentication failed. Please try again."));
  }

  // Always validate org from DB — metadata can be stale for admin-created users
  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    // Platform super admins don't need an org — send them to the control tower.
    if (isSuperAdminUser(user)) {
      revalidatePath("/", "layout");
      redirect("/admin");
    }

    // Check if there is a pending invite for this email before giving up
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createAdminClient();
    const { data: pendingInvite } = await adminClient
      .from("invite_tokens")
      .select("token")
      .eq("email", email)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (pendingInvite?.token) {
      redirect(`/invite/${pendingInvite.token}`);
    }

    await supabase.auth.signOut();
    redirect("/login?error=" + encodeURIComponent("No organisation found for this account. Contact your administrator."));
  }

  // Honour saved cookie/metadata org if it's a valid membership, else use first
  const jar = await cookies();
  const savedOrgId = jar.get(ORG_COOKIE)?.value
    ?? String(user.user_metadata?.active_org_id ?? "");
  const validOrgId = String(
    memberships.find(m => String(m.org_id) === savedOrgId)?.org_id
    ?? memberships[0].org_id
  );

  await setOrgCookie(validOrgId);
  // Keep metadata in sync for cross-device access
  if (validOrgId !== String(user.user_metadata?.active_org_id ?? "")) {
    await supabase.auth.updateUser({ data: { active_org_id: validOrgId } }).catch(() => {});
  }

  revalidatePath("/", "layout");
  if (inviteToken) redirect(`/invite/${inviteToken}`);
  // Multiple workspaces — let the user pick which one to enter. The login page
  // renders a workspace picker once a session exists.
  if (memberships.length > 1) redirect("/login?select=1");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const inviteToken = String(formData.get("invite") ?? "").trim();
  const supabase = await createServerClient();

  const { data: signupData, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);

  if (inviteToken) redirect(`/invite/${inviteToken}`);

  // Only do smart routing when a session was returned (email confirmation not required)
  if (signupData?.session) {
    const userId = signupData.user?.id;
    if (userId) {
      // User may have been pre-created by an admin — check for an existing membership
      const { data: memberships } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", userId)
        .limit(1);

      if (memberships && memberships.length > 0) {
        await setOrgCookie(String(memberships[0].org_id));
        redirect("/dashboard");
      }
    }

    // Check for a pending invite for this email and route straight to acceptance
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createAdminClient();
    const { data: pendingInvite } = await adminClient
      .from("invite_tokens")
      .select("token")
      .eq("email", email)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (pendingInvite?.token) {
      redirect(`/invite/${pendingInvite.token}`);
    }
  }

  redirect("/onboarding");
}

export async function signout() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  await clearOrgCookie();
  redirect("/login");
}

export async function setActiveOrganization(formData: FormData) {
  const orgId = String(formData.get("org_id") ?? "");
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (!membership) throw new Error("Organization access denied");

  // Cookie is the source of truth — immediate, no JWT refresh needed
  await setOrgCookie(orgId);
  // Best-effort metadata sync (for other devices / sessions)
  await supabase.auth.updateUser({ data: { active_org_id: orgId } }).catch(() => {});

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Org creation & deletion are platform operations — see server-actions/admin.ts
// (adminCreateOrg / adminDeleteOrg), gated to super admins. They are deliberately
// NOT exposed here as self-serve actions.
