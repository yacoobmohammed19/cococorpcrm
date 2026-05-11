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
  vat_no?: string | null;
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
interface InvLine {
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
  dim_products: { name: string } | null;
}
interface Invoice {
  id: number;
  invoice_number?: string | null;
  transaction_date: string;
  due_date?: string | null;
  amount: number;
  status: string;
  description?: string | null;
  reference?: string | null;
  dim_customers: Customer | null;
  dim_payment_types: { name?: string } | null;
}

interface Props {
  invoice: Invoice;
  org: Org | null;
  lines: InvLine[];
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

export function InvoicePrintClient({ invoice, org, lines }: Props) {
  const customer = invoice.dim_customers as Customer | null;
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
    const amtIncl = Number(invoice.amount) || 0;
    return [{ desc: invoice.description || "Service", qty: 1, rate: +(amtIncl / 1.15).toFixed(2) }];
  };

  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(15);
  const [rows, setRows] = useState<Row[]>(seedRows);
  const [invNumber, setInvNumber] = useState(invoice.invoice_number || `INV-${invoice.id}`);
  const [invDate, setInvDate] = useState(fdate(invoice.transaction_date));
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
  const [payRef, setPayRef] = useState(invoice.reference || "");

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
        @page { size: A4 portrait; margin: 12mm 15mm; }

        /* ── PRINT: hide everything except the document ── */
        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * { visibility: hidden !important; }
          .inv-doc, .inv-doc * { visibility: visible !important; }
          .inv-doc {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .inv-totals { break-inside: avoid !important; page-break-inside: avoid !important; }
          .inv-footer-grid { break-inside: avoid !important; page-break-inside: avoid !important; }
          /* hide all UI chrome */
          .inv-no-print { display: none !important; }
          /* make every input/select look like plain text */
          .inv-doc input,
          .inv-doc select,
          .inv-doc textarea {
            border: none !important;
            border-bottom: none !important;
            background: transparent !important;
            -webkit-appearance: none;
            appearance: none;
            padding: 0 !important;
          }
          /* hide number spinners */
          .inv-doc input[type="number"]::-webkit-inner-spin-button,
          .inv-doc input[type="number"]::-webkit-outer-spin-button { display: none !important; }
          /* hide the delete-button column */
          .inv-del-col { display: none !important; }
        }

        /* ── SCREEN: document card ── */
        .inv-doc {
          background: #fff;
          color: #111;
          width: 760px;
          max-width: 100%;
          margin: 0 auto;
          padding: 48px;
          font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif;
        }

        /* ── RESPONSIVE GRIDS ── */
        .inv-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 36px;
        }
        .inv-footer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid #ddd;
          font-size: 13px;
        }
        .inv-lines-wrap { overflow-x: auto; }

        @media screen and (max-width: 640px) {
          .inv-doc { padding: 20px; }
          .inv-info-grid { grid-template-columns: 1fr; gap: 16px; }
          .inv-footer-grid { grid-template-columns: 1fr; gap: 20px; }
        }

        /* ── FIELDS ── */
        .inv-field:hover { border-bottom-color: #ccc !important; background: #fafafa !important; }
        .inv-field:focus { border-bottom-color: #10b981 !important; background: #fff8e6 !important; outline: none !important; }
        .inv-field::placeholder { color: #bbb; font-style: italic; }

        /* ── TOOLBAR ── */
        .inv-toolbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #1a1a2e;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .inv-toolbar-btns { display: flex; gap: 8px; flex-wrap: wrap; }
        @media screen and (max-width: 480px) {
          .inv-toolbar { padding: 8px 12px; }
          .inv-toolbar-btns button { padding: 6px 10px !important; font-size: 11px !important; }
        }
      `}</style>

      {/* Sticky toolbar — hidden on print via visibility:hidden on body */}
      <div className="inv-toolbar">
        <span style={{ color: "#c4c0e0", fontSize: 13, fontWeight: 600 }}>🧾 Invoice Preview</span>
        <div className="inv-toolbar-btns">
          <button onClick={() => setRows(r => [...r, { desc: "", qty: 1, rate: 0 }])}
            style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #3d3878", background: "#171535", color: "#f0f0fc", fontSize: 12, cursor: "pointer" }}>
            + Line
          </button>
          <button onClick={() => window.print()}
            style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            🖨️ Print / PDF
          </button>
          <button onClick={() => window.history.back()}
            style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #3d3878", background: "#171535", color: "#f0f0fc", fontSize: 12, cursor: "pointer" }}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="inv-doc">

        {/* Edit hint — screen only */}
        <div className="inv-no-print" style={{ fontSize: 11, color: "#10b981", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "6px 10px", marginBottom: 24, textAlign: "center", fontWeight: 500 }}>
          ✏️ Click any field to edit before printing
        </div>

        {/* Logo / company name */}
        <div style={{ marginBottom: 24 }}>
          {org?.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={org.logo_url} alt="Logo" style={{ maxHeight: 56, maxWidth: 200, objectFit: "contain" }} />
            : <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{coName || "Your Business"}</div>
          }
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111", marginBottom: 28, letterSpacing: -0.5 }}>Invoice</h1>

        {/* Two-column info grid — stacks on mobile */}
        <div className="inv-info-grid">
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", color: "#333" }}>
            <tbody>
              <tr><td colSpan={2} style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#999", paddingBottom: 6 }}>Invoice Details</td></tr>
              <tr>
                <td style={tdLabel}>Invoice #</td>
                <td style={tdValue}><Field value={invNumber} onChange={setInvNumber} placeholder="INV-001" /></td>
              </tr>
              <tr>
                <td style={tdLabel}>Date</td>
                <td style={tdValue}><Field value={invDate} onChange={setInvDate} placeholder="YYYY.MM.DD" /></td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", color: "#333" }}>
            <tbody>
              <tr><td colSpan={2} style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#999", paddingBottom: 6 }}>Billed To</td></tr>
              <tr>
                <td style={tdLabel}>Company</td>
                <td style={tdValue}><Field value={custName} onChange={setCustName} placeholder="Business name" /></td>
              </tr>
              <tr>
                <td style={tdLabel}>Contact</td>
                <td style={tdValue}><Field value={contactName} onChange={setContactName} placeholder="Contact person" /></td>
              </tr>
              <tr>
                <td style={tdLabel}>Phone</td>
                <td style={tdValue}><Field value={contactPhone} onChange={setContactPhone} placeholder="Phone" /></td>
              </tr>
              <tr>
                <td style={tdLabel}>VAT No.</td>
                <td style={tdValue}><Field value={custVatNo} onChange={setCustVatNo} placeholder="VAT number" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Line items — horizontally scrollable on mobile */}
        <div className="inv-lines-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12, minWidth: 480 }}>
            <thead>
              <tr>
                {[["Item", "47%", "left"], ["Qty", "10%", "right"], ["Price (excl. VAT)", "20%", "right"], ["Amount (excl. VAT)", "23%", "right"]].map(([h, w, a]) => (
                  <th key={h} style={{ background: "#1a1a2e", color: "#fff", padding: "10px 12px", textAlign: a as "left" | "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", width: w }}>{h}</th>
                ))}
                <th className="inv-del-col" style={{ background: "#1a1a2e", padding: 0, width: 32 }}></th>
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
                      style={{ ...fieldBase, textAlign: "right", width: 50 }} />
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <input className="inv-field" type="number" value={r.rate} min={0} step={0.01}
                      onChange={e => updateRow(i, "rate", Number(e.target.value) || 0)}
                      style={{ ...fieldBase, textAlign: "right", width: 80 }} />
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                    {cur} {fmt(r.qty * r.rate)}
                  </td>
                  <td className="inv-del-col" style={{ padding: "4px 2px", textAlign: "center" }}>
                    <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, padding: 2 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row — screen only */}
        <button className="inv-no-print" onClick={() => setRows(r => [...r, { desc: "", qty: 1, rate: 0 }])}
          style={{ width: "100%", padding: 8, background: "transparent", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", fontSize: 12, color: "#888", marginBottom: 8 }}>
          + Add line item
        </button>

        {/* VAT toggle — screen only */}
        <div className="inv-no-print" style={{ display: "flex", alignItems: "center", gap: 12, background: "#f8f9fa", border: "1px solid #ddd", borderRadius: 6, padding: "10px 14px", marginBottom: 8, fontSize: 12, color: "#555", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={vatEnabled} onChange={e => setVatEnabled(e.target.checked)} />
            Include VAT
          </label>
          <span>Rate: <input type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))}
            style={{ width: 50, border: "1px solid #ccc", borderRadius: 4, padding: "2px 6px", fontSize: 12 }} />%</span>
        </div>

        {/* Totals */}
        <div className="inv-totals" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
          <div style={{ width: 280, maxWidth: "100%" }}>
            {vatEnabled && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13, borderBottom: "1px solid #eee" }}>
                <span style={{ color: "#666" }}>Subtotal (excl. VAT)</span>
                <span style={{ fontWeight: 600 }}>{cur} {fmt(subtotal)}</span>
              </div>
            )}
            {vatEnabled && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13, borderBottom: "1px solid #eee" }}>
                <span style={{ color: "#666" }}>VAT ({vatRate}%)</span>
                <span style={{ fontWeight: 600 }}>{cur} {fmt(vat)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 6px", borderTop: "2px solid #10b981", marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: "#111", fontSize: 15 }}>Total{vatEnabled ? " (incl. VAT)" : ""}</span>
              <span style={{ color: "#10b981", fontSize: 17, fontWeight: 700 }}>{cur} {fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Company + Banking footer — stacks on mobile, no page-break on print */}
        <div className="inv-footer-grid">
          <div>
            <p style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 8 }}>From</p>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", color: "#444", lineHeight: 1.8 }}>
              <tbody>
                {([
                  ["Company", coName, setCoName, "Company name"],
                  ["Address", coAddress, setCoAddress, "Street address"],
                  ["Phone", coPhone, setCoPhone, "Phone"],
                  ["Email", coEmail, setCoEmail, "Email"],
                  ["Reg No.", coRegNo, setCoRegNo, "Registration number"],
                ] as [string, string, (v: string) => void, string][]).map(([l, v, set, ph]) => (
                  <tr key={l}>
                    <td style={{ fontWeight: 700, color: "#111", paddingRight: 10, verticalAlign: "top", whiteSpace: "nowrap", width: 90 }}>{l}</td>
                    <td style={{ verticalAlign: "top" }}><Field value={v} onChange={set} placeholder={ph} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ background: "#1a1a2e", padding: "9px 14px", fontWeight: 700, color: "#fff", fontSize: 12, borderRadius: "4px 4px 0 0", textTransform: "uppercase", letterSpacing: 1 }}>Banking Details</div>
            <div style={{ border: "1px solid #ddd", borderTop: "none", borderRadius: "0 0 4px 4px", padding: 14 }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", color: "#444", lineHeight: 1.8 }}>
                <tbody>
                  {([
                    ["Holder", bankHolder, setBankHolder, "Account holder"],
                    ["Bank", bankName, setBankName, "Bank name"],
                    ["Account", bankAccount, setBankAccount, "Account number"],
                    ["Branch", bankBranch, setBankBranch, "Branch code"],
                    ["Reference", payRef, setPayRef, invoice.invoice_number || `INV-${invoice.id}`],
                  ] as [string, string, (v: string) => void, string][]).map(([l, v, set, ph]) => (
                    <tr key={l}>
                      <td style={{ fontWeight: 700, color: "#111", paddingRight: 10, verticalAlign: "top", whiteSpace: "nowrap", width: 80 }}>{l}</td>
                      <td style={{ verticalAlign: "top" }}><Field value={v} onChange={set} placeholder={ph} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Thank you */}
        <div style={{ textAlign: "center", marginTop: 36, fontSize: 12, color: "#999", paddingTop: 16, borderTop: "1px solid #eee" }}>
          Thank you for your business!
        </div>
      </div>
    </>
  );
}
