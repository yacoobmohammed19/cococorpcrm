"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";
import { dimCacheTag, orgMetaCacheTag } from "@/lib/supabase/cache";
import { resolveStatusWeights, weightForStatus } from "@/lib/lead-weights";

// Read → merge → write the org's status-weight map (feature_flags.status_weights).
async function mergeStatusWeight(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  orgId: string,
  statusId: number,
  weightRaw: FormDataEntryValue | null | undefined,
) {
  if (weightRaw == null || weightRaw === "") return;
  const w = Math.min(100, Math.max(0, Math.round(Number(weightRaw) || 0)));
  const { data: org } = await supabase.from("organizations").select("feature_flags").eq("id", orgId).single();
  const existing = (org?.feature_flags as Record<string, unknown>) ?? {};
  const weights = resolveStatusWeights(existing);
  weights[String(statusId)] = w;
  await supabase.from("organizations")
    .update({ feature_flags: { ...existing, status_weights: weights } })
    .eq("id", orgId);
}

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
  const { data: created, error } = await supabase.from("dim_statuses").insert({
    org_id: orgId,
    name: formData.get("name"),
    category: formData.get("category") || null,
    is_active: true,
  }).select("id").single();
  if (error) throw new Error(error.message);
  if (created) await mergeStatusWeight(supabase, orgId, created.id as number, formData.get("weight"));
  revalidateTag(dimCacheTag(orgId), "default");
  revalidateTag(orgMetaCacheTag(orgId), "default");
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
  await mergeStatusWeight(supabase, orgId, id, formData.get("weight"));
  revalidateTag(dimCacheTag(orgId), "default");
  revalidateTag(orgMetaCacheTag(orgId), "default");
  revalidatePath("/settings");
  revalidatePath("/leads");
}

/**
 * Re-apply each lead's weight from its status's configured weight, across all
 * leads in the org. `opportunity_weighted` is a generated column, so it updates
 * automatically once `weight` changes.
 */
export async function recalcLeadWeights() {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { data: org } = await supabase.from("organizations").select("feature_flags").eq("id", orgId).single();
  const weights = resolveStatusWeights(org?.feature_flags);

  const { data: leads, error } = await supabase
    .from("fact_leads")
    .select("id, status_id, weight")
    .eq("org_id", orgId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  // Only write leads whose weight actually changes.
  const updates = (leads ?? [])
    .map(l => ({ id: l.id as number, next: weightForStatus(weights, l.status_id as number | null), current: Number(l.weight ?? 0) }))
    .filter(u => u.next !== u.current);

  let updated = 0;
  for (const u of updates) {
    const { error: uErr } = await supabase.from("fact_leads").update({ weight: u.next }).eq("id", u.id);
    if (uErr) throw new Error(uErr.message);
    updated++;
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { updated };
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
