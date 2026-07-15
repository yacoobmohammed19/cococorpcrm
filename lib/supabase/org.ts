import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

const ORG_COOKIE = "coco_active_org";

/** Deduped per request — avoids repeated getUser() network calls within the same render tree. */
export const getServerUser = cache(async () => {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/**
 * Resolves the active org ID. The `coco_active_org` cookie is the fast path and
 * source of truth — it is set on login, signup, org-switch, and org-create.
 *
 * Trusting the cookie value directly is safe: every org-scoped table enforces
 * Row-Level Security via `has_org_role(org_id, ...)`, which checks the caller's
 * `auth.uid()` against the `memberships` table at the database. A tampered cookie
 * therefore cannot read or write another org's data — the DB rejects it. This
 * lets us skip a `getUser()` + `memberships` round-trip on every page and action
 * (the hot path). We only fall back to the full resolution when the cookie is
 * absent (e.g. a stale session or a direct API call before login set it).
 */
export const getCurrentOrgId = cache(async (): Promise<string> => {
  const jar = await cookies();
  const cookieOrgId = jar.get(ORG_COOKIE)?.value ?? "";
  if (cookieOrgId) return cookieOrgId;

  // ── Fallback: cookie missing — resolve from auth + memberships ──
  const user = await getServerUser();
  if (!user) throw new Error("Unauthorized");

  const supabase = await createServerClient();

  // Fetch all memberships in one query, ordered so fallback is deterministic
  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!memberships || memberships.length === 0) {
    throw new Error("No organization membership found");
  }

  // Prefer metadata if the user actually belongs to that org
  const metaOrg = String(user.user_metadata?.active_org_id ?? "");
  if (metaOrg && memberships.some(m => String(m.org_id) === metaOrg)) {
    return metaOrg;
  }

  // Deterministic fallback: earliest membership
  return String(memberships[0].org_id);
});

/** Returns the caller's role in their active org, or null. */
export const getCurrentOrgRole = cache(async (): Promise<string | null> => {
  const user = await getServerUser();
  if (!user) return null;

  let orgId: string;
  try {
    orgId = await getCurrentOrgId();
  } catch {
    return null;
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();
  return data?.role ?? null;
});
