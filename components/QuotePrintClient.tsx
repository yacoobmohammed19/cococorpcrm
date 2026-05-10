"use client";

import { useState } from "react";

interface Customer {
  name: string;
  email?: string | null;
  phone?: string | null;
  reg_no?: string | null;
  vat_no?: string | null;
  contact_person?: string | null;
}
interface Org {
  name?: string | null;
  reg_no?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bank_holder?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_branch?: string | null;
  currency?: string | null;
  logo_url?: string | null;
}
interface QuoteLine {
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
  dim_products: { name: string } | null;
}
interface Quote {
  id: number;
  quote_number: string;
  customer_id: number;
  status: string;
  amount: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  dim_customers: Customer | null;
}

interface Props {
  quote: Quote;
  org: Org | null;
  lines: QuoteLine[];
}

interface Row { desc: string; qty: number; rate: number; }

function fmt(n: number) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fdate(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

const fieldBase: React.CSSProperties = {
  border: "none",
  borderBottom: "1px dashed transparent",
  background: "transparent",
  padding: "2px 4px",
  fontSize: "inherit",
  color: "inherit",
  fontFamily: "inherit",
  width: "100%",
  outline: "none",
};

function Field({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="inv-field"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={fieldBase}
    />
  );
}

export function QuotePrintClient({ quote, org, lines }: Props) {
  const customer = quote.dim_customers as Customer | null;
  const cur = org?.currency && org.currency !== "ZAR" ? org.currency : "R";

  const seedRows = (): Row[] => {
    if (lines.length > 0) {
      return lines.map(l => ({
        desc: l.dim_products?.name
          ? l.description !== l.dim_products.name
            ? `${l.dim_products.name} — ${l.description}`
            : l.dim_products.name
          : l.description,
        qty: l.quantity,
        rate: l.unit_price,
      }));
    }
    const amtIncl = Number(quote.amount) || 0;
    return [{ desc: quote.notes || "Service", qty: 1, rate: +(amtIncl / 1.15).toFixed(2) }];
  };

  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(15);
  const [rows, setRows] = useState<Row[]>(seedRows);

  const [quoteNumber, setQuoteNumber] = useState(quote.quote_number);
  const [quoteDate, setQuoteDate] = useState(fdate(quote.created_at));
  const [validUntil, setValidUntil] = useState(fdate(quote.valid_until));
  const [custName, setCustName] = useState(customer?.name || "");
  const [contactName, setContactName] = useState(customer?.contact_person || "");
  const [contactPhone, setContactPhone] = useState(customer?.phone || "");
  const [custVatNo, setCustVatNo] = useState(customer?.vat_no || "");
  const [coName, setCoName] = useState(org?.name || "");
  const [coAddress, setCoAddress] = useState(org?.address || "");
  const [coPhone, setCoPhone] = useState(org?.phone || "");
  const [coEmail, setCoEmail] = useState(org?.email || "");
  const [coRegNo, setCoRegNo] = useState(org?.reg_no || "");
  const [bankHolder, setBankHolder] = useState(org?.bank_holder || "");
  const [bankName, setBankName] = useState(org?.bank_name || "");
  const [bankAccount, setBankAccount] = useState(org?.bank_account || "");
  const [bankBranch, setBankBranch] = useState(org?.bank_branch || "");

  const updateRow = (i: number, key: keyof Row, val: string | number) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  };

  const subtotal = rows.reduce((s, r) => s + r.qty * r.rate, 0);
  const vat = vatEnabled ? subtotal * vatRate / 100 : 0;
  const total = subtotal + vat;

  const tdLabel: React.CSSProperties = { fontWeight: 700, padding: "5px 12px 5px 0", color: "#111", verticalAlign: "top", whiteSpace: "nowrap" };
  const tdValue: React.CSSProperties = { verticalAlign: "top", width: "100%" };

  return (
    <>
      <style>{`
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden !important; }
          .inv-doc, .inv-doc * { visibility: visible !important; }
          .inv-doc { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
          .inv-toolbar { display: none !important; }
          .inv-hint { display: none !important; }
          .inv-add-row { display: none !important; }
          .inv-del-row { display: none !important; }
          .inv-vat-toggle { display: none !important; }
          .inv-field { border: none !important; background: transparent !important; }
          input[type="number"].inv-field { border: none !important; background: transparent !important; }
        }
        .inv-field:hover { border-bottom-color: #ccc !important; background: #fafafa !important; }
        .inv-field:focus { border-bottom-color: #10b981 !important; background: #fff8e6 !important; outline: none !important; }
        .inv-field::placeholder { color: #bbb; font-style: italic; }
      `}</style>

      {/* Toolbar */}
      <div className="inv-toolbar" style={{ background: "#1a1a2e", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ color: "#c4c0e0", fontSize: 13, fontWeight: 600 }}>📋 Quote Preview</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setRows(r => [...r, { desc: "", qty: 1, rate: 0 }])}
            style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #3d3878", background: "#171535", color: "#f0f0fc", fontSize: 12, cursor: "pointer" }}>
            + Line Item
          </button>
          <button onClick={() => window.print()}
            style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            🖨️ Print / Save PDF
          </button>
          <button onClick={() => window.history.back()}
            style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #3d3878", background: "#171535", color: "#f0f0fc", fontSize: 12, cursor: "pointer" }}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="inv-doc" style={{ background: "#fff", color: "#111", width: 720, maxWidth: "100%", margin: "0 auto", padding: 40, fontFamily: "'DM Sans', 'Segoe UI', Arial, sans-serif" }}>

        {/* Edit hint */}
        <div className="inv-hint" style={{ fontSize: 11, color: "#10b981", background: "#f0fdf4", border: "1px solid #10b981", borderRadius: 4, padding: "6px 10px", marginBottom: 20, textAlign: "center", fontWeight: 500 }}>
          ✏️ Click any field below to edit before printing
        </div>

        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          {org?.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={org.logo_url} alt="Logo" style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain" }} />
            : <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>{coName || "Your Business"}</div>
          }
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111", marginBottom: 28 }}>Quote</h1>

        {/* Two-column info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 36 }}>
          {/* Left: Quote # and Date */}
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", color: "#333", tableLayout: "fixed" }}>
            <colgroup><col style={{ width: 130 }} /><col /></colgroup>
            <tbody>
              <tr><td style={tdLabel}>Quote</td><td style={tdValue}></td></tr>
              <tr>
                <td style={tdLabel}>Quote Number</td>
                <td style={tdValue}><Field value={quoteNumber} onChange={setQuoteNumber} placeholder="QUO-001" /></td>
              </tr>
              <tr>
                <td style={tdLabel}>Quote Date</td>
                <td style={tdValue}><Field value={quoteDate} onChange={setQuoteDate} placeholder="YYYY.MM.DD" /></td>
              </tr>
              <tr>
                <td style={tdLabel}>Valid Until</td>
                <td style={tdValue}><Field value={validUntil} onChange={setValidUntil} placeholder="YYYY.MM.DD" /></td>
              </tr>
            </tbody>
          </table>
          {/* Right: Customer info */}
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", color: "#333", tableLayout: "fixed" }}>
            <colgroup><col style={{ width: 130 }} /><col /></colgroup>
            <tbody>
              <tr>
                <td style={tdLabel}>Customer</td>
                <td style={tdValue}><Field value={custName} onChange={setCustName} placeholder="Business name" /></td>
              </tr>
              <tr>
                <td style={tdLabel}>Name</td>
                <td style={tdValue}><Field value={contactName} onChange={setContactName} placeholder="Contact person" /></td>
              </tr>
              <tr>
                <td style={tdLabel}>Contact Number</td>
                <td style={tdValue}><Field value={contactPhone} onChange={setContactPhone} placeholder="Phone" /></td>
              </tr>
              <tr>
                <td style={tdLabel}>VAT Number</td>
                <td style={tdValue}><Field value={custVatNo} onChange={setCustVatNo} placeholder="VAT number" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Line items table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={{ background: "#1a1a2e", color: "#fff", padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", width: "45%" }}>Item</th>
              <th style={{ background: "#1a1a2e", color: "#fff", padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", width: "12%" }}>Qty</th>
              <th style={{ background: "#1a1a2e", color: "#fff", padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", width: "20%" }}>Price (Excl. VAT)</th>
              <th style={{ background: "#1a1a2e", color: "#fff", padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", width: "20%" }}>Amount (Excl. VAT)</th>
              <th style={{ background: "#1a1a2e", color: "#fff", padding: 0, width: 32 }} className="inv-del-row"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "10px 12px" }}>
                  <input className="inv-field" value={r.desc} onChange={e => updateRow(i, "desc", e.target.value)}
                    placeholder="Item description" style={{ ...fieldBase, width: "100%" }} />
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <input className="inv-field" type="number" value={r.qty} min={0.01} step={0.01}
                    onChange={e => updateRow(i, "qty", Number(e.target.value) || 1)}
                    style={{ ...fieldBase, textAlign: "right", width: 60 }} />
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <input className="inv-field" type="number" value={r.rate} min={0} step={0.01}
                    onChange={e => updateRow(i, "rate", Number(e.target.value) || 0)}
                    style={{ ...fieldBase, textAlign: "right", width: 90 }} />
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                  {cur} {fmt(r.qty * r.rate)}
                </td>
                <td style={{ padding: "4px 2px", textAlign: "center" }} className="inv-del-row">
                  <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, padding: 2 }}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add row */}
        <button className="inv-add-row" onClick={() => setRows(r => [...r, { desc: "", qty: 1, rate: 0 }])}
          style={{ width: "100%", padding: 8, background: "transparent", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", fontSize: 12, color: "#888", marginBottom: 8 }}>
          + Add line item
        </button>

        {/* VAT toggle */}
        <div className="inv-vat-toggle" style={{ display: "flex", alignItems: "center", gap: 12, background: "#f8f9fa", border: "1px solid #ddd", borderRadius: 6, padding: "10px 14px", marginBottom: 8, fontSize: 12, color: "#555" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={vatEnabled} onChange={e => setVatEnabled(e.target.checked)} />
            Include VAT
          </label>
          <span>Rate: <input type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))}
            style={{ width: 50, border: "1px solid #ccc", borderRadius: 4, padding: "2px 6px", fontSize: 12 }} />%</span>
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
          <div style={{ width: 260 }}>
            {vatEnabled && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid #eee" }}>
                <span style={{ color: "#666" }}>Subtotal (Excl. VAT)</span>
                <span style={{ fontWeight: 600 }}>{cur} {fmt(subtotal)}</span>
              </div>
            )}
            {vatEnabled && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid #eee" }}>
                <span style={{ color: "#666" }}>VAT ({vatRate}%)</span>
                <span style={{ fontWeight: 600 }}>{cur} {fmt(vat)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 6px", borderTop: "2px solid #10b981", marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: "#111", fontSize: vatEnabled ? 14 : 16 }}>Total{vatEnabled ? " (Incl. VAT)" : ""}</span>
              <span style={{ color: "#10b981", fontSize: 16, fontWeight: 700 }}>{cur} {fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Company + Banking footer */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 48, paddingTop: 24, borderTop: "1px solid #ddd", fontSize: 13 }}>
          <div>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", color: "#444", tableLayout: "fixed", lineHeight: 1.7 }}>
              <colgroup><col style={{ width: 110 }} /><col /></colgroup>
              <tbody>
                {([
                  ["Company", coName, setCoName, "Company name"],
                  ["Address", coAddress, setCoAddress, "Street address"],
                  ["Contact", coPhone, setCoPhone, "Phone"],
                  ["Email", coEmail, setCoEmail, "Email"],
                  ["Enterprise No", coRegNo, setCoRegNo, "Registration number"],
                ] as [string, string, (v: string) => void, string][]).map(([l, v, set, ph]) => (
                  <tr key={l}>
                    <td style={{ fontWeight: 700, color: "#111", padding: "3px 8px 3px 0", verticalAlign: "top" }}>{l}</td>
                    <td style={{ verticalAlign: "top" }}><Field value={v} onChange={set} placeholder={ph} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ background: "#e8e8e8", padding: "9px 14px", fontWeight: 700, color: "#111", fontSize: 13, borderRadius: "4px 4px 0 0" }}>Banking Details:</div>
            <div style={{ border: "1px solid #ddd", borderTop: "none", borderRadius: "0 0 4px 4px", padding: 14 }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", color: "#444", tableLayout: "fixed", lineHeight: 1.7 }}>
                <colgroup><col style={{ width: 120 }} /><col /></colgroup>
                <tbody>
                  {([
                    ["Account Holder", bankHolder, setBankHolder, "Account holder"],
                    ["Bank", bankName, setBankName, "Bank name"],
                    ["Account Number", bankAccount, setBankAccount, "Account number"],
                    ["Branch Code", bankBranch, setBankBranch, "Branch code"],
                  ] as [string, string, (v: string) => void, string][]).map(([l, v, set, ph]) => (
                    <tr key={l}>
                      <td style={{ fontWeight: 700, color: "#111", padding: "3px 8px 3px 0", verticalAlign: "top" }}>{l}</td>
                      <td style={{ verticalAlign: "top" }}><Field value={v} onChange={set} placeholder={ph} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 36, fontSize: 12, color: "#777", paddingTop: 16, borderTop: "1px solid #eee" }}>
          Thank you for your business!
        </div>
      </div>
    </>
  );
}
