import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { InvoiceDetailClient } from "@/components/InvoiceDetailClient";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  const supabase = await createServerClient();

  const [{ data: invoice }, { data: lines }, { data: org }] = await Promise.all([
    supabase
      .from("fact_invoices")
      .select("id, invoice_number, amount, status, transaction_date, due_date, description, customer_id, dim_customers(id, name)")
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("fact_invoice_lines")
      .select("description, quantity, unit_price, line_total")
      .eq("invoice_id", invoiceId)
      .order("position"),
    supabase.from("organizations").select("currency").single(),
  ]);

  if (!invoice) notFound();

  const customer = invoice.dim_customers as unknown as { id: number; name: string } | null;

  return (
    <section className="space-y-4">
      <Breadcrumb crumbs={[
        { label: "Invoices", href: "/invoices" },
        { label: `Invoice ${invoice.invoice_number || `#${invoiceId}`}` },
      ]} />
      <InvoiceDetailClient
        invoice={{
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: Number(invoice.amount),
          status: invoice.status,
          transaction_date: invoice.transaction_date,
          due_date: invoice.due_date,
          description: (invoice as Record<string, unknown>).description as string | null ?? null,
          customer_id: invoice.customer_id,
          customer_name: customer?.name ?? `Customer #${invoice.customer_id}`,
        }}
        lines={(lines || []).map(l => ({
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          line_total: Number(l.line_total),
        }))}
        currency={org?.currency || "ZAR"}
      />
    </section>
  );
}
