"use client";

import { useState, useRef } from "react";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import { updateLogoUrl, updateFeatureFlags, updateAiSystemPrompt } from "@/server-actions/settings";

type FeatureFlags = {
  leads?: boolean;
  products?: boolean;
  campaigns?: boolean;
  accounting?: boolean;
  content_engine?: boolean;
  costs?: boolean;
};

const FEATURE_DEFS: { key: keyof FeatureFlags; label: string; desc: string }[] = [
  { key: "leads", label: "Leads", desc: "Lead pipeline and opportunity tracking" },
  { key: "products", label: "Products / Services", desc: "Product catalogue and pricing" },
  { key: "costs", label: "Costs", desc: "Cost tracking and OPEX management" },
  { key: "accounting", label: "Accounting", desc: "Income statement, balance sheet, bank recon" },
  { key: "campaigns", label: "Campaigns", desc: "Marketing campaigns and UTM tracking" },
  { key: "content_engine", label: "Content Engine", desc: "Post templates and social content tools" },
];

const DEFAULT_PROMPT = `You are Coco, a smart AI assistant built into CocoCRM. You help users manage their business through natural conversation.

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

export function SettingsExtras({
  orgId, logoUrl, featureFlags, aiSystemPrompt,
}: {
  orgId: string; logoUrl: string | null; featureFlags: FeatureFlags; aiSystemPrompt?: string | null;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(logoUrl);
  const [flags, setFlags] = useState<FeatureFlags>({
    leads: true, products: true, campaigns: true, accounting: true,
    content_engine: true, costs: true,
    ...featureFlags,
  });
  const [flagsBusy, setFlagsBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(aiSystemPrompt || DEFAULT_PROMPT);
  const [aiPromptBusy, setAiPromptBusy] = useState(false);

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

  async function saveFlags() {
    setFlagsBusy(true);
    try { await updateFeatureFlags(flags); toast.success("Feature settings saved"); }
    catch { toast.error("Failed to save"); }
    finally { setFlagsBusy(false); }
  }

  async function saveAiPrompt() {
    setAiPromptBusy(true);
    try { await updateAiSystemPrompt(aiPrompt); toast.success("AI prompt saved"); }
    catch { toast.error("Failed to save prompt"); }
    finally { setAiPromptBusy(false); }
  }

  return (
    <>
      {/* Logo Upload */}
      <div className="rounded-lg overflow-hidden mb-6" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Company Logo</h2>
        </div>
        <div className="p-4 flex flex-wrap gap-4 items-center" style={{ background: "var(--card2)" }}>
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Company logo" className="rounded-lg object-contain"
                style={{ maxHeight: 80, maxWidth: 200, background: "#fff", padding: 8, border: "1px solid var(--border)" }} />
              <button onClick={handleRemoveLogo}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs flex items-center justify-center"
                style={{ background: "var(--red-c)", color: "#fff" }}>✕</button>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg"
              style={{ width: 120, height: 80, background: "var(--card3)", border: "2px dashed var(--border)" }}>
              <span className="text-2xl">🏢</span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium mb-1">
              {preview ? "Update logo" : "Upload your company logo"}
            </p>
            <p className="text-xs mb-3" style={{ color: "var(--muted2)" }}>PNG, JPG or SVG · Max 2MB · Shown on invoices</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="px-4 py-2 text-sm font-semibold rounded"
              style={{ background: "var(--accent)", color: "#fff", opacity: uploading ? .6 : 1 }}>
              {uploading ? "Uploading…" : preview ? "Replace Logo" : "Upload Logo"}
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <div className="rounded-lg overflow-hidden mb-6" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Coco AI — System Prompt</h2>
        </div>
        <div className="p-4 space-y-3" style={{ background: "var(--card2)" }}>
          <p className="text-xs" style={{ color: "var(--muted2)" }}>
            This prompt defines how Coco behaves. Customise it to match your business tone, terminology, or give Coco extra context about your company.
          </p>
          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            rows={10}
            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y font-mono"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)", lineHeight: 1.6 }}
          />
          <div className="flex gap-3 justify-between items-center">
            <button
              onClick={() => setAiPrompt(DEFAULT_PROMPT)}
              className="text-xs px-3 py-1.5 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--muted2)" }}>
              Reset to default
            </button>
            <button onClick={saveAiPrompt} disabled={aiPromptBusy}
              className="px-5 py-2 text-sm font-semibold rounded"
              style={{ background: "var(--accent)", color: "#fff", opacity: aiPromptBusy ? .6 : 1 }}>
              {aiPromptBusy ? "Saving…" : "Save Prompt"}
            </button>
          </div>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="rounded-lg overflow-hidden mb-6" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Module Visibility</h2>
        </div>
        <div className="divide-y" style={{ background: "var(--card2)", borderColor: "var(--border)" }}>
          {FEATURE_DEFS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-4 py-3 gap-3">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs" style={{ color: "var(--muted2)" }}>{desc}</p>
              </div>
              <button
                onClick={() => setFlags(f => ({ ...f, [key]: !f[key] }))}
                className="relative flex-shrink-0 rounded-full transition-colors"
                style={{
                  width: 44, height: 24,
                  background: flags[key] !== false ? "var(--accent)" : "var(--border)",
                }}>
                <span className="absolute top-1 transition-all rounded-full"
                  style={{
                    width: 16, height: 16, background: "#fff",
                    left: flags[key] !== false ? 24 : 4,
                    boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                  }} />
              </button>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t flex justify-end" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
          <button onClick={saveFlags} disabled={flagsBusy}
            className="px-5 py-2 text-sm font-semibold rounded"
            style={{ background: "var(--accent)", color: "#fff", opacity: flagsBusy ? .6 : 1 }}>
            {flagsBusy ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </>
  );
}
