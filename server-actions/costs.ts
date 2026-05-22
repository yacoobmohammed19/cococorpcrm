"use server";

import { revalidatePath } from "next/cache";
import { CostSchema, CashflowSchema } from "@/lib/schemas/costs";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function createCost(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const parsed = CostSchema.parse({
    org_id: orgId,
    transaction_date: formData.get("transaction_date"),
    cost_details: formData.get("cost_details"),
    cost_category_id: formData.get("cost_category_id") || null,
    amount: formData.get("amount"),
    account_id: formData.get("account_id") || null,
    customer_id: formData.get("customer_id") || null,
    recouped: formData.get("recouped") || "",
    receipt_image_url: formData.get("receipt_image_url") || null,
  });

  const { error } = await supabase.from("fact_costs").insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

export async function updateCost(id: number, formData: FormData) {
  const supabase = await createServerClient();

  const receiptUrl = formData.get("receipt_image_url");
  const { error } = await supabase.from("fact_costs").update({
    transaction_date: formData.get("transaction_date"),
    cost_details: formData.get("cost_details") || null,
    cost_category_id: formData.get("cost_category_id") ? Number(formData.get("cost_category_id")) : null,
    amount: Number(formData.get("amount")),
    account_id: formData.get("account_id") ? Number(formData.get("account_id")) : null,
    customer_id: formData.get("customer_id") ? Number(formData.get("customer_id")) : null,
    recouped: formData.get("recouped") || "",
    ...(receiptUrl !== null ? { receipt_image_url: receiptUrl || null } : {}),
  }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

export async function deleteCost(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("fact_costs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

export async function recordCashflow(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const parsed = CashflowSchema.parse({
    org_id: orgId,
    record_date: formData.get("record_date"),
    account_id: formData.get("account_id"),
    balance: formData.get("balance"),
    notes: formData.get("notes"),
  });

  const { error } = await supabase.from("fact_cashflow").insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
