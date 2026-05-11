"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function createQuote(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const linesRaw = String(formData.get("lines") ?? "[]");
  let lines: { description: string; quantity: number; unit_price: number; product_id?: number }[] = [];
  try { lines = JSON.parse(linesRaw); } catch { /* ignore */ }

  const amount = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  const { data: quote, error } = await supabase.from("fact_quotes").insert({
    org_id: orgId,
    customer_id: Number(formData.get("customer_id")),
    quote_number: formData.get("quote_number"),
    status: formData.get("status") || "Draft",
    valid_until: formData.get("valid_until") || null,
    notes: formData.get("notes") || null,
    amount,
  }).select("id").single();

  if (error) throw new Error(error.message);

  if (lines.length > 0) {
    await supabase.from("fact_quote_lines").insert(
      lines.map((l, idx) => ({
        quote_id: quote.id,
        product_id: l.product_id || null,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        position: idx,
      }))
    );
  }

  revalidatePath("/quotes");
}

export async function updateQuoteStatus(id: number, status: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_quotes").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/quotes");
  revalidatePath("/customers", "layout");
}

export async function deleteQuote(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_quotes")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/quotes");
}

export async function convertQuoteToInvoice(quoteId: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { data: quote } = await supabase.from("fact_quotes")
    .select("*, fact_quote_lines(*)")
    .eq("id", quoteId).single();

  if (!quote) throw new Error("Quote not found");

  const { data: invoice, error } = await supabase.from("fact_invoices").insert({
    org_id: orgId,
    customer_id: quote.customer_id,
    invoice_number: `INV-${quote.quote_number}`,
    transaction_date: new Date().toISOString().slice(0, 10),
    amount: quote.amount,
    status: "Pending",
    description: `Converted from ${quote.quote_number}`,
  }).select("id").single();

  if (error) throw new Error(error.message);

  const lines = (quote.fact_quote_lines as { description: string; quantity: number; unit_price: number; position: number }[]) || [];
  if (lines.length > 0) {
    await supabase.from("fact_invoice_lines").insert(
      lines.map(l => ({
        invoice_id: invoice.id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        position: l.position,
      }))
    );
  }

  await supabase.from("fact_quotes").update({ status: "Invoiced" }).eq("id", quoteId);
  revalidatePath("/quotes");
  revalidatePath("/invoices");
  revalidatePath("/customers", "layout");
}
