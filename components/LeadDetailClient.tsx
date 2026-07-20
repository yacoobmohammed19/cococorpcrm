"use client";

import { useState, useCallback } from "react";
import { Clock, MessageSquare, History as HistoryIcon, ListChecks } from "lucide-react";
import { useToast } from "@/components/Toast";
import { TimeTracker } from "@/components/TimeTracker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { createClient } from "@/lib/supabase/client";
import { createActivity, toggleActivity, deleteActivity } from "@/server-actions/activities";
import { addEntityComment, deleteEntityComment } from "@/server-actions/tracking";

type Activity = { id: number; type: string; subject: string; notes: string | null; due_date: string | null; done: boolean; created_at: string };
type TimeEntry = { id: number; minutes: number; note: string | null; spent_on: string; author_id: string | null; created_at: string };
type Comment = { id: number; content: string; author_id: string | null; created_at: string };
type HistoryRow = { id: number; action: string; before_state: Record<string, unknown> | null; after_state: Record<string, unknown> | null; user_id: string | null; created_at: string };
type Status = { id: number; name: string };
type Member = { user_id: string; email: string };
type Lead = {
  id: number; name: string; phone: string | null; contact: string | null;
  lead_date: string | null; last_follow_up: string | null;
  opportunity_value: number | null; weight: number | null;
  contacted: boolean; responded: boolean; developed: boolean; completed: boolean;
};

const ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Task", "Note"];
const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

// Fields worth surfacing in the change history, with friendly labels.
const HISTORY_FIELDS: Record<string, string> = {
  name: "Name", phone: "Phone", contact: "Contact", status_id: "Status",
  lead_date: "Lead date", last_follow_up: "Follow-up",
  opportunity_value: "Opportunity value", weight: "Weight",
  contacted: "Contacted", responded: "Responded", developed: "Developed", completed: "Completed",
  total_revenue: "Total revenue", secured_revenue: "Secured revenue",
};

function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}
function ftime(d: string) {
  return new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmt(n: number | null) { return (n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

const dot = (v: boolean, label: string) => (
  <div className="flex flex-col items-center gap-1">
    <div className="w-3 h-3 rounded-full" style={{ background: v ? "var(--accent)" : "var(--card3)", border: "2px solid " + (v ? "var(--accent)" : "var(--border)") }} />
    <span className="text-xs" style={{ color: v ? "var(--accent)" : "var(--muted2)" }}>{label}</span>
  </div>
);

export function LeadDetailClient({
  lead, activities, timeEntries, comments: initialComments, history, statuses, members,
  currency, leadId, canEdit, canDelete,
}: {
  lead: Lead; activities: Activity[]; timeEntries: TimeEntry[]; comments: Comment[];
  history: HistoryRow[]; statuses: Status[]; members: Member[];
  currency: string; leadId: number; canEdit: boolean; canDelete: boolean;
}) {
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [tab, setTab] = useState<"time" | "comments" | "history" | "activities">("time");
  const [activityDueDate, setActivityDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const weightedValue = ((lead.opportunity_value ?? 0) * ((lead.weight ?? 0) / 100));

  // ── Comments ────────────────────────────────────────────────────────────
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [commentInput, setCommentInput] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const reloadComments = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("entity_comments")
        .select("id, content, author_id, created_at")
        .eq("entity_type", "lead").eq("entity_id", leadId)
        .order("created_at", { ascending: false });
      setComments((data as Comment[]) ?? []);
    } catch { /* swallow */ }
  }, [leadId]);

  async function postComment() {
    if (!commentInput.trim()) return;
    setCommentBusy(true);
    try {
      await addEntityComment({ entityType: "lead", entityId: leadId, content: commentInput.trim() });
      setCommentInput("");
      await reloadComments();
    } catch { toast.error("Failed to post comment"); }
    finally { setCommentBusy(false); }
  }

  async function removeComment(id: number) {
    if (!await confirm("Delete this comment?", "This comment will be permanently removed.")) return;
    try { await deleteEntityComment(id, "lead", leadId); await reloadComments(); toast.success("Comment deleted"); }
    catch { toast.error("Failed to delete"); }
  }

  const authorName = (id: string | null) => {
    if (!id) return "Someone";
    const email = members.find(m => m.user_id === id)?.email;
    return email ? email.split("@")[0] : "Someone";
  };

  // Render a raw column value into something readable for the history feed.
  const renderVal = (key: string, val: unknown): string => {
    if (val === null || val === undefined || val === "") return "—";
    if (key === "status_id") return statuses.find(s => s.id === Number(val))?.name ?? String(val);
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (["opportunity_value", "weight", "total_revenue", "secured_revenue"].includes(key)) return fmt(Number(val));
    if (["lead_date", "last_follow_up"].includes(key)) return fdate(String(val));
    return String(val);
  };

  // Compute the human-readable changes for one history row.
  const changesFor = (row: HistoryRow): { label: string; from: string; to: string }[] => {
    if (row.action !== "update" || !row.before_state || !row.after_state) return [];
    const out: { label: string; from: string; to: string }[] = [];
    for (const [key, label] of Object.entries(HISTORY_FIELDS)) {
      const b = row.before_state[key];
      const a = row.after_state[key];
      // Loose compare (numbers may arrive as strings from JSON)
      if (String(b ?? "") !== String(a ?? "")) {
        out.push({ label, from: renderVal(key, b), to: renderVal(key, a) });
      }
    }
    return out;
  };

  const tabs = [
    { key: "time" as const, label: "Time", icon: Clock, count: timeEntries.length },
    { key: "comments" as const, label: "Comments", icon: MessageSquare, count: comments.length },
    { key: "history" as const, label: "History", icon: HistoryIcon, count: history.length },
    { key: "activities" as const, label: "Activities", icon: ListChecks, count: activities.length },
  ];

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
          {dot(lead.contacted, "Contacted")}
          {dot(lead.responded, "Responded")}
          {dot(lead.developed, "Developed")}
          {dot(lead.completed, "Completed")}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-xs font-semibold capitalize border-b-2 -mb-px transition-colors whitespace-nowrap"
            style={{ borderColor: tab === t.key ? "var(--accent)" : "transparent", color: tab === t.key ? "var(--accent)" : "var(--muted2)" }}>
            <span className="flex items-center gap-1.5">
              <t.icon size={12} />
              {t.label}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--card3)", color: "var(--muted2)" }}>{t.count}</span>
            </span>
          </button>
        ))}
      </div>

      {/* ── TIME ─────────────────────────────────────────────────────────── */}
      {tab === "time" && (
        <TimeTracker
          entityType="lead" entityId={leadId} members={members}
          canEdit={canEdit} canDelete={canDelete} initialEntries={timeEntries}
        />
      )}

      {/* ── COMMENTS ─────────────────────────────────────────────────────── */}
      {tab === "comments" && (
        <div className="space-y-4">
          {canEdit && (
            <div className="space-y-2">
              <textarea value={commentInput} onChange={e => setCommentInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void postComment(); }}
                rows={3} placeholder="Add a comment or note… (Ctrl+Enter to post)"
                className={inp} style={{ ...inpS, resize: "none" }} />
              <button onClick={postComment} disabled={commentBusy || !commentInput.trim()}
                className="px-4 py-2 text-sm font-semibold rounded disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff" }}>
                {commentBusy ? "Posting…" : "Post Comment"}
              </button>
            </div>
          )}
          {comments.length === 0 ? (
            <p className="text-sm text-center py-6 rounded-lg" style={{ color: "var(--muted2)", background: "var(--card2)", border: "1px solid var(--border)" }}>
              No comments yet
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="rounded-xl p-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>@{authorName(c.author_id)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: "var(--muted2)" }}>{ftime(c.created_at)}</span>
                      {canDelete && <button onClick={() => removeComment(c.id)} className="text-[10px]" style={{ color: "var(--red-c)" }}>✕</button>}
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY ──────────────────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-center py-6 rounded-lg" style={{ color: "var(--muted2)", background: "var(--card2)", border: "1px solid var(--border)" }}>
              No history recorded yet
            </p>
          ) : history.map(row => {
            const changes = changesFor(row);
            const isCreate = row.action === "insert";
            const isDelete = row.action === "delete";
            return (
              <div key={row.id} className="rounded-lg p-3 flex gap-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: isCreate ? "var(--accent)" : isDelete ? "var(--red-c)" : "var(--muted2)" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {isCreate ? "Lead created" : isDelete ? "Lead deleted" : "Lead updated"}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: "var(--muted2)" }}>{ftime(row.created_at)}</span>
                  </div>
                  <div className="text-[10px] mb-1" style={{ color: "var(--muted2)" }}>@{authorName(row.user_id)}</div>
                  {changes.length > 0 && (
                    <ul className="text-xs space-y-0.5" style={{ color: "var(--muted2)" }}>
                      {changes.map((c, i) => (
                        <li key={i}>
                          <span className="font-medium" style={{ color: "var(--foreground)" }}>{c.label}</span>: {c.from} → <span style={{ color: "var(--foreground)" }}>{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ACTIVITIES ───────────────────────────────────────────────────── */}
      {tab === "activities" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold">Activities</h2>
            {canEdit && (
              <button onClick={() => { setActivityDueDate(""); setActivityModal(true); }}
                className="text-xs px-3 py-1.5 rounded font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}>+ Log Activity</button>
            )}
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
                {canDelete && (
                  <button onClick={async () => { if (!await confirm("Delete activity?", "This activity will be permanently removed.")) return; await runAction(() => deleteActivity(a.id, leadId), toast, "Activity deleted"); }}
                    className="px-2 py-1 rounded text-xs shrink-0" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>🗑️</button>
                )}
              </div>
            ))}
            {activities.length === 0 && (
              <p className="text-sm text-center py-6 rounded-lg" style={{ color: "var(--muted2)", background: "var(--card2)", border: "1px solid var(--border)" }}>
                No activities logged yet
              </p>
            )}
          </div>
        </div>
      )}

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
