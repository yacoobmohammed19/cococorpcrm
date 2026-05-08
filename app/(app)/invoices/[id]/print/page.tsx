import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { InvoicePrintClient } from "@/components/InvoicePrintClient";

type Params = { id: string };

type Line = {
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
  dim_products: { name: string } | null;
};

export default async function InvoicePrintPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: invoice }, { data: org }, { data: rawLines }] = await Promise.all([
    supabase
      .from("fact_invoices")
      .select("*, dim_customers(name, email, phone, reg_no, vat_no, contact_person), dim_payment_types(name)")
      .eq("id", invoiceId)
      .single(),
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase
      .from("fact_invoice_lines")
      .select("description, quantity, unit_price, position, dim_products(name)")
      .eq("invoice_id", invoiceId)
      .order("position"),
  ]);

  if (!invoice) notFound();

  const lines = (rawLines ?? []) as unknown as Line[];

  return (
    <div style={{ background: "#0c0a1d", minHeight: "100vh", padding: "0 0 40px" }}>
      <InvoicePrintClient
        invoice={invoice as Parameters<typeof InvoicePrintClient>[0]["invoice"]}
        org={org}
        lines={lines}
      />
    </div>
  );
}
