"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

function getInvoiceDates(startDate: string, endDate: string | null, frequency: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = endDate ? new Date(endDate + "T00:00:00") : null;
  const MAX = 60;

  while (dates.length < MAX) {
    if (end && current > end) break;
    dates.push(current.toISOString().slice(0, 10));

    switch (frequency) {
      case "weekly":    current.setDate(current.getDate() + 7);           break;
      case "monthly":   current.setMonth(current.getMonth() + 1);         break;
      case "quarterly": current.setMonth(current.getMonth() + 3);         break;
      case "annually":  current.setFullYear(current.getFullYear() + 1);   break;
      default: break;
    }

    // Safety: if no end date, cap at 12 periods
    if (!end && dates.length >= 12) break;
  }

  return dates;
}

export async function createSubscription(data: {
  customer_id: number;
  product_id?: number | null;
  description: string;
  amount: number;
  frequency: string;
  start_date: string;
  end_date?: string | null;
  payment_type_id?: number | null;
  invoice_prefix?: string;
}) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { data: sub, error } = await supabase
    .from("subscriptions")
    .insert({
      org_id: orgId,
      customer_id: data.customer_id,
      product_id: data.product_id || null,
      description: data.description,
      amount: data.amount,
      frequency: data.frequency,
      start_date: data.start_date,
      end_date: data.end_date || null,
      payment_type_id: data.payment_type_id || null,
      invoice_prefix: data.invoice_prefix || "SUB",
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const dates = getInvoiceDates(data.start_date, data.end_date || null, data.frequency);
  const prefix = data.invoice_prefix || "SUB";

  if (dates.length > 0) {
    const { error: invErr } = await supabase.from("fact_invoices").insert(
      dates.map((date, i) => ({
        org_id: orgId,
        customer_id: data.customer_id,
        invoice_number: `${prefix}-${sub.id}-${String(i + 1).padStart(3, "0")}`,
        description: data.description,
        amount: data.amount,
        status: "Pending",
        transaction_date: date,
        payment_type_id: data.payment_type_id || null,
      }))
    );
    if (invErr) throw new Error(invErr.message);
  }

  revalidatePath(`/customers/${data.customer_id}`);
  revalidatePath("/invoices");
}

export async function cancelSubscription(id: number, customerId: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/customers/${customerId}`);
}
