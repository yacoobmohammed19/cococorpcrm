import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

const ORG_COOKIE = "coco_active_org";

/** Resolves the active org ID. Cookie is the source of truth; metadata is fallback. */
export async function getCurrentOrgId(): Promise<string> {
  const jar = await cookies();
  const cookieOrgId = jar.get(ORG_COOKIE)?.value ?? "";

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Cookie value takes priority; fall back to user metadata
  const candidate = cookieOrgId || String(user.user_metadata?.active_org_id ?? "");

  if (candidate) {
    const { data: scoped } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", candidate)
      .single();
    if (scoped?.org_id) return scoped.org_id as string;
  }

  // Fall back to first membership
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership?.org_id) throw new Error("No organization membership found");
  return membership.org_id as string;
}

/** Returns the caller's role in their active org, or null. */
export async function getCurrentOrgRole(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let orgId: string;
  try {
    orgId = await getCurrentOrgId();
  } catch {
    return null;
  }

  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();
  return data?.role ?? null;
}
