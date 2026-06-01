"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId, getCurrentOrgRole } from "@/lib/supabase/org";
import { Resend } from "resend";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer", "operator"]),
});

async function requireAdminRole() {
  const role = await getCurrentOrgRole();
  if (!role || !["owner", "admin"].includes(role)) {
    throw new Error("Only org owners and admins can manage team members");
  }
}

export async function inviteUser(formData: FormData) {
  await requireAdminRole();

  const parsed = InviteSchema.parse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const orgId = await getCurrentOrgId();

  // Check if user is already a member
  const admin = createAdminClient();
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = authUsers.users.find(u => u.email === parsed.email);
  if (existingUser) {
    const { data: existingMembership } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", existingUser.id)
      .eq("org_id", orgId)
      .single();
    if (existingMembership) {
      throw new Error(`${parsed.email} is already a member of this organisation`);
    }
  }

  const { data: tokenRow, error } = await supabase
    .from("invite_tokens")
    .insert({
      org_id: orgId,
      email: parsed.email,
      role: parsed.role,
      created_by: user.id,
    })
    .select("token")
    .single();

  if (error) throw new Error(error.message);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite/${tokenRow.token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();
  const orgName = org?.name || "an organisation";

  await resend.emails.send({
    from: "CocoCRM <noreply@cococrm.co.za>",
    to: parsed.email,
    subject: `You've been invited to join ${orgName} on CocoCRM`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;">
        <h2 style="margin-bottom:8px;">You've been invited!</h2>
        <p style="color:#555;margin-bottom:24px;">
          You've been invited to join <strong>${orgName}</strong> on CocoCRM
          as a <strong>${parsed.role}</strong>.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;background:#10B981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Accept Invitation
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px;">
          This link expires in 7 days. If you weren't expecting this invite, you can safely ignore it.
        </p>
      </div>
    `,
  });

  revalidatePath("/settings/team");
}

export async function revokeInvite(tokenId: string) {
  await requireAdminRole();
  const supabase = await createServerClient();
  await supabase.from("invite_tokens").delete().eq("id", tokenId);
  revalidatePath("/settings/team");
}

export async function removeMember(userId: string) {
  await requireAdminRole();
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  // Can't remove yourself if you're the only owner
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === userId) throw new Error("You cannot remove yourself from the organisation");

  // Make sure we're not removing the last owner
  const { data: owners } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner");
  const { data: targetMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .single();
  if (targetMembership?.role === "owner" && (owners?.length ?? 0) <= 1) {
    throw new Error("Cannot remove the last owner of an organisation");
  }

  await supabase.from("memberships").delete().eq("user_id", userId).eq("org_id", orgId);
  revalidatePath("/settings/team");
}

export async function updateMemberRole(userId: string, newRole: string) {
  await requireAdminRole();
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  // Can't downgrade the last owner
  if (newRole !== "owner") {
    const { data: owners } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner");
    const { data: target } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .single();
    if (target?.role === "owner" && (owners?.length ?? 0) <= 1) {
      throw new Error("Cannot change the role of the last owner");
    }
  }

  await supabase
    .from("memberships")
    .update({ role: newRole })
    .eq("user_id", userId)
    .eq("org_id", orgId);

  revalidatePath("/settings/team");
}
