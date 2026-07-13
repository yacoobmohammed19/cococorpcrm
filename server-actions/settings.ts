"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";
import { dimCacheTag, orgMetaCacheTag } from "@/lib/supabase/cache";

export async function updateOrgSettings(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { error } = await supabase.from("organizations").update({
    name: formData.get("name"),
    reg_no: formData.get("reg_no") || null,
    vat_no: formData.get("vat_no") || null,
    address: formData.get("address") || null,
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    bank_holder: formData.get("bank_holder") || null,
    bank_name: formData.get("bank_name") || null,
    bank_account: formData.get("bank_account") || null,
    bank_branch: formData.get("bank_branch") || null,
    currency: formData.get("currency") || "ZAR",
    fiscal_year_start: Number(formData.get("fiscal_year_start") || 3),
  }).eq("id", orgId);

  if (error) throw new Error(error.message);
  revalidateTag(orgMetaCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function updateLogoUrl(url: string | null) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("organizations").update({ logo_url: url }).eq("id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/invoices", "layout");
}

export async function updateFeatureFlags(flags: Record<string, boolean | undefined>) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("organizations").update({ feature_flags: flags }).eq("id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function saveDashboardSettings(settings: Record<string, unknown>) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("organizations").update({ dashboard_settings: settings }).eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function createInvoiceStatus(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  // Append new statuses at the end (position defaults to 0 otherwise, so all
  // new options would collide and sort unpredictably).
  const { data: last } = await supabase
    .from("dim_invoice_statuses")
    .select("position")
    .eq("org_id", orgId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("dim_invoice_statuses").insert({
    org_id: orgId,
    name: formData.get("name"),
    color: formData.get("color") || "#6b7280",
    position: (last?.position ?? -1) + 1,
  });
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function deleteInvoiceStatus(id: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_invoice_statuses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function updateInvoiceStatus(id: number, formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_invoice_statuses").update({
    name: formData.get("name"),
    color: formData.get("color") || "#6b7280",
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function createStatus(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_statuses").insert({
    org_id: orgId,
    name: formData.get("name"),
    category: formData.get("category") || null,
    is_active: true,
  });
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function deleteStatus(id: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_statuses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function updateStatus(id: number, formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_statuses").update({
    name: formData.get("name"),
    category: formData.get("category") || null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function createPaymentType(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_payment_types").insert({
    org_id: orgId,
    name: formData.get("name"),
    description: formData.get("description") || null,
  });
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function deletePaymentType(id: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_payment_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function updatePaymentType(id: number, formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_payment_types").update({
    name: formData.get("name"),
    description: formData.get("description") || null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function createCostCategory(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_cost_categories").insert({
    org_id: orgId,
    name: formData.get("name"),
    description: formData.get("description") || null,
  });
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
  revalidatePath("/costs");
}

export async function deleteCostCategory(id: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_cost_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function updateCostCategory(id: number, formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_cost_categories").update({
    name: formData.get("name"),
    description: formData.get("description") || null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
  revalidatePath("/costs");
}

export async function createAccount(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_accounts").insert({
    org_id: orgId,
    name: formData.get("name"),
    account_type: formData.get("account_type") || null,
  });
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function deleteAccount(id: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_accounts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function updateAccount(id: number, formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_accounts").update({
    name: formData.get("name"),
    account_type: formData.get("account_type") || null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
}

export async function updateAiSystemPrompt(prompt: string) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { data: org } = await supabase.from("organizations").select("feature_flags").eq("id", orgId).single();
  const existing = (org?.feature_flags as Record<string, unknown>) ?? {};
  const { error } = await supabase.from("organizations")
    .update({ feature_flags: { ...existing, ai_system_prompt: prompt || null } })
    .eq("id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function seedDefaults() {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { data: existingStatuses } = await supabase.from("dim_statuses").select("id").eq("org_id", orgId).limit(1);
  if (!existingStatuses?.length) {
    await supabase.from("dim_statuses").insert([
      { org_id: orgId, name: "Open", category: "Active", is_active: true },
      { org_id: orgId, name: "Follow Up", category: "Active", is_active: true },
      { org_id: orgId, name: "Closed Won", category: "Closed", is_active: false },
      { org_id: orgId, name: "Closed Lost", category: "Closed", is_active: false },
      { org_id: orgId, name: "Blacklist", category: "Closed", is_active: false },
    ]);
  }

  const { data: existingInvoiceStatuses } = await supabase.from("dim_invoice_statuses").select("id").eq("org_id", orgId).limit(1);
  if (!existingInvoiceStatuses?.length) {
    await supabase.from("dim_invoice_statuses").insert([
      { org_id: orgId, name: "Pending",     color: "#f59e0b", position: 0 },
      { org_id: orgId, name: "Completed",   color: "#10b981", position: 1 },
      { org_id: orgId, name: "Written Off", color: "#ef4444", position: 2 },
      { org_id: orgId, name: "Hold",        color: "#6366f1", position: 3 },
    ]);
  }

  const { data: existingPayTypes } = await supabase.from("dim_payment_types").select("id").eq("org_id", orgId).limit(1);
  if (!existingPayTypes?.length) {
    await supabase.from("dim_payment_types").insert([
      { org_id: orgId, name: "EFT", description: "Bank transfer" },
      { org_id: orgId, name: "Payfast", description: "Online payment gateway" },
      { org_id: orgId, name: "Cash", description: "Cash payment" },
    ]);
  }

  const { data: existingCats } = await supabase.from("dim_cost_categories").select("id").eq("org_id", orgId).limit(1);
  if (!existingCats?.length) {
    await supabase.from("dim_cost_categories").insert([
      { org_id: orgId, name: "Core", description: "Core business costs" },
      { org_id: orgId, name: "Comms", description: "Communication costs" },
      { org_id: orgId, name: "Ad Spend", description: "Digital advertising" },
    ]);
  }

  const { data: existingAccounts } = await supabase.from("dim_accounts").select("id").eq("org_id", orgId).limit(1);
  if (!existingAccounts?.length) {
    await supabase.from("dim_accounts").insert([
      { org_id: orgId, name: "Primary Bank", account_type: "Bank" },
      { org_id: orgId, name: "Secondary Bank", account_type: "Bank" },
      { org_id: orgId, name: "Payment Gateway", account_type: "Gateway" },
    ]);
  }

  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/costs");
}
