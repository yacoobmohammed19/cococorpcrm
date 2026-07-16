import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getServerUser } from "@/lib/supabase/org";

/**
 * Platform-level "super admin" — a CocoCorp operator who runs the whole
 * platform (the control tower), distinct from an org-level owner/admin.
 *
 * Super-admin status lives in the user's Supabase `app_metadata`, which — unlike
 * `user_metadata` — cannot be set by the user themselves. You grant it manually
 * in the Supabase dashboard (Authentication → Users → the user → App Metadata),
 * or via the admin API with the service-role key:
 *
 *   { "is_super_admin": true }        // or  { "role": "super_admin" }
 *
 * There is deliberately no in-app way to grant this — it is provisioned by hand.
 */
export function isSuperAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
  if (meta.is_super_admin === true) return true;
  if (meta.role === "super_admin") return true;
  const roles = meta.roles;
  if (Array.isArray(roles) && roles.includes("super_admin")) return true;
  return false;
}

/** Cached per request — true when the current caller is a platform super admin. */
export const isSuperAdmin = cache(async (): Promise<boolean> => {
  const user = await getServerUser();
  return isSuperAdminUser(user);
});

/** Throws unless the caller is a super admin. Returns the user on success. */
export async function requireSuperAdmin(): Promise<User> {
  const user = await getServerUser();
  if (!isSuperAdminUser(user)) {
    throw new Error("Forbidden — platform super-admin access required");
  }
  return user!;
}
