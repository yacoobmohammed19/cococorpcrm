import { createServerClient } from "@/lib/supabase/server";

/** Returns the current user's role in their active org, or null. */
export async function getCurrentOrgRole(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const orgId = String(user.user_metadata?.active_org_id ?? "");
  if (!orgId) return null;
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();
  return data?.role ?? null;
}

export async function getCurrentOrgId() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const preferredOrgId = String(user.user_metadata?.active_org_id ?? "");
  if (preferredOrgId) {
    const { data: scoped } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", preferredOrgId)
      .single();

    if (scoped?.org_id) return scoped.org_id;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership?.org_id) {
    throw new Error("No organization membership found");
  }

  return membership.org_id;
}
