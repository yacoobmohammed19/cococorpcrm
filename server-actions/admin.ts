"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/supabase/platform";

// All actions here are platform-level and MUST be gated by requireSuperAdmin().
// They use the service-role client, which bypasses RLS — so the guard is the
// only thing standing between a caller and every org's data. Never remove it.

const ROLES = ["owner", "admin", "member", "viewer", "operator"] as const;
const CURRENCIES = ["ZAR", "USD", "EUR", "GBP", "AUD", "CAD"] as const;

function parseOrg(formData: FormData): { name: string; currency: string } {
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "ZAR");
  if (!name) throw new Error("Organisation name is required");
  if (name.length > 120) throw new Error("Organisation name is too long");
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) throw new Error("Invalid currency");
  return { name, currency };
}

function adminPaths(orgId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/organisations");
  revalidatePath("/admin/users");
  if (orgId) revalidatePath(`/admin/organisations/${orgId}`);
}

/** Create a new organisation. */
export async function adminCreateOrg(formData: FormData): Promise<{ id: string }> {
  await requireSuperAdmin();
  const parsed = parseOrg(formData);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .insert({ name: parsed.name, currency: parsed.currency })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  adminPaths();
  return { id: String(data.id) };
}

/** Rename / re-currency an organisation. */
export async function adminUpdateOrg(orgId: string, formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const parsed = parseOrg(formData);

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ name: parsed.name, currency: parsed.currency })
    .eq("id", orgId);
  if (error) throw new Error(error.message);

  adminPaths(orgId);
}

/** Permanently delete an organisation and all its data (FK cascade). */
export async function adminDeleteOrg(orgId: string): Promise<void> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").delete().eq("id", orgId);
  if (error) throw new Error(error.message);
  adminPaths();
}

/**
 * Allocate a user to an org. If the email already has an account they are added
 * as a member; otherwise a new account is created with the supplied password
 * (email pre-confirmed, no invite email — the super admin shares credentials).
 */
export async function adminAllocateUser(
  orgId: string,
  email: string,
  role: string,
  password?: string,
): Promise<{ created: boolean }> {
  await requireSuperAdmin();

  const normEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail)) throw new Error("Enter a valid email");
  if (!ROLES.includes(role as (typeof ROLES)[number])) throw new Error("Invalid role");
  const pw = (password ?? "").trim();
  if (pw && pw.length < 6) throw new Error("Password must be at least 6 characters");

  const admin = createAdminClient();

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = authUsers.users.find((u) => u.email?.toLowerCase() === normEmail);

  if (existing) {
    const { data: mem } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", existing.id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (mem) throw new Error(`${normEmail} is already a member of this organisation`);

    const { error } = await admin
      .from("memberships")
      .insert({ user_id: existing.id, org_id: orgId, role });
    if (error) throw new Error(error.message);

    adminPaths(orgId);
    return { created: false };
  }

  // New account — a password is required to create one.
  if (!pw) {
    throw new Error("No account exists for this email — set a password to create one");
  }

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email: normEmail,
    password: pw,
    email_confirm: true,
    user_metadata: { active_org_id: orgId },
  });
  if (createErr) throw new Error(createErr.message);

  const { error: memErr } = await admin
    .from("memberships")
    .insert({ user_id: newUser.user.id, org_id: orgId, role });
  if (memErr) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    throw new Error(memErr.message);
  }

  adminPaths(orgId);
  return { created: true };
}

/** Remove a user's membership from an org (does not delete their account). */
export async function adminRemoveMember(userId: string, orgId: string): Promise<void> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .delete()
    .eq("user_id", userId)
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
  adminPaths(orgId);
}

/** Change a member's role within an org. */
export async function adminSetMemberRole(userId: string, orgId: string, role: string): Promise<void> {
  await requireSuperAdmin();
  if (!ROLES.includes(role as (typeof ROLES)[number])) throw new Error("Invalid role");
  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .update({ role })
    .eq("user_id", userId)
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
  adminPaths(orgId);
}
