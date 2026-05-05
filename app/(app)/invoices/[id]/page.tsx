import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

type Params = { id: string };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const invoiceId = Number(id);
  const supabase = await createServerClient();

  const [{ data: invoice }, { data: lines }] = await Promise.all([
    supabase
      .from("fact_invoices")
      .select("*, dim_customers(name)")
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("fact_invoice_lines")
      .select("description, quantity, unit_price, line_total")
      .eq("invoice_id", invoiceId)
      .order("position"),
  ]);

  if (!invoice) notFound();

  return (
    <section className="space-y-4">
      <Breadcrumb crumbs={[{ label: "Invoices", href: "/invoices" }, { label: `Invoice #${invoice.invoice_number || invoice.id}` }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoice #{invoice.invoice_number}</h1>
        <Link className="rounded border border-[var(--border)] px-3 py-1 text-sm" href={`/invoices/${invoice.id}/print`}>
          Print view
        </Link>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
        <p>Customer: {invoice.dim_customers?.name ?? "-"}</p>
        <p>Date: {invoice.transaction_date}</p>
        <p>Status: {invoice.status}</p>
        <p>Amount: R{Number(invoice.amount).toFixed(2)}</p>
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-medium">Lines</h2>
        {(lines ?? []).map((line, idx) => (
          <div key={`${line.description}-${idx}`} className="rounded border border-[var(--border)] bg-[var(--card)] p-2 text-sm">
            <p>{line.description}</p>
            <p className="text-[var(--muted)]">
              {Number(line.quantity).toFixed(2)} x R{Number(line.unit_price).toFixed(2)} = R
              {Number(line.line_total).toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
