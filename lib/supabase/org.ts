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

  // Fetch all memberships in one query, ordered so fallback is deterministic
  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!memberships || memberships.length === 0) {
    throw new Error("No organization membership found");
  }

  const memberOrgIds = new Set(memberships.map(m => String(m.org_id)));

  // Prefer cookie, then metadata — but only if the user actually belongs to that org
  const candidates = [
    cookieOrgId,
    String(user.user_metadata?.active_org_id ?? ""),
  ];
  for (const c of candidates) {
    if (c && memberOrgIds.has(c)) return c;
  }

  // Deterministic fallback: earliest membership
  return String(memberships[0].org_id);
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
