"use server";

import { revalidatePath } from "next/cache";
import { IncomeSchema, INCOME_TYPE_LABELS } from "@/lib/schemas/income";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

// Bank-ledger rows auto-created for an income entry are tagged with this
// reference so they can be kept in sync / removed when the income changes.
const bankRef = (incomeId: number) => `income:${incomeId}`;

function bankDescription(description: string | null | undefined, incomeType: string) {
  const d = (description || "").trim();
  return d || INCOME_TYPE_LABELS[incomeType] || "Other income";
}

export async function createIncome(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const parsed = IncomeSchema.parse({
    org_id: orgId,
    transaction_date: formData.get("transaction_date"),
    amount: formData.get("amount"),
    description: formData.get("description") || null,
    income_type: (formData.get("income_type") as string) || "other",
    account_id: formData.get("account_id") || null,
    reference: formData.get("reference") || null,
  });

  const { data: inserted, error } = await supabase
    .from("fact_income")
    .insert(parsed)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Auto-create the matching bank-ledger credit so the money movement shows in
  // the reconciliation ledger. Tagged via `reference` for later sync/cleanup.
  const { error: txnError } = await supabase.from("fact_bank_transactions").insert({
    org_id: orgId,
    account_id: parsed.account_id ?? null,
    txn_date: parsed.transaction_date,
    description: bankDescription(parsed.description, parsed.income_type),
    reference: bankRef(inserted.id),
    debit: 0,
    credit: parsed.amount,
    reconciled: false,
    notes: "Auto: other income",
  });
  if (txnError) throw new Error(txnError.message);

  revalidatePath("/accounting");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateIncome(id: number, formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const parsed = IncomeSchema.parse({
    org_id: orgId,
    transaction_date: formData.get("transaction_date"),
    amount: formData.get("amount"),
    description: formData.get("description") || null,
    income_type: (formData.get("income_type") as string) || "other",
    account_id: formData.get("account_id") || null,
    reference: formData.get("reference") || null,
  });

  const { error } = await supabase
    .from("fact_income")
    .update({
      transaction_date: parsed.transaction_date,
      amount: parsed.amount,
      description: parsed.description,
      income_type: parsed.income_type,
      account_id: parsed.account_id ?? null,
      reference: parsed.reference,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Keep the auto bank credit in sync with the income entry.
  await supabase
    .from("fact_bank_transactions")
    .update({
      account_id: parsed.account_id ?? null,
      txn_date: parsed.transaction_date,
      description: bankDescription(parsed.description, parsed.income_type),
      credit: parsed.amount,
    })
    .eq("reference", bankRef(id));

  revalidatePath("/accounting");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteIncome(id: number) {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("fact_income")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Remove the auto-created bank credit so it stops affecting the ledger/recon.
  await supabase.from("fact_bank_transactions").delete().eq("reference", bankRef(id));

  revalidatePath("/accounting");
  revalidatePath("/dashboard");
  return { ok: true };
}
