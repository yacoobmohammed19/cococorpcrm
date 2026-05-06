import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";

type Params = { id: string };

function fmt(n: number, cur = "R") {
  return `${cur} ${Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function InvoicePrintPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: invoice }, { data: org }, { data: lines }] = await Promise.all([
    supabase
      .from("fact_invoices")
      .select("*, dim_customers(name, email, phone, reg_no, vat_no, contact_person), dim_payment_types(name)")
      .eq("id", invoiceId)
      .single(),
    supabase.from("organizations").select("*, logo_url").eq("id", orgId).single(),
    supabase
      .from("fact_invoice_lines")
      .select("description, quantity, unit_price, position, dim_products(name)")
      .eq("invoice_id", invoiceId)
      .order("position"),
  ]);

  if (!invoice) notFound();

  const customer = invoice.dim_customers as Record<string, string | null> | null;
  const cur = org?.currency === "ZAR" ? "R" : (org?.currency || "R");
  type Line = { description: string; quantity: number; unit_price: number; position: number; dim_products: { name: string } | null };
  const invoiceLines = (lines ?? []) as unknown as Line[];
  const lineTotal = invoiceLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const totalAmount = Number(invoice.amount);

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f0f0; margin: 0; padding: 24px; }
        @media print { body { background: #fff; padding: 0; } }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ maxWidth: 820, margin: "0 auto 16px", display: "flex", gap: 8 }}>
        <button onClick={() => window.print()}
          style={{ padding: "8px 20px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          🖨 Print / Save PDF
        </button>
        <button onClick={() => window.history.back()}
          style={{ padding: "8px 16px", background: "#fff", color: "#333", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          ← Back
        </button>
      </div>

      {/* Invoice document */}
      <div style={{ maxWidth: 820, margin: "0 auto", background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,.12)", borderRadius: 12 }}>

        {/* Header band */}
        <div style={{ background: "#1a1a2e", color: "#fff", padding: "32px 40px", borderRadius: "12px 12px 0 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              {(org as { logo_url?: string | null } | null)?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(org as { logo_url?: string }).logo_url} alt="Logo"
                  style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", marginBottom: 10, borderRadius: 4 }} />
              )}
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{org?.name || "Your Business"}</h1>
              {org?.reg_no && <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.7 }}>Reg No: {org.reg_no}</p>}
              {org?.vat_no && <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.7 }}>VAT No: {org.vat_no}</p>}
              {org?.address && <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.7 }}>{org.address}</p>}
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "#10b981", letterSpacing: -1 }}>INVOICE</p>
              <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, opacity: 0.9 }}>#{invoice.invoice_number || invoice.id}</p>
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderBottom: "1px solid #e5e5e5" }}>
          {/* Bill To */}
          <div style={{ padding: "24px 40px", borderRight: "1px solid #e5e5e5" }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Bill To</p>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>{customer?.name || "—"}</p>
            {customer?.contact_person && <p style={{ margin: "0 0 2px", fontSize: 12, color: "#555" }}>Attn: {customer.contact_person}</p>}
            {customer?.email && <p style={{ margin: "0 0 2px", fontSize: 12, color: "#555" }}>{customer.email}</p>}
            {customer?.phone && <p style={{ margin: "0 0 2px", fontSize: 12, color: "#555" }}>{customer.phone}</p>}
            {customer?.reg_no && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888" }}>Reg: {customer.reg_no}</p>}
            {customer?.vat_no && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888" }}>VAT: {customer.vat_no}</p>}
          </div>
          {/* Invoice details */}
          <div style={{ padding: "24px 40px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Invoice Details</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {([
                  ["Invoice Date", fdate(invoice.transaction_date)],
                  ["Due Date", fdate(invoice.due_date)],
                  ["Status", invoice.status],
                  (invoice.dim_payment_types as { name?: string } | null)?.name ? ["Payment Method", (invoice.dim_payment_types as { name?: string }).name] : null,
                ] as ([string, string] | null)[]).filter((r): r is [string, string] => r !== null).map(([l, v]) => (
                  <tr key={l}>
                    <td style={{ padding: "3px 0", color: "#888", width: "50%" }}>{l}</td>
                    <td style={{ padding: "3px 0", fontWeight: 600, color: "#1a1a2e" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Line items */}
        <div style={{ padding: "0 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #e5e5e5" }}>
                <th style={{ padding: "10px 40px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Description</th>
                <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", width: 80 }}>Qty</th>
                <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", width: 120 }}>Unit Price</th>
                <th style={{ padding: "10px 40px 10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", width: 120 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoiceLines.length > 0 ? invoiceLines.map((line, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "12px 40px" }}>
                    <span style={{ fontWeight: 500, color: "#1a1a2e" }}>{line.dim_products?.name || line.description}</span>
                    {line.dim_products?.name && line.description !== line.dim_products.name && (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888" }}>{line.description}</p>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#555" }}>{line.quantity}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#555", fontFamily: "monospace" }}>{fmt(line.unit_price, cur)}</td>
                  <td style={{ padding: "12px 40px 12px 16px", textAlign: "right", fontWeight: 600, color: "#1a1a2e", fontFamily: "monospace" }}>{fmt(line.quantity * line.unit_price, cur)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} style={{ padding: "20px 40px" }}>
                    <span style={{ fontWeight: 500, color: "#1a1a2e" }}>{invoice.description || "Services Rendered"}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 40px 24px", borderTop: "1px solid #e5e5e5" }}>
          <div style={{ minWidth: 260, marginTop: 16 }}>
            {invoiceLines.length > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: "#555" }}>
                <span>Subtotal</span>
                <span style={{ fontFamily: "monospace" }}>{fmt(lineTotal, cur)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#1a1a2e", borderRadius: 8, marginTop: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>TOTAL DUE</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: "#10b981", fontFamily: "monospace" }}>{fmt(totalAmount, cur)}</span>
            </div>
          </div>
        </div>

        {/* Bank details + footer */}
        {(org?.bank_name || org?.bank_account) && (
          <div style={{ padding: "20px 40px", borderTop: "1px solid #e5e5e5", background: "#f8f9fa", borderRadius: "0 0 12px 12px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Banking Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "4px 24px", fontSize: 12 }}>
              {[
                ["Bank", org.bank_name],
                ["Account Holder", org.bank_holder],
                ["Account Number", org.bank_account],
                ["Branch Code", org.bank_branch],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l as string}>
                  <span style={{ color: "#888" }}>{l}: </span>
                  <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <div style={{ padding: "16px 40px", borderTop: "1px solid #e5e5e5", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
            Thank you for your business · {org?.email || ""}{org?.phone ? ` · ${org.phone}` : ""}
          </p>
        </div>
      </div>
    </>
  );
}
