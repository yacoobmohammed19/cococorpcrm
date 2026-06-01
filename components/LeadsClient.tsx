"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, UserCheck } from "lucide-react";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { updateLeadStatus, deleteLead, createLead, updateLead, convertLeadToCustomer } from "@/server-actions/leads";

type Operator = { user_id: string; email: string };

// ─── Tinder-style swipe card view ────────────────────────────────────────────
function SwipeView({ leads, statuses, cur, onStatusChange }: {
  leads: Lead[]; statuses: Status[]; cur: string;
  onStatusChange: (id: number, newStatusId: number) => Promise<void>;
}) {
  const [idx, setIdx] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const THRESHOLD = 90;

  const remaining = leads.slice(idx);
  const lead = remaining[0];

  async function act(direction: "promote" | "demote" | "skip") {
    if (direction !== "skip" && lead) {
      const stIdx = statuses.findIndex(s => s.id === lead.status_id);
      const next = direction === "promote" ? statuses[stIdx + 1] : statuses[stIdx - 1];
      if (next) await onStatusChange(lead.id, next.id);
    }
    setOffset(0);
    setIdx(i => i + 1);
  }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setOffset(e.clientX - startX.current);
  }
  function onPointerUp() {
    setDragging(false);
    const stIdx = statuses.findIndex(s => s.id === lead?.status_id);
    if (offset > THRESHOLD && stIdx < statuses.length - 1) act("promote");
    else if (offset < -THRESHOLD && stIdx > 0) act("demote");
    else setOffset(0);
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">✓</div>
        <p className="text-lg font-semibold">All leads reviewed!</p>
        <p className="text-sm mt-1 mb-6" style={{ color: "var(--muted2)" }}>You&apos;ve gone through all {leads.length} leads</p>
        <button onClick={() => setIdx(0)} className="px-5 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}>Start over</button>
      </div>
    );
  }

  const st = statuses.find(s => s.id === lead.status_id);
  const stColor = STATUS_COLORS[lead.status_id ?? 0] || "var(--muted2)";
  const stIdx = statuses.findIndex(s => s.id === lead.status_id);
  const canPromote = stIdx < statuses.length - 1;
  const canDemote = stIdx > 0;
  const nextSt = canPromote ? statuses[stIdx + 1] : null;
  const prevSt = canDemote ? statuses[stIdx - 1] : null;
  const rotation = offset * 0.07;
  const swipeRatio = Math.min(1, Math.abs(offset) / THRESHOLD);

  return (
    <div className="flex flex-col items-center py-4 select-none">
      <p className="text-xs mb-6 font-mono" style={{ color: "var(--muted2)" }}>
        {idx + 1} / {leads.length}
      </p>

      {/* Card stack */}
      <div className="relative w-full max-w-sm" style={{ height: 420 }}>
        {/* Shadow cards */}
        {remaining[2] && (
          <div className="absolute inset-x-6 bottom-0 rounded-2xl" style={{ height: 400, background: "var(--card)", border: "1px solid var(--border)", transform: "scale(0.90) translateY(8px)", transformOrigin: "bottom" }} />
        )}
        {remaining[1] && (
          <div className="absolute inset-x-3 bottom-0 rounded-2xl" style={{ height: 400, background: "var(--card2)", border: "1px solid var(--border)", transform: "scale(0.95) translateY(4px)", transformOrigin: "bottom" }} />
        )}

        {/* Main card */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { setDragging(false); setOffset(0); }}
          className="absolute inset-0 rounded-2xl cursor-grab active:cursor-grabbing overflow-hidden"
          style={{
            background: "var(--card2)",
            border: "1px solid var(--border)",
            transform: `translateX(${offset}px) rotate(${rotation}deg)`,
            transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
            boxShadow: "0 24px 64px rgba(0,0,0,.35)",
            userSelect: "none",
            touchAction: "none",
          }}>

          {/* Swipe labels */}
          {offset > 20 && (
            <div className="absolute top-5 left-5 px-3 py-1.5 rounded-lg border-2 text-xs font-bold uppercase tracking-wider"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", opacity: swipeRatio, background: "rgba(16,185,129,.12)" }}>
              Promote → {nextSt?.name}
            </div>
          )}
          {offset < -20 && (
            <div className="absolute top-5 right-5 px-3 py-1.5 rounded-lg border-2 text-xs font-bold uppercase tracking-wider"
              style={{ borderColor: "var(--red-c)", color: "var(--red-c)", opacity: swipeRatio, background: "rgba(239,68,68,.12)" }}>
              {prevSt?.name} ← Demote
            </div>
          )}

          {/* Status bar */}
          <div className="px-6 pt-5 pb-2 flex justify-between items-center">
            <span className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: stColor + "22", color: stColor }}>{st?.name || "—"}</span>
            <span className="text-xs font-mono" style={{ color: "var(--muted2)" }}>{fdate(lead.lead_date)}</span>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <h2 className="text-2xl font-bold mb-2 leading-tight">{lead.name}</h2>
            {lead.contact && <p className="text-sm mb-1" style={{ color: "var(--muted2)" }}>👤 {lead.contact}</p>}
            {lead.phone && <p className="text-sm mb-1" style={{ color: "var(--muted2)" }}>📞 {lead.phone}</p>}
          </div>

          {/* Values */}
          <div className="mx-6 grid grid-cols-2 gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="rounded-xl p-3" style={{ background: "var(--card)" }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Opportunity</p>
              <p className="text-lg font-bold font-mono" style={{ color: "var(--accent)" }}>{cur} {fmt(lead.opportunity_value)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--card)" }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Pipeline</p>
              <p className="text-lg font-bold font-mono" style={{ color: "var(--purple-c)" }}>{cur} {fmt(lead.opportunity_weighted)}</p>
            </div>
          </div>

          {/* Funnel indicators */}
          <div className="mx-6 mt-4 flex gap-4 justify-around">
            {(["contacted", "responded", "developed", "completed"] as const).map(f => (
              <div key={f} className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: lead[f] ? "rgba(16,185,129,.2)" : "var(--card)", color: lead[f] ? "var(--accent)" : "var(--muted2)", border: `1px solid ${lead[f] ? "var(--accent)" : "var(--border)"}` }}>
                  {lead[f] ? "✓" : "○"}
                </div>
                <span className="text-xs capitalize" style={{ color: "var(--muted2)" }}>{f.slice(0, 4)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs mt-5 mb-4" style={{ color: "var(--muted2)" }}>
        Swipe right to promote · Swipe left to demote · Tap buttons below
      </p>

      {/* Action buttons */}
      <div className="flex gap-5 items-center">
        <div className="text-center">
          <button onClick={() => canDemote && act("demote")} disabled={!canDemote}
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-lg transition-all active:scale-90"
            style={{
              background: canDemote ? "rgba(239,68,68,.15)" : "var(--card)",
              border: `2px solid ${canDemote ? "var(--red-c)" : "var(--border)"}`,
              color: canDemote ? "var(--red-c)" : "var(--muted2)",
            }}>←</button>
          <p className="text-xs mt-1 w-14 text-center truncate" style={{ color: "var(--muted2)" }}>{prevSt?.name || ""}</p>
        </div>
        <div className="text-center">
          <button onClick={() => act("skip")}
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg shadow transition-all active:scale-90"
            style={{ background: "var(--card2)", border: "2px solid var(--border)", color: "var(--muted2)" }}>↺</button>
          <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Skip</p>
        </div>
        <div className="text-center">
          <button onClick={() => canPromote && act("promote")} disabled={!canPromote}
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-lg transition-all active:scale-90"
            style={{
              background: canPromote ? "rgba(16,185,129,.15)" : "var(--card)",
              border: `2px solid ${canPromote ? "var(--accent)" : "var(--border)"}`,
              color: canPromote ? "var(--accent)" : "var(--muted2)",
            }}>→</button>
          <p className="text-xs mt-1 w-14 text-center truncate" style={{ color: "var(--muted2)" }}>{nextSt?.name || ""}</p>
        </div>
      </div>
    </div>
  );
}

type FunnelState = { contacted: boolean; responded: boolean; developed: boolean; completed: boolean };
const FUNNEL_STEPS = ["contacted", "responded", "developed", "completed"] as const;
const FUNNEL_LABELS = ["Called", "Responded", "Developed", "Closed"];

function FunnelStepper({ state, onChange }: { state: FunnelState; onChange: (s: FunnelState) => void }) {
  const activeCount = FUNNEL_STEPS.reduce((n, s, i) => state[s] ? i + 1 : n, 0);
  function clickStep(idx: number) {
    const newCount = activeCount === idx + 1 ? idx : idx + 1;
    const next = { contacted: false, responded: false, developed: false, completed: false };
    FUNNEL_STEPS.slice(0, newCount).forEach(s => { next[s] = true; });
    onChange(next);
  }
  return (
    <div className="flex items-center w-full">
      {FUNNEL_STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-1">
          <button type="button" onClick={() => clickStep(i)} className="flex flex-col items-center gap-1 flex-shrink-0 group w-full">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all mx-auto"
              style={{ background: state[step] ? "var(--accent)" : "var(--card3)", color: state[step] ? "#fff" : "var(--muted2)", border: `2px solid ${state[step] ? "var(--accent)" : "var(--border)"}` }}>
              {state[step] ? "✓" : i + 1}
            </div>
            <span className="text-[10px] font-semibold" style={{ color: state[step] ? "var(--accent)" : "var(--muted2)" }}>{FUNNEL_LABELS[i]}</span>
          </button>
          {i < FUNNEL_STEPS.length - 1 && (
            <div className="h-0.5 flex-1 mx-1 -mt-4 rounded-full" style={{ background: state[FUNNEL_STEPS[i + 1]] ? "var(--accent)" : "var(--border)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function MiniStepper({ lead }: { lead: { contacted: boolean; responded: boolean; developed: boolean; completed: boolean } }) {
  const activeIdx = FUNNEL_STEPS.reduce((n, s, i) => lead[s] ? i : n, -1);
  return (
    <div className="flex items-center gap-0.5">
      {FUNNEL_STEPS.map((s, i) => (
        <div key={s} className="w-4 h-1.5 rounded-full" style={{ background: i <= activeIdx ? "var(--accent)" : "var(--card3)" }} />
      ))}
    </div>
  );
}

type Status = { id: number; name: string };
type Lead = {
  id: number; name: string; phone: string | null; contact: string | null;
  lead_date: string | null; status_id: number | null; last_follow_up: string | null;
  opportunity_value: number | null; weight: number | null; opportunity_weighted: number | null;
  total_revenue: number | null; secured_revenue: number | null;
  contacted: boolean; responded: boolean; developed: boolean; completed: boolean;
  product_id: number | null;
  assigned_to?: string | null;
};
type Customer = { id: number; name: string };
type Product = { id: number; name: string; unit_price: number };

type Props = {
  leads: Lead[];
  statuses: Status[];
  customers: Customer[];
  products?: Product[];
  currency: string;
  operators?: Operator[];
  currentRole?: string;
};

const STATUS_COLORS: Record<number, string> = { 1: "var(--pink)", 2: "var(--amber-c)", 3: "var(--accent)", 4: "var(--red-c)", 5: "var(--muted2)" };
function fmt(n: number | null) { return n == null ? "0" : Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fdate(d: string | null) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return "—"; } }
function pct(n: number | null) { if (!n) return "0%"; return `${Number(n)}%`; }
function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => { const s = v == null ? "" : String(v); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: filename });
  a.click(); URL.revokeObjectURL(a.href);
}

export function LeadsClient({ leads, statuses, customers, products = [], currency, operators = [], currentRole = "member" }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [view, setView] = useState<"table" | "kanban" | "cards">("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [funnelFilter, setFunnelFilter] = useState<"" | "contacted" | "responded" | "developed" | "completed">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modal, setModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [busy, setBusy] = useState(false);
  const [kanbanMode, setKanbanMode] = useState<"standard" | "pipeline">("standard");
  const dragId = useRef<number | null>(null);

  const [funnelState, setFunnelState] = useState<FunnelState>({ contacted: false, responded: false, developed: false, completed: false });
  const [modalWeight, setModalWeight] = useState(0);
  const [modalLeadDate, setModalLeadDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [modalFollowUp, setModalFollowUp] = useState("");

  useEffect(() => {
    if (modal.open) {
      setFunnelState({
        contacted: modal.lead?.contacted ?? false,
        responded: modal.lead?.responded ?? false,
        developed: modal.lead?.developed ?? false,
        completed: modal.lead?.completed ?? false,
      });
      setModalWeight(modal.lead?.weight ?? 0);
      setModalLeadDate(modal.lead?.lead_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setModalFollowUp(modal.lead?.last_follow_up?.slice(0, 10) || "");
    }
  }, [modal.open, modal.lead]);

  function computeDefaultWeight(f: FunnelState): number {
    if (f.completed) return 99;
    if (f.developed) return 50;
    if (f.responded) return 20;
    if (f.contacted) return 10;
    return 0;
  }

  function handleFunnelChange(stage: keyof FunnelState, value: boolean) {
    const next = { ...funnelState, [stage]: value };
    setFunnelState(next);
    setModalWeight(computeDefaultWeight(next));
  }

  const filtered = leads.filter(l => {
    if (statusFilter.length > 0 && !statusFilter.includes(String(l.status_id))) return false;
    if (funnelFilter === "contacted" && !l.contacted) return false;
    if (funnelFilter === "responded" && !l.responded) return false;
    if (funnelFilter === "developed" && !l.developed) return false;
    if (funnelFilter === "completed" && !l.completed) return false;
    if (dateFrom && l.lead_date && l.lead_date < dateFrom) return false;
    if (dateTo && l.lead_date && l.lead_date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (l.name + (l.phone || "") + (l.contact || "")).toLowerCase().includes(q);
    }
    return true;
  });

  async function handleStatusDrop(e: React.DragEvent, newStatusId: number) {
    e.preventDefault();
    const lid = dragId.current;
    if (!lid) return;
    document.querySelectorAll("[data-kcol]").forEach(el => el.classList.remove("ring-2", "ring-[var(--accent)]"));
    await updateLeadStatus(lid, newStatusId);
  }

  function openModal(lead: Lead | null) { setModal({ open: true, lead }); }
  function closeModal() { setModal({ open: false, lead: null }); }

  async function handleDelete(id: number) {
    if (!await confirm("Archive this lead?", "The lead will be hidden from the list.")) return;
    setBusy(true);
    await runAction(() => deleteLead(id), toast, "Lead archived");
    setBusy(false);
  }

  async function handleConvert(id: number) {
    if (!await confirm("Convert this lead to a customer?", "A new customer record will be created from this lead.")) return;
    setBusy(true);
    await runAction(() => convertLeadToCustomer(id), toast, "Lead converted to customer");
    setBusy(false);
  }

  const inputStyle = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
  const inputCss = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

  const pipelineTotal = leads.reduce((s, l) => s + (l.opportunity_weighted ?? 0), 0);

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
            {leads.length} leads · {cur} {fmt(pipelineTotal)} weighted pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { const stMap = Object.fromEntries(statuses.map(s => [s.id, s.name])); const cMap = Object.fromEntries(customers.map(c => [c.id, c.name])); downloadCsv(`leads-${new Date().toISOString().slice(0,10)}.csv`, filtered.map(l => ({ Name: l.name, Status: stMap[l.status_id ?? 0] || "", Customer: cMap[l.status_id ?? 0] || "", Date: l.lead_date || "", "Opportunity Value": l.opportunity_value ?? "", "Weighted Value": l.opportunity_weighted ?? "", Contact: l.contact || "", Phone: l.phone || "", "Last Follow Up": l.last_follow_up || "", Contacted: l.contacted ? "Yes" : "No", Responded: l.responded ? "Yes" : "No", Developed: l.developed ? "Yes" : "No", Completed: l.completed ? "Yes" : "No" }))); }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", background: "var(--card2)" }}>
            ↓ CSV
          </button>
          <button
            onClick={() => openModal(null)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90 active:scale-[.98]"
            style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
          >
            <Plus size={15} />
            New Lead
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex rounded overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {([["table", "Table"], ["kanban", "Board"], ["cards", "Cards"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-2 text-xs font-semibold transition-colors"
              style={{ background: view === v ? "var(--accent)" : "var(--card2)", color: view === v ? "#fff" : "var(--muted)" }}>
              {label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="px-3 py-2 text-xs rounded border outline-none"
          style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        <span className="text-xs ml-auto" style={{ color: "var(--muted2)" }}>{filtered.length}/{leads.length}</span>
      </div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <MultiSelect
          label="Status"
          options={statuses.map(s => ({ label: s.name, value: String(s.id) }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <MultiSelect
          label="Funnel Stage"
          options={[
            { label: "Called", value: "contacted" },
            { label: "Responded", value: "responded" },
            { label: "Developed", value: "developed" },
            { label: "Closed", value: "completed" },
          ]}
          value={funnelFilter ? [funnelFilter] : []}
          onChange={vals => setFunnelFilter((vals[vals.length - 1] ?? "") as typeof funnelFilter)}
          minWidth={160}
        />
        <div className="flex items-center gap-1.5">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1.5 rounded text-xs border outline-none"
            style={{ background: "var(--card2)", borderColor: dateFrom ? "var(--accent)" : "var(--border)", color: "var(--muted)" }} />
          <span className="text-xs" style={{ color: "var(--muted2)" }}>→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1.5 rounded text-xs border outline-none"
            style={{ background: "var(--card2)", borderColor: dateTo ? "var(--accent)" : "var(--border)", color: "var(--muted)" }} />
        </div>
        {(statusFilter.length > 0 || funnelFilter || dateFrom || dateTo) && (
          <button onClick={() => { setStatusFilter([]); setFunnelFilter(""); setDateFrom(""); setDateTo(""); }}
            className="text-xs px-2 py-1.5 rounded" style={{ color: "var(--muted2)" }}>✕ Clear</button>
        )}
      </div>

      {/* TABLE VIEW */}
      {view === "table" && (
        <>
          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map(l => {
              const st = statuses.find(s => s.id === l.status_id);
              const stColor = STATUS_COLORS[l.status_id ?? 0] || "var(--muted2)";
              return (
                <div key={l.id} className="rounded-2xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 mr-3">
                      <p className="font-bold text-base leading-tight">{l.name}</p>
                      {l.contact && <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>👤 {l.contact}</p>}
                      {l.phone && <p className="text-xs" style={{ color: "var(--muted2)" }}>📞 {l.phone}</p>}
                    </div>
                    {st && <span className="shrink-0 px-2 py-1 rounded-full text-xs font-bold" style={{ background: stColor + "22", color: stColor }}>{st.name}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-xl p-2.5" style={{ background: "var(--card)" }}>
                      <p className="text-xs mb-0.5" style={{ color: "var(--muted2)" }}>Opportunity</p>
                      <p className="font-bold font-mono text-sm" style={{ color: "var(--accent)" }}>{cur} {fmt(l.opportunity_value)}</p>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: "var(--card)" }}>
                      <p className="text-xs mb-0.5" style={{ color: "var(--muted2)" }}>Pipeline ({pct(l.weight)})</p>
                      <p className="font-bold font-mono text-sm" style={{ color: "var(--purple-c)" }}>{cur} {fmt(l.opportunity_weighted)}</p>
                    </div>
                  </div>
                  <div className="mb-3 px-1">
                    <MiniStepper lead={l} />
                  </div>
                  <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                    <button onClick={() => openModal(l)} className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => handleConvert(l.id)} className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--success-bg)", border: "1px solid rgba(16,185,129,.3)", color: "var(--accent)" }}>
                      <UserCheck size={12} /> Convert
                    </button>
                    <button onClick={() => handleDelete(l.id)} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--danger-bg)", color: "var(--red-c)" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <EmptyState icon="🎯" title={search || statusFilter ? "No leads match your filters" : "No leads yet"} description={search || statusFilter ? "Try adjusting your filters." : "Add your first lead to start tracking your pipeline."} />
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                    {["Date", "Name", "Status", "Product", "Opp", "Wt", "Pipeline", "Funnel", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const st = statuses.find(s => s.id === l.status_id);
                    const stColor = STATUS_COLORS[l.status_id ?? 0] || "var(--muted2)";
                    return (
                      <tr key={l.id} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(l.lead_date)}</td>
                        <td className="px-3 py-2 font-medium max-w-[160px] truncate">{l.name}</td>
                        <td className="px-3 py-2">
                          {st && <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: stColor + "22", color: stColor }}>{st.name}</span>}
                        </td>
                        <td className="px-3 py-2 max-w-[120px]">
                          {l.product_id && products.find(p => p.id === l.product_id) && (
                            <span className="px-2 py-0.5 rounded text-xs truncate block" style={{ background: "rgba(139,92,246,.15)", color: "var(--purple-c)", border: "1px solid rgba(139,92,246,.3)" }}>
                              {products.find(p => p.id === l.product_id)!.name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{cur} {fmt(l.opportunity_value)}</td>
                        <td className="px-3 py-2">{pct(l.weight)}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--purple-c)" }}>{cur} {fmt(l.opportunity_weighted)}</td>
                        <td className="px-3 py-2"><MiniStepper lead={l} /></td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openModal(l)} title="Edit" className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--card3)]" style={{ color: "var(--muted2)", border: "1px solid var(--border)" }}>
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => handleConvert(l.id)} title="Convert to Customer" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: "var(--accent)", background: "var(--success-bg)" }}>
                              <UserCheck size={12} />
                            </button>
                            <button onClick={() => handleDelete(l.id)} title="Archive" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: "var(--red-c)", background: "var(--danger-bg)" }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8}><EmptyState icon="🎯" title={search || statusFilter ? "No leads match your filters" : "No leads yet"} description={search || statusFilter ? "Try adjusting your filters." : "Add your first lead to start tracking your pipeline."} /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* KANBAN VIEW */}
      {view === "kanban" && (
        <>
          {/* Mode toggle */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              {([["standard", "Standard"], ["pipeline", "Pipeline"]] as const).map(([m, label]) => (
                <button key={m} onClick={() => setKanbanMode(m)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ background: kanbanMode === m ? "var(--accent)" : "var(--card2)", color: kanbanMode === m ? "#fff" : "var(--muted)" }}>
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs" style={{ color: "var(--muted2)" }}>
              {kanbanMode === "pipeline" ? "Columns show weighted pipeline value" : "Columns show lead count"}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-4">
            {statuses.map(status => {
              const colLeads = leads.filter(l => l.status_id === status.id);
              const stColor = STATUS_COLORS[status.id] || "var(--muted2)";
              const colWeighted = colLeads.reduce((s, l) => s + (l.opportunity_weighted ?? 0), 0);
              const colOpp = colLeads.reduce((s, l) => s + (l.opportunity_value ?? 0), 0);

              return (
                <div key={status.id} data-kcol={status.id}
                  className="shrink-0 rounded-lg w-64"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", minHeight: 200 }}
                  onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,.08)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
                  onDragLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                  onDrop={async e => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; await handleStatusDrop(e, status.id); }}>

                  {/* Column header */}
                  {kanbanMode === "standard" ? (
                    <div className="px-3 py-2.5 border-b flex justify-between items-center" style={{ borderColor: "var(--border)", borderTop: `3px solid ${stColor}` }}>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: stColor }}>{status.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--card2)", color: "var(--muted2)" }}>{colLeads.length}</span>
                    </div>
                  ) : (
                    <div className="px-3 pt-3 pb-2.5 border-b" style={{ borderColor: "var(--border)", borderTop: `3px solid ${stColor}` }}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: stColor }}>{status.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--card2)", color: "var(--muted2)" }}>{colLeads.length}</span>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Weighted Pipeline</p>
                        <p className="text-base font-bold font-mono" style={{ color: "var(--purple-c)" }}>{cur} {fmt(colWeighted)}</p>
                        <p className="text-[10px] font-mono" style={{ color: "var(--muted2)" }}>of {cur} {fmt(colOpp)} total opp</p>
                      </div>
                    </div>
                  )}

                  {/* Cards */}
                  <div className="p-2 space-y-2">
                    {colLeads.map(l => (
                      <div key={l.id} draggable
                        onDragStart={() => { dragId.current = l.id; }}
                        onDragEnd={() => { dragId.current = null; }}
                        onClick={() => openModal(l)}
                        className="rounded-lg cursor-grab active:cursor-grabbing transition-colors"
                        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>

                        {kanbanMode === "standard" ? (
                          <div className="p-2.5">
                            <p className="text-xs font-semibold truncate">{l.name}</p>
                            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--muted2)" }}>{cur} {fmt(l.opportunity_value)}</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>{fdate(l.lead_date)}</p>
                          </div>
                        ) : (
                          <div className="p-2.5">
                            <p className="text-xs font-semibold truncate mb-1.5">{l.name}</p>
                            <div className="flex items-end justify-between mb-2">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Weighted</p>
                                <p className="text-sm font-bold font-mono" style={{ color: "var(--purple-c)" }}>{cur} {fmt(l.opportunity_weighted)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Opp × {pct(l.weight)}</p>
                                <p className="text-xs font-mono" style={{ color: "var(--muted2)" }}>{cur} {fmt(l.opportunity_value)}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {(["contacted", "responded", "developed", "completed"] as const).map(f => (
                                <div key={f} className="flex-1 text-center">
                                  <div className="w-5 h-5 mx-auto rounded-full flex items-center justify-center text-[9px] font-bold"
                                    style={{ background: l[f] ? "rgba(16,185,129,.2)" : "var(--card)", color: l[f] ? "var(--accent)" : "var(--muted2)", border: `1px solid ${l[f] ? "var(--accent)" : "var(--border)"}` }}>
                                    {l[f] ? "✓" : "○"}
                                  </div>
                                  <p className="text-[9px] mt-0.5 capitalize" style={{ color: "var(--muted2)" }}>{f.slice(0, 4)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {colLeads.length === 0 && (
                      <p className="text-xs text-center py-4 italic" style={{ color: "var(--muted2)" }}>Empty</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* CARDS / TINDER VIEW */}
      {view === "cards" && (
        <SwipeView
          leads={filtered}
          statuses={statuses}
          cur={cur}
          onStatusChange={async (id, newStatusId) => {
            await updateLeadStatus(id, newStatusId);
          }}
        />
      )}

      {/* MODAL */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center sm:p-4 sm:pt-16 overflow-y-auto" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="sm:hidden w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: "var(--border)" }} />
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">{modal.lead ? `Edit Lead #${modal.lead.id}` : "New Lead"}</h3>
              <button onClick={closeModal} className="text-lg" style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                setBusy(true);
                try {
                  if (modal.lead) await updateLead(modal.lead.id, fd);
                  else await createLead(fd);
                  closeModal();
                } finally { setBusy(false); }
              }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Name *</label>
                  <input name="name" required defaultValue={modal.lead?.name || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Lead Date</label>
                  <DateInput name="lead_date" value={modalLeadDate} onChange={setModalLeadDate} placeholder="Lead date" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Phone</label>
                  <input name="phone" defaultValue={modal.lead?.phone || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Contact Person</label>
                  <input name="contact" defaultValue={modal.lead?.contact || ""} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                  <select name="status_id" defaultValue={modal.lead?.status_id ?? ""} className={inputStyle} style={inputCss}>
                    <option value="">— Select —</option>
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Follow Up Date</label>
                  <DateInput name="last_follow_up" value={modalFollowUp} onChange={setModalFollowUp} placeholder="Follow-up date" />
                </div>
              </div>
              {products.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Product / Service of Interest</label>
                  <select name="product_id" defaultValue={modal.lead?.product_id ?? ""} className={inputStyle} style={inputCss}>
                    <option value="">— None (optional) —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {operators.length > 0 && ["owner", "admin"].includes(currentRole) && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Assign to Operator</label>
                  <select name="assigned_to" defaultValue={modal.lead?.assigned_to ?? ""} className={inputStyle} style={inputCss}>
                    <option value="">— Unassigned —</option>
                    {operators.map(op => (
                      <option key={op.user_id} value={op.user_id}>{op.email}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Opportunity Value</label>
                  <input name="opportunity_value" type="number" step="0.01" defaultValue={modal.lead?.opportunity_value || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Weight (%)</label>
                  <input name="weight" type="number" min="0" max="100" step="1" value={modalWeight} onChange={e => setModalWeight(Number(e.target.value))} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Total Revenue</label>
                  <input name="total_revenue" type="number" step="0.01" defaultValue={modal.lead?.total_revenue || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Secured Revenue</label>
                  <input name="secured_revenue" type="number" step="0.01" defaultValue={modal.lead?.secured_revenue || ""} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-3" style={{ color: "var(--muted2)" }}>Activity Progress</label>
                <FunnelStepper state={funnelState} onChange={next => { setFunnelState(next); setModalWeight(computeDefaultWeight(next)); }} />
                {FUNNEL_STEPS.map(f => (
                  <input key={f} type="hidden" name={f} value={String(funnelState[f])} />
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2 text-sm font-semibold rounded" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : modal.lead ? "Update Lead" : "Create Lead"}
                </button>
              </div>
            </form>
            {modal.lead && (
              <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: "var(--border)" }}>
                <button onClick={() => handleConvert(modal.lead!.id)}
                  className="w-full py-2 text-sm rounded border mt-3 font-semibold"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                  🔄 Convert to Customer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} confirmLabel="Confirm" />
    </div>
  );
}
