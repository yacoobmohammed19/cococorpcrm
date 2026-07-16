"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { createActivity, toggleActivity, deleteActivity } from "@/server-actions/activities";
import { DEFAULT_LEAD_STAGES, type LeadStage } from "@/lib/lead-stages";

type Activity = { id: number; type: string; subject: string; notes: string | null; due_date: string | null; done: boolean; created_at: string };
type Lead = {
  id: number; name: string; phone: string | null; contact: string | null;
  lead_date: string | null; last_follow_up: string | null;
  opportunity_value: number | null; weight: number | null;
  contacted: boolean; responded: boolean; developed: boolean; completed: boolean;
};

const ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Task", "Note"];
const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}
function fmt(n: number | null) { return (n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

const dot = (v: boolean, label: string) => (
  <div className="flex flex-col items-center gap-1">
    <div className="w-3 h-3 rounded-full" style={{ background: v ? "var(--accent)" : "var(--card3)", border: "2px solid " + (v ? "var(--accent)" : "var(--border)") }} />
    <span className="text-xs" style={{ color: v ? "var(--accent)" : "var(--muted2)" }}>{label}</span>
  </div>
);

export function LeadDetailClient({ lead, activities, currency, leadId, stages = DEFAULT_LEAD_STAGES }: {
  lead: Lead; activities: Activity[]; currency: string; leadId: number; stages?: LeadStage[];
}) {
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [activityDueDate, setActivityDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const weightedValue = ((lead.opportunity_value ?? 0) * ((lead.weight ?? 0) / 100));

  return (
    <div className="space-y-4">
      {/* Lead Info Card */}
      <div className="rounded-lg p-5" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--muted2)" }}>Lead Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
          {[["Lead Date", fdate(lead.lead_date)], ["Follow-up", fdate(lead.last_follow_up)], ["Phone", lead.phone || "—"], ["Contact", lead.contact || "—"]].map(([l, v]) => (
            <div key={l}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted2)" }}>{l}</div>
              <div>{v}</div>
            </div>
          ))}
        </div>

        {/* Pipeline values */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {[["Opportunity Value", lead.opportunity_value ?? 0, "var(--purple-c)"], ["Weight", `${lead.weight ?? 0}%`, "var(--muted)"], ["Weighted Pipeline", weightedValue, "var(--accent)"]].map(([l, v, c]) => (
            <div key={l as string} className="rounded p-3 text-center" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
              <div className="text-lg font-bold font-mono" style={{ color: c as string }}>
                {typeof v === "number" ? `${currency} ${fmt(v)}` : v}
              </div>
            </div>
          ))}
        </div>

        {/* Funnel indicators */}
        <div className="flex gap-6 justify-center py-2 border-t" style={{ borderColor: "var(--border)" }}>
          {stages.map(s => <div key={s.key}>{dot(lead[s.key], s.label)}</div>)}
        </div>
      </div>

      {/* Activities */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-semibold">Activities</h2>
          <button onClick={() => { setActivityDueDate(""); setActivityModal(true); }}
            className="text-xs px-3 py-1.5 rounded font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}>+ Log Activity</button>
        </div>
        <div className="space-y-2">
          {activities.map(a => (
            <div key={a.id} className="rounded-lg p-3 flex items-start gap-3" style={{ background: "var(--card2)", border: "1px solid var(--border)", opacity: a.done ? .6 : 1 }}>
              <button onClick={async () => { try { await toggleActivity(a.id, !a.done, leadId); } catch { toast.error("Failed"); } }}
                className="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ borderColor: a.done ? "var(--accent)" : "var(--border)", background: a.done ? "var(--accent)" : "transparent", color: "#fff" }}>
                {a.done ? "✓" : ""}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--card3)", color: "var(--muted)" }}>{a.type}</span>
                  <span className="text-sm font-medium" style={{ textDecoration: a.done ? "line-through" : "none" }}>{a.subject}</span>
                  {a.due_date && <span className="text-xs" style={{ color: !a.done && new Date(a.due_date) < new Date() ? "var(--red-c)" : "var(--muted2)" }}>Due {fdate(a.due_date)}</span>}
                </div>
                {a.notes && <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>{a.notes}</p>}
              </div>
              <button onClick={async () => { if (!await confirm("Delete activity?", "This activity will be permanently removed.")) return; await runAction(() => deleteActivity(a.id, leadId), toast, "Activity deleted"); }}
                className="px-2 py-1 rounded text-xs shrink-0" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>🗑️</button>
            </div>
          ))}
          {activities.length === 0 && (
            <p className="text-sm text-center py-6 rounded-lg" style={{ color: "var(--muted2)", background: "var(--card2)", border: "1px solid var(--border)" }}>
              No activities logged yet
            </p>
          )}
        </div>
      </div>

      {/* Activity Modal */}
      {activityModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setActivityModal(false); }}>
          <div className="w-full max-w-md rounded-xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">Log Activity</h3>
              <button onClick={() => setActivityModal(false)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                fd.set("lead_id", String(leadId));
                setBusy(true);
                try { await createActivity(fd); toast.success("Activity logged"); setActivityModal(false); }
                catch { toast.error("Failed to log activity"); }
                finally { setBusy(false); }
              }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Type *</label>
                  <select name="type" className={inp} style={inpS}>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Due Date</label>
                  <DateInput name="due_date" value={activityDueDate} onChange={setActivityDueDate} placeholder="Due date (optional)" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Subject *</label>
                  <input name="subject" required className={inp} style={inpS} placeholder="e.g. Follow-up call, Send proposal…" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                  <textarea name="notes" rows={3} className={inp + " resize-none"} style={inpS} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setActivityModal(false)} className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2 text-sm font-semibold rounded" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : "Log Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} confirmLabel="Delete" />
    </div>
  );
}
