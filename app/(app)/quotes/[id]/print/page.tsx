import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { QuotePrintClient } from "@/components/QuotePrintClient";

type Params = { id: string };

type QLine = {
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
  dim_products: { name: string } | null;
};

export default async function QuotePrintPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const quoteId = Number(id);
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: quote }, { data: org }, { data: rawLines }] = await Promise.all([
    supabase
      .from("fact_quotes")
      .select("*, dim_customers(name, email, phone, reg_no, vat_no, contact_person)")
      .eq("id", quoteId)
      .single(),
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase
      .from("fact_quote_lines")
      .select("description, quantity, unit_price, position, dim_products(name)")
      .eq("quote_id", quoteId)
      .order("position"),
  ]);

  if (!quote) notFound();

  const lines = (rawLines ?? []) as unknown as QLine[];

  return (
    <div style={{ background: "#0c0a1d", minHeight: "100vh", padding: "0 0 40px" }}>
      <QuotePrintClient
        quote={quote as Parameters<typeof QuotePrintClient>[0]["quote"]}
        org={org}
        lines={lines}
      />
    </div>
  );
}
