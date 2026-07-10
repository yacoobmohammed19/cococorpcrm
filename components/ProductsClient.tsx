"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { createProduct, updateProduct, deleteProduct } from "@/server-actions/products";

type Product = {
  id: number; name: string; sku: string | null; description: string | null;
  unit_price: number; category: string | null; is_active: boolean; created_at: string;
  location?: string | null;
};

const CATEGORIES = ["Software", "Hardware", "Service", "Consulting", "Subscription", "License", "Other"];

const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

function fmt(n: number) { return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function ProductsClient({ products, currency }: { products: Product[]; currency: string }) {
  const cur = currency === "ZAR" ? "R" : "$";
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [busy, setBusy] = useState(false);

  const filtered = products.filter(p => {
    if (!showInactive && !p.is_active) return false;
    if (catFilter && p.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.name + (p.sku || "") + (p.description || "") + (p.category || "")).toLowerCase().includes(q);
    }
    return true;
  });

  const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];

  function open(p: Product | null) { setModal({ open: true, product: p }); }
  function close() { setModal({ open: false, product: null }); }

  async function handleDelete(id: number, name: string) {
    if (!await confirm(`Archive "${name}"?`, "The product will be marked inactive.")) return;
    setBusy(true);
    await runAction(() => deleteProduct(id), toast, "Product archived");
    setBusy(false);
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
            {products.filter(p => p.is_active).length} active · {products.length} total
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, product: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
        >
          <Plus size={15} />
          New Product
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          ["Total Products", products.length, "var(--accent)"],
          ["Active", products.filter(p => p.is_active).length, "var(--purple-c)"],
          ["Categories", cats.length, "var(--cyan-c)"],
          ["Avg Price", `${cur} ${fmt(products.length ? products.reduce((s, p) => s + p.unit_price, 0) / products.length : 0)}`, "var(--amber-c)"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-lg p-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
            <div className="text-lg font-bold font-mono" style={{ color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
          className="px-3 py-2 text-sm rounded border outline-none flex-1 min-w-0"
          style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded border outline-none"
          style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
          <option value="">All Categories</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--muted2)" }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                {["Name", "SKU", "Category", "Location", "Unit Price", "Status", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b hover:bg-[var(--card3)] transition-colors" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{p.name}</div>
                    {p.description && <div className="text-xs mt-0.5 truncate max-w-[220px]" style={{ color: "var(--muted2)" }}>{p.description}</div>}
                  </td>
                  <td className="px-3 py-2.5 font-mono" style={{ color: "var(--muted)" }}>{p.sku || "—"}</td>
                  <td className="px-3 py-2.5">
                    {p.category && (
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(139,92,246,.12)", color: "var(--purple-c)" }}>
                        {p.category}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 max-w-[120px] truncate" style={{ color: "var(--muted2)" }}>{p.location || "—"}</td>
                  <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap" style={{ color: "var(--accent)" }}>
                    {cur} {fmt(p.unit_price)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: p.is_active ? "rgba(236,72,153,.12)" : "rgba(100,100,100,.12)", color: p.is_active ? "var(--accent)" : "var(--muted2)" }}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button onClick={() => open(p)} className="px-2 py-1 rounded text-xs"
                        style={{ border: "1px solid var(--border)", background: "var(--card)" }}>✏️</button>
                      <button onClick={() => handleDelete(p.id, p.name)} disabled={busy}
                        className="px-2 py-1 rounded text-xs"
                        style={{ border: "1px solid var(--border)", background: "var(--card)" }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon="📦" title={search || catFilter ? "No products match your filters" : "No products yet"} description={search || catFilter ? "Try adjusting your filters." : "Add your first product or service to start building your catalogue."} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto"
          style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) close(); }}>
          <div className="w-full max-w-lg rounded-xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">{modal.product ? `Edit — ${modal.product.name}` : "New Product / Service"}</h3>
              <button onClick={close} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                setBusy(true);
                try {
                  if (modal.product) { await updateProduct(modal.product.id, fd); toast.success("Product updated"); }
                  else { await createProduct(fd); toast.success("Product created"); }
                  close();
                } catch { toast.error("Something went wrong"); }
                finally { setBusy(false); }
              }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Name *</label>
                  <input name="name" required defaultValue={modal.product?.name || ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>SKU / Code</label>
                  <input name="sku" defaultValue={modal.product?.sku || ""} className={inp} style={inpS} placeholder="e.g. SVC-001" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Unit Price *</label>
                  <input name="unit_price" type="number" step="0.01" min="0" required
                    defaultValue={modal.product?.unit_price ?? ""} className={inp} style={inpS} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Category</label>
                  <select name="category" defaultValue={modal.product?.category || ""} className={inp} style={inpS}>
                    <option value="">— None —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                  <select name="is_active" defaultValue={modal.product?.is_active === false ? "false" : "true"} className={inp} style={inpS}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                  <textarea name="description" rows={3} defaultValue={modal.product?.description || ""}
                    className={inp + " resize-none"} style={inpS} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Site / Location</label>
                  <input name="location" defaultValue={modal.product?.location || ""} className={inp} style={inpS}
                    placeholder="e.g. Warehouse A, Cape Town Office" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={close} className="flex-1 py-2 text-sm rounded border"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2 text-sm font-semibold rounded"
                  style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : modal.product ? "Update" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} confirmLabel="Archive" />
    </div>
  );
}
