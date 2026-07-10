"use client";

import { useState, useRef, useTransition } from "react";
import {
  Building2, Palette, Layers, Database, Sparkles, Upload, X,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import {
  updateOrgSettings, seedDefaults, updateLogoUrl,
  updateFeatureFlags, updateAiSystemPrompt,
} from "@/server-actions/settings";
import { SettingsDimensions } from "@/components/SettingsDimensions";
import { SettingsAppearance } from "@/components/SettingsAppearance";

// ── Types ─────────────────────────────────────────────────────────────────────

type Org = {
  name: string | null; reg_no: string | null; vat_no: string | null;
  address: string | null; phone: string | null; email: string | null;
  bank_holder: string | null; bank_name: string | null; bank_account: string | null;
  bank_branch: string | null; currency: string | null; fiscal_year_start: number | null;
  logo_url: string | null; feature_flags: Record<string, unknown> | null;
};
type Status = { id: number; name: string; category: string | null };
type PayType = { id: number; name: string; description: string | null };
type CostCat = { id: number; name: string; description: string | null };
type Account = { id: number; name: string; account_type: string | null };
type InvoiceStatus = { id: number; name: string; color: string; position: number };

interface Props {
  org: Org | null;
  orgId: string;
  statuses: Status[];
  payTypes: PayType[];
  costCats: CostCat[];
  accounts: Account[];
  invoiceStatuses: InvoiceStatus[];
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "general",    label: "General",    Icon: Building2 },
  { key: "appearance", label: "Appearance", Icon: Palette   },
  { key: "modules",    label: "Modules",    Icon: Layers    },
  { key: "data",       label: "Data",       Icon: Database  },
  { key: "ai",         label: "AI",         Icon: Sparkles  },
] as const;
type TabKey = typeof TABS[number]["key"];

// ── Feature flags ─────────────────────────────────────────────────────────────

const FEATURE_DEFS = [
  { key: "leads",          label: "Leads",            desc: "Lead pipeline and opportunity tracking" },
  { key: "products",       label: "Products / Services", desc: "Product catalogue and pricing" },
  { key: "costs",          label: "Costs",             desc: "Cost tracking and OPEX management" },
  { key: "accounting",     label: "Accounting",        desc: "Income statement, balance sheet, bank recon" },
  { key: "campaigns",      label: "Campaigns",         desc: "Marketing campaigns and UTM tracking" },
  { key: "content_engine", label: "Content Engine",    desc: "Post templates and social content tools" },
] as const;

const DEFAULT_AI_PROMPT = `You are Coco, a smart AI assistant built into CocoCRM. You help users manage their business through natural conversation.

You can:
- Search and manage customers
- Create and update invoices
- Log activities (calls, emails, meetings)
- Create leads
- Show stats and summaries

Guidelines:
- Be concise and friendly. Confirm actions after completing them.
- When creating invoices or customers, confirm key details in your response.
- Format amounts as currency (e.g. R 5,000).
- If you need a customer ID but only have a name, use search_customers first.`;

// ── Shared styles ─────────────────────────────────────────────────────────────

const lbl = { color: "var(--muted2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", display: "block", marginBottom: 5 };
const inputCls = "w-full px-3 py-2 rounded-lg border outline-none text-sm focus:ring-1 focus:ring-[var(--accent)]";
const inputSty = { background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" };
const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)" };
const sectionHdr = { borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 20 };

// ── Main shell ────────────────────────────────────────────────────────────────

export function SettingsShell({ org, orgId, statuses, payTypes, costCats, accounts, invoiceStatuses }: Props) {
  const [tab, setTab] = useState<TabKey>("general");

  return (
    <section className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted2)" }}>Manage your organisation, appearance, and integrations</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-1 justify-center transition-all"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--muted)",
                boxShadow: active ? "0 0 12px var(--accent-glow)" : undefined,
              }}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "general"    && <GeneralTab org={org} orgId={orgId} />}
      {tab === "appearance" && <SettingsAppearance />}
      {tab === "modules"    && <ModulesTab flags={(org?.feature_flags as Record<string, boolean>) ?? {}} />}
      {tab === "data"       && <SettingsDimensions statuses={statuses} payTypes={payTypes} costCats={costCats} accounts={accounts} invoiceStatuses={invoiceStatuses} />}
      {tab === "ai"         && <AiTab aiPrompt={(org?.feature_flags as Record<string, unknown>)?.ai_system_prompt as string ?? null} />}
    </section>
  );
}

// ── General tab ───────────────────────────────────────────────────────────────

function GeneralTab({ org, orgId }: { org: Org | null; orgId: string }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(org?.logo_url ?? null);

  async function handleLogoUpload(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${orgId}/logo.${ext}`;
      const { error } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("org-logos").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await updateLogoUrl(url);
      setPreview(url);
      toast.success("Logo updated");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  }

  async function handleRemoveLogo() {
    await updateLogoUrl(null);
    setPreview(null);
    toast.success("Logo removed");
  }

  async function handleSave(fd: FormData) {
    await updateOrgSettings(fd);
    toast.success("Settings saved");
  }

  return (
    <div className="space-y-5">
      {/* Logo */}
      <div className="p-5" style={card}>
        <div style={sectionHdr}>
          <p className="text-sm font-semibold">Company Logo</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>Shown on invoices and quotes · PNG, JPG or SVG · Max 2MB</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Logo" className="rounded-xl object-contain"
                style={{ maxHeight: 72, maxWidth: 180, background: "#fff", padding: 8, border: "1px solid var(--border)" }} />
              <button onClick={handleRemoveLogo}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] flex items-center justify-center"
                style={{ background: "var(--red-c)", color: "#fff" }}>
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl"
              style={{ width: 110, height: 72, background: "var(--card2)", border: "2px dashed var(--border2)" }}>
              <Upload size={20} style={{ color: "var(--muted2)" }} />
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-opacity"
              style={{ background: "var(--accent)", color: "#fff", opacity: uploading ? 0.6 : 1 }}>
              {uploading ? "Uploading…" : preview ? "Replace" : "Upload Logo"}
            </button>
          </div>
        </div>
      </div>

      {/* Company info form */}
      <div className="p-5" style={card}>
        <div style={sectionHdr}>
          <p className="text-sm font-semibold">Company Information</p>
        </div>
        <form
          action={async (fd) => { await handleSave(fd); }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={lbl}>Company Name</label>
              <input name="name" defaultValue={org?.name || ""} className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={lbl}>Currency</label>
              <select name="currency" defaultValue={org?.currency || "ZAR"} className={inputCls} style={inputSty}>
                <option value="ZAR">ZAR (R)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="CAD">CAD (C$)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Financial Year Start</label>
              <select name="fiscal_year_start" defaultValue={org?.fiscal_year_start ?? 3} className={inputCls} style={inputSty}>
                {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Reg Number</label>
              <input name="reg_no" defaultValue={org?.reg_no || ""} className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={lbl}>VAT Number</label>
              <input name="vat_no" defaultValue={org?.vat_no || ""} className={inputCls} style={inputSty} />
            </div>
            <div className="sm:col-span-2">
              <label style={lbl}>Address</label>
              <input name="address" defaultValue={org?.address || ""} className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input name="phone" defaultValue={org?.phone || ""} className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input name="email" defaultValue={org?.email || ""} className={inputCls} style={inputSty} />
            </div>
          </div>

          <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>Banking Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Account Holder</label>
                <input name="bank_holder" defaultValue={org?.bank_holder || ""} className={inputCls} style={inputSty} />
              </div>
              <div>
                <label style={lbl}>Bank Name</label>
                <input name="bank_name" defaultValue={org?.bank_name || ""} className={inputCls} style={inputSty} />
              </div>
              <div>
                <label style={lbl}>Account Number</label>
                <input name="bank_account" defaultValue={org?.bank_account || ""} className={inputCls} style={inputSty} />
              </div>
              <div>
                <label style={lbl}>Branch Code</label>
                <input name="bank_branch" defaultValue={org?.bank_branch || ""} className={inputCls} style={inputSty} />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}>
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Seed defaults */}
      <div className="p-5 flex items-center justify-between gap-4" style={card}>
        <div>
          <p className="text-sm font-semibold">Seed Default Data</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>Populate default statuses, payment types, cost categories, and accounts if empty</p>
        </div>
        <form action={seedDefaults}>
          <button className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
            style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            Seed Defaults
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Modules tab ───────────────────────────────────────────────────────────────

function ModulesTab({ flags }: { flags: Record<string, boolean> }) {
  const toast = useToast();
  const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({
    leads: true, products: true, campaigns: true, accounting: true,
    content_engine: true, costs: true,
    ...flags,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try { await updateFeatureFlags(localFlags); toast.success("Module settings saved"); }
    catch { toast.error("Failed to save"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div style={card}>
        <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold">Module Visibility</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>Toggle which modules appear in the sidebar navigation</p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {FEATURE_DEFS.map(({ key, label, desc }) => {
            const enabled = localFlags[key] !== false;
            return (
              <div key={key} className="flex items-center justify-between px-5 py-3.5 gap-3">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs" style={{ color: "var(--muted2)" }}>{desc}</p>
                </div>
                <button
                  onClick={() => setLocalFlags(f => ({ ...f, [key]: !f[key] }))}
                  className="relative flex-shrink-0 rounded-full transition-all"
                  style={{
                    width: 44, height: 24,
                    background: enabled ? "var(--accent)" : "var(--border)",
                    boxShadow: enabled ? "0 0 8px var(--accent-glow)" : undefined,
                  }}>
                  <span className="absolute top-1 rounded-full transition-all"
                    style={{ width: 16, height: 16, background: "#fff", left: enabled ? 24 : 4, boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3.5 border-t flex justify-end" style={{ borderColor: "var(--border)" }}>
          <button onClick={save} disabled={busy}
            className="px-5 py-2 text-sm font-semibold rounded-lg"
            style={{ background: "var(--accent)", color: "#fff", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI tab ────────────────────────────────────────────────────────────────────

function AiTab({ aiPrompt }: { aiPrompt: string | null }) {
  const toast = useToast();
  const [prompt, setPrompt] = useState(aiPrompt || DEFAULT_AI_PROMPT);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try { await updateAiSystemPrompt(prompt); toast.success("AI prompt saved"); }
    catch { toast.error("Failed to save"); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-5 space-y-4" style={card}>
      <div style={sectionHdr}>
        <p className="text-sm font-semibold">Coco AI — System Prompt</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>
          Defines how Coco behaves. Customise the tone, terminology, and context to match your business.
        </p>
      </div>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={14}
        className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y font-mono"
        style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)", lineHeight: 1.65 }}
      />
      <div className="flex gap-3 justify-between items-center">
        <button
          onClick={() => setPrompt(DEFAULT_AI_PROMPT)}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--muted2)" }}>
          Reset to default
        </button>
        <button onClick={save} disabled={busy}
          className="px-5 py-2 text-sm font-semibold rounded-lg"
          style={{ background: "var(--accent)", color: "#fff", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Saving…" : "Save Prompt"}
        </button>
      </div>
    </div>
  );
}
