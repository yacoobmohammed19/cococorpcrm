"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

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

  // Use existing active_org_id if already set, otherwise pick first membership
  const existingOrgId = user.user_metadata?.active_org_id as string | undefined;
  if (!existingOrgId) {
    const { data: memberships } = await supabase
      .from("memberships").select("org_id").eq("user_id", user.id).limit(1);

    if (!memberships || memberships.length === 0) {
      await supabase.auth.signOut();
      redirect("/login?error=" + encodeURIComponent("No organisation found for this account."));
    }

    await supabase.auth.updateUser({ data: { active_org_id: memberships[0].org_id } });
  }

  revalidatePath("/", "layout");
  // If user logged in via an invite link, redirect to accept it
  if (inviteToken) redirect(`/invite/${inviteToken}`);
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const inviteToken = String(formData.get("invite") ?? "").trim();
  const supabase = await createServerClient();

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw new Error(error.message);
  }

  // If signed up via invite, redirect back to the invite acceptance route
  if (inviteToken) {
    redirect(`/invite/${inviteToken}`);
  }

  redirect("/onboarding");
}

export async function signout() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setActiveOrganization(formData: FormData) {
  const orgId = String(formData.get("org_id") ?? "");
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (!membership) {
    throw new Error("Organization access denied");
  }

  const { error } = await supabase.auth.updateUser({
    data: { active_org_id: orgId },
  });

  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "ZAR");

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Use service role to bypass RLS for org + membership bootstrap
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name, currency })
    .select("id")
    .single();

  if (orgError) throw new Error(orgError.message);

  const { error: memberError } = await admin.from("memberships").insert({
    user_id: user.id,
    org_id: org.id,
    role: "owner",
  });

  if (memberError) throw new Error(memberError.message);

  // Set active org in user metadata
  await supabase.auth.updateUser({ data: { active_org_id: org.id } });

  redirect("/dashboard");
}
