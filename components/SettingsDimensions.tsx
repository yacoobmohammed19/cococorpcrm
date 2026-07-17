"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X, RefreshCw } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";
import {
  createStatus, deleteStatus, updateStatus, recalcLeadWeights,
  createPaymentType, deletePaymentType, updatePaymentType,
  createCostCategory, deleteCostCategory, updateCostCategory,
  createAccount, deleteAccount, updateAccount,
  createInvoiceStatus, deleteInvoiceStatus, updateInvoiceStatus,
} from "@/server-actions/settings";

type Status = { id: number; name: string; category: string | null; weight: number };
type PayType = { id: number; name: string; description: string | null };
type CostCat = { id: number; name: string; description: string | null };
type Account = { id: number; name: string; account_type: string | null };
type InvoiceStatus = { id: number; name: string; color: string; position: number };

interface Props {
  statuses: Status[];
  payTypes: PayType[];
  costCats: CostCat[];
  accounts: Account[];
  invoiceStatuses: InvoiceStatus[];
}

const inputCss = "px-2 py-1 rounded border outline-none text-sm focus:ring-1 focus:ring-[var(--accent)] flex-1 min-w-0";
const inputStyle = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

type Field = { key: string; value: string; placeholder: string; type?: "text" | "color" | "number"; suffix?: string };

function EditableRow({
  fields,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  isPending,
}: {
  fields: Field[];
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (fd: FormData) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const colorField = fields.find(f => f.type === "color");

  if (!editing) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {colorField && (
            <span className="w-3 h-3 rounded-full shrink-0 inline-block" style={{ background: colorField.value }} />
          )}
          <span className="text-sm font-medium truncate">{fields[0].value}</span>
          {fields.slice(1).filter(f => f.type !== "color" && f.value !== "").map(f => (
            <span key={f.key} className="text-xs shrink-0" style={{ color: "var(--muted2)" }}>
              {f.value}{f.suffix ?? ""}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-[var(--card2)]" style={{ color: "var(--muted2)" }}>
            <Pencil size={13} />
          </button>
          <button type="button" onClick={onDelete} disabled={isPending} className="p-1 rounded hover:bg-[var(--card2)]" style={{ color: "var(--red-c)" }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(new FormData(e.currentTarget));
      }}
      className="flex items-center gap-2 px-3 py-2 rounded"
      style={{ background: "var(--card3)", border: "1px solid var(--accent)" }}
    >
      {fields.map(f =>
        f.type === "color" ? (
          <input
            key={f.key}
            type="color"
            name={f.key}
            defaultValue={f.value || "#6b7280"}
            className="w-8 h-8 rounded cursor-pointer border-0 p-0.5 shrink-0"
            style={{ background: "var(--card2)" }}
          />
        ) : f.type === "number" ? (
          <input
            key={f.key}
            type="number"
            name={f.key}
            min={0}
            max={100}
            step={1}
            defaultValue={f.value}
            placeholder={f.placeholder}
            title="Pipeline weight %"
            className="px-2 py-1 rounded border outline-none text-sm focus:ring-1 focus:ring-[var(--accent)] w-16 shrink-0"
            style={inputStyle}
          />
        ) : (
          <input
            key={f.key}
            name={f.key}
            defaultValue={f.value}
            placeholder={f.placeholder}
            className={inputCss}
            style={inputStyle}
          />
        )
      )}
      <button type="submit" disabled={isPending} className="p-1 rounded" style={{ color: "var(--accent)" }}>
        <Check size={15} />
      </button>
      <button type="button" onClick={onCancel} className="p-1 rounded" style={{ color: "var(--muted2)" }}>
        <X size={15} />
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden mb-6" style={{ border: "1px solid var(--border)" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>{title}</h2>
      </div>
      <div className="p-4 space-y-2" style={{ background: "var(--card2)" }}>
        {children}
      </div>
    </div>
  );
}

export function SettingsDimensions({ statuses, payTypes, costCats, accounts, invoiceStatuses }: Props) {
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recalcing, setRecalcing] = useState(false);

  async function handleRecalc() {
    setRecalcing(true);
    try {
      const { updated } = await recalcLeadWeights();
      toast.success(updated === 0 ? "All leads already up to date" : `Recalculated ${updated} lead${updated === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not recalculate");
    } finally {
      setRecalcing(false);
    }
  }

  function saveWith(updateFn: (id: number, fd: FormData) => Promise<void>, id: number) {
    return (fd: FormData) => {
      startTransition(async () => {
        await updateFn(id, fd);
        setEditing(null);
      });
    };
  }

  function deleteWith(deleteFn: (id: number) => Promise<void>, id: number) {
    startTransition(() => deleteFn(id));
  }

  const addInputCss = "px-3 py-2 rounded border outline-none text-sm focus:ring-1 focus:ring-[var(--accent)] flex-1";
  const borderTop = { borderColor: "var(--border)" };

  return (
    <>
      <Section title="Invoice Statuses">
        {invoiceStatuses.map(s => (
          <EditableRow
            key={s.id}
            fields={[
              { key: "name", value: s.name, placeholder: "Status name" },
              { key: "color", value: s.color || "#6b7280", placeholder: "Color", type: "color" },
            ]}
            editing={editing === `invstatus-${s.id}`}
            onEdit={() => setEditing(`invstatus-${s.id}`)}
            onCancel={() => setEditing(null)}
            onSave={saveWith(updateInvoiceStatus, s.id)}
            onDelete={() => deleteWith(deleteInvoiceStatus, s.id)}
            isPending={isPending}
          />
        ))}
        <form action={createInvoiceStatus} className="flex gap-2 mt-3 pt-3 border-t" style={borderTop}>
          <input name="name" placeholder="Status name" required className={addInputCss} style={inputStyle} />
          <input type="color" name="color" defaultValue="#6b7280"
            className="w-10 h-9 rounded cursor-pointer border p-0.5 shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--background)" }} />
          <button className="px-4 py-2 rounded text-sm font-semibold whitespace-nowrap" style={{ background: "var(--accent)", color: "#fff" }}>+ Add</button>
        </form>
      </Section>

      <Section title="Lead Statuses">
        <p className="text-xs -mt-1 mb-1" style={{ color: "var(--muted2)" }}>
          Weight % is the pipeline probability applied to a lead in this status (drives weighted pipeline value).
        </p>
        {statuses.map(s => (
          <EditableRow
            key={s.id}
            fields={[
              { key: "name", value: s.name, placeholder: "Status name" },
              { key: "category", value: s.category || "", placeholder: "Category" },
              { key: "weight", value: String(s.weight ?? 0), placeholder: "0", type: "number", suffix: "%" },
            ]}
            editing={editing === `status-${s.id}`}
            onEdit={() => setEditing(`status-${s.id}`)}
            onCancel={() => setEditing(null)}
            onSave={saveWith(updateStatus, s.id)}
            onDelete={() => deleteWith(deleteStatus, s.id)}
            isPending={isPending}
          />
        ))}
        <form action={createStatus} className="flex gap-2 mt-3 pt-3 border-t" style={borderTop}>
          <input name="name" placeholder="Status name" required className={addInputCss} style={inputStyle} />
          <input name="category" placeholder="Category (e.g. Active)" className={addInputCss} style={inputStyle} />
          <input name="weight" type="number" min={0} max={100} step={1} defaultValue={0} title="Weight %"
            className="px-3 py-2 rounded border outline-none text-sm focus:ring-1 focus:ring-[var(--accent)] w-20 shrink-0" style={inputStyle} />
          <button className="px-4 py-2 rounded text-sm font-semibold whitespace-nowrap" style={{ background: "var(--accent)", color: "#fff" }}>+ Add</button>
        </form>
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t flex-wrap" style={borderTop}>
          <p className="text-xs" style={{ color: "var(--muted2)" }}>
            Applied to new/edited leads automatically. Recalculate to re-apply weights to every existing lead.
          </p>
          <button type="button" onClick={handleRecalc} disabled={recalcing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold whitespace-nowrap"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", opacity: recalcing ? 0.6 : 1 }}>
            {recalcing ? <Spinner size={14} /> : <RefreshCw size={14} />}
            {recalcing ? "Recalculating…" : "Recalculate weighted pipeline"}
          </button>
        </div>
      </Section>

      <Section title="Payment Types">
        {payTypes.map(p => (
          <EditableRow
            key={p.id}
            fields={[
              { key: "name", value: p.name, placeholder: "Payment type name" },
              { key: "description", value: p.description || "", placeholder: "Description" },
            ]}
            editing={editing === `paytype-${p.id}`}
            onEdit={() => setEditing(`paytype-${p.id}`)}
            onCancel={() => setEditing(null)}
            onSave={saveWith(updatePaymentType, p.id)}
            onDelete={() => deleteWith(deletePaymentType, p.id)}
            isPending={isPending}
          />
        ))}
        <form action={createPaymentType} className="flex gap-2 mt-3 pt-3 border-t" style={borderTop}>
          <input name="name" placeholder="Payment type name" required className={addInputCss} style={inputStyle} />
          <input name="description" placeholder="Description" className={addInputCss} style={inputStyle} />
          <button className="px-4 py-2 rounded text-sm font-semibold whitespace-nowrap" style={{ background: "var(--accent)", color: "#fff" }}>+ Add</button>
        </form>
      </Section>

      <Section title="Cost Categories">
        {costCats.map(c => (
          <EditableRow
            key={c.id}
            fields={[
              { key: "name", value: c.name, placeholder: "Category name" },
              { key: "description", value: c.description || "", placeholder: "Description" },
            ]}
            editing={editing === `costcat-${c.id}`}
            onEdit={() => setEditing(`costcat-${c.id}`)}
            onCancel={() => setEditing(null)}
            onSave={saveWith(updateCostCategory, c.id)}
            onDelete={() => deleteWith(deleteCostCategory, c.id)}
            isPending={isPending}
          />
        ))}
        <form action={createCostCategory} className="flex gap-2 mt-3 pt-3 border-t" style={borderTop}>
          <input name="name" placeholder="Category name" required className={addInputCss} style={inputStyle} />
          <input name="description" placeholder="Description" className={addInputCss} style={inputStyle} />
          <button className="px-4 py-2 rounded text-sm font-semibold whitespace-nowrap" style={{ background: "var(--accent)", color: "#fff" }}>+ Add</button>
        </form>
      </Section>

      <Section title="Cash Accounts">
        {accounts.map(a => (
          <EditableRow
            key={a.id}
            fields={[
              { key: "name", value: a.name, placeholder: "Account name" },
              { key: "account_type", value: a.account_type || "", placeholder: "Type (e.g. Bank)" },
            ]}
            editing={editing === `account-${a.id}`}
            onEdit={() => setEditing(`account-${a.id}`)}
            onCancel={() => setEditing(null)}
            onSave={saveWith(updateAccount, a.id)}
            onDelete={() => deleteWith(deleteAccount, a.id)}
            isPending={isPending}
          />
        ))}
        <form action={createAccount} className="flex gap-2 mt-3 pt-3 border-t" style={borderTop}>
          <input name="name" placeholder="Account name" required className={addInputCss} style={inputStyle} />
          <input name="account_type" placeholder="Type (e.g. Bank)" className={addInputCss} style={inputStyle} />
          <button className="px-4 py-2 rounded text-sm font-semibold whitespace-nowrap" style={{ background: "var(--accent)", color: "#fff" }}>+ Add</button>
        </form>
      </Section>
    </>
  );
}
