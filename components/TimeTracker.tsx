"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { useConfirm } from "@/hooks/useConfirm";
import { createClient } from "@/lib/supabase/client";
import { logTime, deleteTimeEntry, type TrackedEntity } from "@/server-actions/tracking";

type TimeEntry = {
  id: number;
  minutes: number;
  note: string | null;
  spent_on: string;
  author_id: string | null;
  created_at: string;
};
type Member = { user_id: string; email: string };

type Props = {
  entityType: TrackedEntity;
  entityId: number;
  members?: Member[];
  canEdit?: boolean;
  canDelete?: boolean;
  /** Rendered on the leads page to avoid a load flash; R&D loads on demand. */
  initialEntries?: TimeEntry[];
  /** Notified after any change so a parent can refresh derived totals. */
  onChanged?: () => void;
};

const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

/** Convert "1h 30m", "90m", "1.5h" or a bare number (minutes) into total minutes. */
export function parseDuration(raw: string): number {
  const s = raw.trim().toLowerCase();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s)); // bare number = minutes
  let total = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = s.match(/(\d+(?:\.\d+)?)\s*m/);
  if (h) total += parseFloat(h[1]) * 60;
  if (m) total += parseFloat(m[1]);
  return Math.round(total);
}

/** Human-readable duration, e.g. 90 → "1h 30m". */
export function formatDuration(min: number): string {
  if (!min) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

function fdate(d: string) {
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}

export function TimeTracker({
  entityType, entityId, members = [], canEdit = true, canDelete = true, initialEntries, onChanged,
}: Props) {
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries ?? []);
  const [loading, setLoading] = useState(!initialEntries);
  const [dur, setDur] = useState("");
  const [note, setNote] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("time_entries")
        .select("id, minutes, note, spent_on, author_id, created_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false });
      setEntries((data as TimeEntry[]) ?? []);
    } catch { /* swallow — RLS or offline */ }
    finally { setLoading(false); }
  }, [entityType, entityId]);

  // Genuine external-store (Supabase) load on mount / entity change. The
  // set-state-in-effect concern doesn't apply — see AiChatCore for the same pattern.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const total = entries.reduce((s, e) => s + e.minutes, 0);

  async function submit() {
    const minutes = parseDuration(dur);
    if (minutes <= 0) { toast.error('Enter a time like "45m", "1h 30m" or "1.5h".'); return; }
    setBusy(true);
    try {
      await logTime({ entityType, entityId, minutes, note, spentOn: spentOn || null });
      setDur(""); setNote(""); setSpentOn("");
      await load();
      onChanged?.();
      toast.success(`Logged ${formatDuration(minutes)}`);
    } catch { toast.error("Failed to log time"); }
    finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!await confirm("Delete this time entry?", "This entry will be permanently removed.")) return;
    try {
      await deleteTimeEntry(id, entityType, entityId);
      await load();
      onChanged?.();
      toast.success("Time entry deleted");
    } catch { toast.error("Failed to delete"); }
  }

  const authorName = (id: string | null) => {
    if (!id) return "Someone";
    const email = members.find(m => m.user_id === id)?.email;
    return email ? email.split("@")[0] : "Someone";
  };

  return (
    <div className="space-y-4">
      {/* Total */}
      <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Total time invested</span>
        <span className="text-lg font-bold font-mono" style={{ color: "var(--accent)" }}>{formatDuration(total)}</span>
      </div>

      {/* Log form */}
      {canEdit && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Time spent *</label>
              <input value={dur} onChange={e => setDur(e.target.value)} className={inp} style={inpS}
                placeholder='e.g. 45m, 1h 30m'
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Date</label>
              <DateInput name="spent_on" value={spentOn} onChange={setSpentOn} placeholder="Today" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>What did you do?</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={inp} style={{ ...inpS, resize: "none" }}
              placeholder="Optional note…" />
          </div>
          <button onClick={submit} disabled={busy || !dur.trim()}
            className="w-full py-2 text-sm font-semibold rounded disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}>
            {busy ? "Logging…" : "＋ Log time"}
          </button>
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="py-6 text-center text-sm" style={{ color: "var(--muted2)" }}>Loading…</div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-center py-6 rounded-lg" style={{ color: "var(--muted2)", background: "var(--card2)", border: "1px solid var(--border)" }}>
          No time logged yet
        </p>
      ) : (
        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {entries.map(e => (
            <div key={e.id} className="rounded-lg p-3 flex items-start gap-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <span className="text-sm font-bold font-mono shrink-0 px-2 py-0.5 rounded" style={{ background: "var(--card3)", color: "var(--accent)" }}>
                {formatDuration(e.minutes)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--muted2)" }}>
                  <span>@{authorName(e.author_id)}</span>
                  <span>·</span>
                  <span>{fdate(e.spent_on)}</span>
                </div>
                {e.note && <p className="text-sm mt-0.5 whitespace-pre-wrap leading-relaxed">{e.note}</p>}
              </div>
              {canDelete && (
                <button onClick={() => remove(e.id)} className="px-2 py-1 rounded text-xs shrink-0"
                  style={{ border: "1px solid var(--border)", background: "var(--card)" }} title="Delete entry">🗑️</button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog {...dialogProps} confirmLabel="Delete" />
    </div>
  );
}
