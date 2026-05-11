"use server";

import { revalidatePath } from "next/cache";
import { InvoiceLineSchema, InvoiceSchema } from "@/lib/schemas/invoices";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function createInvoice(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const linesRaw = String(formData.get("lines") ?? "[]");
  let linesInput: unknown[] = [];
  try {
    linesInput = JSON.parse(linesRaw);
  } catch {
    throw new Error("Invalid invoice lines payload");
  }

  const parsed = InvoiceSchema.parse({
    org_id: orgId,
    customer_id: formData.get("customer_id"),
    transaction_date: formData.get("transaction_date"),
    invoice_number: formData.get("invoice_number"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    status: formData.get("status"),
    due_date: formData.get("due_date"),
  });

  const lines = linesInput.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("Invalid invoice line entry");
    }

    return InvoiceLineSchema.parse({
      ...(item as Record<string, unknown>),
      position: index,
    });
  });

  const { data: invoice, error } = await supabase
    .from("fact_invoices")
    .insert({
      ...parsed,
      description: parsed.description || null,
      due_date: parsed.due_date || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (lines.length > 0) {
    const { error: lineError } = await supabase.from("fact_invoice_lines").insert(
      lines.map((line) => ({
        invoice_id: invoice.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        position: line.position,
        product_id: (line as Record<string, unknown>).product_id ? Number((line as Record<string, unknown>).product_id) : null,
      })),
    );
    if (lineError) throw new Error(lineError.message);
  }

  revalidatePath("/invoices");
}

export async function deleteInvoice(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("fact_invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
}

export async function updateInvoiceStatus(id: number, status: string) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("fact_invoices")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/customers", "layout");
}

export async function bulkDeleteInvoices(ids: number[]) {
  if (ids.length === 0) return;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("fact_invoices")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
}

export async function updateInvoice(id: number, formData: FormData) {
  const supabase = await createServerClient();

  const linesRaw = String(formData.get("lines") ?? "[]");
  let lines: { description: string; quantity: number; unit_price: number }[] = [];
  try { lines = JSON.parse(linesRaw); } catch { /* ignore */ }

  const { error } = await supabase.from("fact_invoices").update({
    customer_id: Number(formData.get("customer_id")),
    transaction_date: formData.get("transaction_date"),
    invoice_number: formData.get("invoice_number"),
    description: formData.get("description") || null,
    amount: Number(formData.get("amount")),
    status: formData.get("status"),
    due_date: formData.get("due_date") || null,
    payment_type_id: formData.get("payment_type_id") ? Number(formData.get("payment_type_id")) : null,
  }).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("fact_invoice_lines").delete().eq("invoice_id", id);
  if (lines.length > 0) {
    await supabase.from("fact_invoice_lines").insert(
      lines.map((l, idx) => ({
        invoice_id: id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        position: idx,
        product_id: (l as Record<string, unknown>).product_id ? Number((l as Record<string, unknown>).product_id) : null,
      }))
    );
  }

  revalidatePath("/invoices");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/customers", "layout");
}

export async function restoreInvoice(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("fact_invoices")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
}
