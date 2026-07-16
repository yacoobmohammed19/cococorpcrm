"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useToast } from "@/components/Toast";
import { adminCreateOrg } from "@/server-actions/admin";

const inputCss = {
  background: "var(--card2)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as React.CSSProperties;

export function CreateOrgForm() {
  const toast = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { id } = await adminCreateOrg(new FormData(e.currentTarget));
      toast.success("Organisation created");
      router.push(`/admin/organisations/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create organisation");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-subtle)" }}>
          <Plus size={18} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h2 className="text-sm font-bold">New organisation</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>
            Isolated data, its own users and billing. You&apos;ll allocate users next.
          </p>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
              Organisation name *
            </label>
            <input
              name="name"
              required
              placeholder="e.g. Acme Corp"
              className="w-full rounded-lg border text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)]"
              style={inputCss}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>
              Currency
            </label>
            <select name="currency" defaultValue="ZAR" className="w-full rounded-lg border text-sm px-3 py-2 outline-none" style={inputCss}>
              <option value="ZAR">ZAR — South African Rand</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="AUD">AUD — Australian Dollar</option>
              <option value="CAD">CAD — Canadian Dollar</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity active:opacity-80"
          style={{ background: "var(--accent)", color: "#fff", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Creating…" : "Create organisation"}
        </button>
      </form>
    </div>
  );
}
