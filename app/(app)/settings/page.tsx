import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { updateOrgSettings, seedDefaults } from "@/server-actions/settings";
import { SettingsDimensions } from "@/components/SettingsDimensions";
import { SettingsExtras } from "@/components/SettingsExtras";

export default async function SettingsPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: org }, { data: statuses }, { data: payTypes }, { data: costCats }, { data: accounts }] = await Promise.all([
    supabase.from("organizations").select("name, reg_no, vat_no, address, phone, email, bank_holder, bank_name, bank_account, bank_branch, currency, fiscal_year_start, logo_url, feature_flags").eq("id", orgId).single(),
    supabase.from("dim_statuses").select("id, name, category").order("id"),
    supabase.from("dim_payment_types").select("id, name, description").order("id"),
    supabase.from("dim_cost_categories").select("id, name, description").order("id"),
    supabase.from("dim_accounts").select("id, name, account_type").order("id"),
  ]);

  const labelCss = { color: "var(--muted2)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".5px", display: "block", marginBottom: 4 };
  const inputCss = "w-full px-3 py-2 rounded border outline-none text-sm focus:ring-1 focus:ring-[var(--accent)]";
  const inputStyle = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <section className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {/* Seed defaults */}
      <div className="rounded-lg p-4 mb-6 flex items-center justify-between" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <div>
          <p className="text-sm font-semibold">Seed Default Data</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>Populate default statuses, payment types, cost categories, and accounts</p>
        </div>
        <form action={seedDefaults}>
          <button className="px-4 py-2 rounded text-sm font-semibold transition-colors"
            style={{ background: "var(--card3)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            Seed Defaults
          </button>
        </form>
      </div>

      {/* Company Info */}
      <div className="rounded-lg overflow-hidden mb-6" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Company Information</h2>
        </div>
        <form action={updateOrgSettings} className="p-4 space-y-4" style={{ background: "var(--card2)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelCss}>Company Name</label>
              <input name="name" defaultValue={org?.name || ""} className={inputCss} style={inputStyle} />
            </div>
            <div>
              <label style={labelCss}>Currency</label>
              <select name="currency" defaultValue={org?.currency || "ZAR"} className={inputCss} style={inputStyle}>
                <option value="ZAR">ZAR (R)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label style={labelCss}>Financial Year Start</label>
              <select name="fiscal_year_start" defaultValue={org?.fiscal_year_start ?? 3} className={inputCss} style={inputStyle}>
                {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelCss}>Reg Number</label>
              <input name="reg_no" defaultValue={org?.reg_no || ""} className={inputCss} style={inputStyle} />
            </div>
            <div>
              <label style={labelCss}>VAT Number</label>
              <input name="vat_no" defaultValue={org?.vat_no || ""} className={inputCss} style={inputStyle} />
            </div>
            <div className="md:col-span-2">
              <label style={labelCss}>Address</label>
              <input name="address" defaultValue={org?.address || ""} className={inputCss} style={inputStyle} />
            </div>
            <div>
              <label style={labelCss}>Phone</label>
              <input name="phone" defaultValue={org?.phone || ""} className={inputCss} style={inputStyle} />
            </div>
            <div>
              <label style={labelCss}>Email</label>
              <input name="email" defaultValue={org?.email || ""} className={inputCss} style={inputStyle} />
            </div>
          </div>
          <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>Banking Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={labelCss}>Account Holder</label>
                <input name="bank_holder" defaultValue={org?.bank_holder || ""} className={inputCss} style={inputStyle} />
              </div>
              <div>
                <label style={labelCss}>Bank Name</label>
                <input name="bank_name" defaultValue={org?.bank_name || ""} className={inputCss} style={inputStyle} />
              </div>
              <div>
                <label style={labelCss}>Account Number</label>
                <input name="bank_account" defaultValue={org?.bank_account || ""} className={inputCss} style={inputStyle} />
              </div>
              <div>
                <label style={labelCss}>Branch Code</label>
                <input name="bank_branch" defaultValue={org?.bank_branch || ""} className={inputCss} style={inputStyle} />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button className="px-5 py-2 rounded text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}>Save Company Info</button>
          </div>
        </form>
      </div>

      <SettingsExtras
        orgId={orgId}
        logoUrl={org?.logo_url ?? null}
        featureFlags={(org?.feature_flags as Record<string, boolean>) ?? {}}
        aiSystemPrompt={(org?.feature_flags as Record<string, unknown>)?.ai_system_prompt as string ?? null}
      />

      <SettingsDimensions
        statuses={statuses || []}
        payTypes={payTypes || []}
        costCats={costCats || []}
        accounts={accounts || []}
      />
    </section>
  );
}
