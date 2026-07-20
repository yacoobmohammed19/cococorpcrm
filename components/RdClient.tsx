"use client";

import { useState, useRef, useCallback } from "react";
import { GripVertical, MessageSquare, Clock } from "lucide-react";
import { useToast } from "@/components/Toast";
import { TimeTracker } from "@/components/TimeTracker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { useConfirm } from "@/hooks/useConfirm";
import { useOptimisticList } from "@/hooks/useOptimisticList";
import { createClient } from "@/lib/supabase/client";
import {
  createRdStatus, updateRdStatus, deleteRdStatus, reorderRdStatuses,
  createRdProject, updateRdProject, updateRdProjectStatus, deleteRdProject,
  finalizeRdProject, addRdProjectUpdate,
} from "@/server-actions/rd";

type RdStatus = { id: number; name: string; color: string; position: number };
type RdProject = {
  id: number; name: string; description: string | null; status_id: number | null;
  target_date: string | null; assigned_to: string | null; priority: string;
  budget_estimate: number | null; notes: string | null;
  product_id: number | null; finalized_at: string | null; created_at: string;
};
type Member = { user_id: string; email: string };
type ProjectUpdate = { id: number; content: string; author_id: string | null; created_at: string };

type Props = {
  statuses: RdStatus[];
  projects: RdProject[];
  members: Member[];
  currency: string;
  currentRole: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "var(--muted2)", medium: "var(--amber-c)", high: "var(--red-c)",
};
const PRIORITY_BG: Record<string, string> = {
  low: "var(--card3)", medium: "rgba(245,158,11,.15)", high: "rgba(239,68,68,.12)",
};

const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

function fmt(n: number) { return n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fdate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}
function ftime(d: string) {
  return new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const SWATCH_COLORS = ["#ec4899","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#e84393","#84cc16","#f97316","#64748b"];

// ProjectCard is stable (defined outside the component) so React doesn't remount it on every render
function ProjectCard({
  p, members, currency, canEdit, onEdit, onDragStart, onDragEnd,
}: {
  p: RdProject; members: Member[]; currency: string; canEdit: boolean;
  onEdit: (p: RdProject) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
}) {
  const isFinalized = !!p.finalized_at;
  const assigneeName = members.find(m => m.user_id === p.assigned_to)?.email?.split("@")[0] ?? null;
  const overdue = p.target_date && !isFinalized && new Date(p.target_date) < new Date();
  return (
    <div
      draggable={canEdit && !isFinalized}
      onDragStart={() => onDragStart(p.id)}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(p)}
      className="rounded-xl p-3 cursor-pointer select-none transition-shadow hover:shadow-md"
      style={{ background: "var(--card2)", border: "1px solid var(--border)", opacity: isFinalized ? 0.6 : 1 }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-semibold text-sm leading-snug flex-1">{p.name}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: PRIORITY_BG[p.priority], color: PRIORITY_COLORS[p.priority] }}>
          {p.priority}
        </span>
      </div>
      {p.description && (
        <p className="text-xs mb-1.5 line-clamp-2" style={{ color: "var(--muted2)" }}>{p.description}</p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]" style={{ color: "var(--muted2)" }}>
        {p.target_date && (
          <span style={{ color: overdue ? "var(--red-c)" : "var(--muted2)" }}>
            {overdue ? "⚠ " : ""}Due {fdate(p.target_date)}
          </span>
        )}
        {p.budget_estimate && <span className="font-mono">{currency} {fmt(p.budget_estimate)}</span>}
        {assigneeName && <span>@{assigneeName}</span>}
        {isFinalized && <span style={{ color: "var(--accent)" }}>✓ Finalized</span>}
      </div>
    </div>
  );
}

export function RdClient({ statuses: initialStatuses, projects: initialProjects, members, currency, currentRole }: Props) {
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const canEdit = ["owner", "admin", "member"].includes(currentRole);
  const canDelete = ["owner", "admin"].includes(currentRole);

  const {
    items: statusItems, add: addStatus, update: updateStatus, remove: removeStatus, setItems: setStatuses,
  } = useOptimisticList(initialStatuses, toast);
  const statuses = [...statusItems].sort((a, b) => a.position - b.position);
  const {
    items: projects, add: addProject, update: updateProject, remove: removeProject,
  } = useOptimisticList(initialProjects, toast);
  const [view, setView] = useState<"kanban" | "table">("kanban");

  // ── Column manager ────────────────────────────────────────────────────────
  const [colPanel, setColPanel] = useState(false);
  const [editingStatus, setEditingStatus] = useState<RdStatus | null>(null);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState(SWATCH_COLORS[0]);

  // ── Project modal ─────────────────────────────────────────────────────────
  const [projectModal, setProjectModal] = useState<{ open: boolean; project: RdProject | null }>({ open: false, project: null });
  const [modalTab, setModalTab] = useState<"details" | "updates" | "time">("details");
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pStatus, setPStatus] = useState<number | null>(null);
  const [pTargetDate, setPTargetDate] = useState("");
  const [pAssigned, setPAssigned] = useState("");
  const [pPriority, setPPriority] = useState("medium");
  const [pBudget, setPBudget] = useState<number | "">("");
  const [pNotes, setPNotes] = useState("");

  // ── Project updates log ──────────────────────────────────────────────────
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updateInput, setUpdateInput] = useState("");
  const [updateBusy, setUpdateBusy] = useState(false);

  // ── Finalize modal ────────────────────────────────────────────────────────
  const [finalizeProject, setFinalizeProject] = useState<RdProject | null>(null);
  const [fName, setFName] = useState("");
  const [fSku, setFSku] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fPrice, setFPrice] = useState<number | "">(0);
  const [fCategory, setFCategory] = useState("");

  // ── Card drag & drop ──────────────────────────────────────────────────────
  const dragId = useRef<number | null>(null);

  // ── Column drag & drop ────────────────────────────────────────────────────
  const colDragId = useRef<number | null>(null);
  // State mirror of colDragId for the render path (a ref can't be read during render).
  // Handlers keep using the ref for synchronous checks; this only drives display.
  const [draggingColId, setDraggingColId] = useState<number | null>(null);
  const [colDragOver, setColDragOver] = useState<number | null>(null);

  // ── Fetch updates ─────────────────────────────────────────────────────────
  const loadUpdates = useCallback(async (projectId: number) => {
    setUpdatesLoading(true);
    setUpdates([]);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("rd_project_updates")
        .select("id, content, author_id, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      setUpdates((data as ProjectUpdate[]) ?? []);
    } catch { /* swallow */ }
    finally { setUpdatesLoading(false); }
  }, []);

  function openCreate(statusId?: number) {
    setProjectModal({ open: true, project: null });
    setModalTab("details");
    setPName(""); setPDesc(""); setPStatus(statusId ?? statuses[0]?.id ?? null);
    setPTargetDate(""); setPAssigned(""); setPPriority("medium"); setPBudget(""); setPNotes("");
    setUpdates([]);
  }

  function openEdit(p: RdProject) {
    setProjectModal({ open: true, project: p });
    setModalTab("details");
    setPName(p.name); setPDesc(p.description ?? ""); setPStatus(p.status_id);
    setPTargetDate(p.target_date ?? ""); setPAssigned(p.assigned_to ?? "");
    setPPriority(p.priority); setPBudget(p.budget_estimate ?? ""); setPNotes(p.notes ?? "");
    setUpdateInput("");
    setUpdates([]);
  }

  function openFinalize(p: RdProject) {
    setFinalizeProject(p);
    setFName(p.name); setFSku(""); setFDesc(p.description ?? "");
    setFPrice(p.budget_estimate ?? 0); setFCategory("");
  }

  function saveProject() {
    if (!pName.trim()) return;
    const data = {
      name: pName.trim(), description: pDesc || null, status_id: pStatus,
      target_date: pTargetDate || null, assigned_to: pAssigned || null,
      priority: pPriority,
      budget_estimate: pBudget !== "" ? Number(pBudget) : null,
      notes: pNotes || null,
    };
    const editing = projectModal.project;
    setProjectModal({ open: false, project: null });
    if (editing) {
      void updateProject(editing.id, data, () => updateRdProject(editing.id, data), { success: "Project updated" });
    } else {
      const temp: RdProject = {
        id: -Date.now(), ...data, product_id: null, finalized_at: null, created_at: new Date().toISOString(),
      };
      void addProject(temp, () => createRdProject(data), { success: "Project created" });
    }
  }

  async function handlePostUpdate() {
    if (!updateInput.trim() || !projectModal.project) return;
    setUpdateBusy(true);
    try {
      await addRdProjectUpdate(projectModal.project.id, updateInput.trim());
      setUpdateInput("");
      await loadUpdates(projectModal.project.id);
    } catch { toast.error("Failed to post update"); }
    finally { setUpdateBusy(false); }
  }

  function handleFinalize() {
    if (!finalizeProject || !fName.trim()) return;
    const id = finalizeProject.id;
    const name = fName.trim();
    const productData = {
      name, sku: fSku || null, description: fDesc || null,
      unit_price: Number(fPrice) || 0, category: fCategory || null,
    };
    setFinalizeProject(null);
    void updateProject(
      id, { finalized_at: new Date().toISOString() },
      () => finalizeRdProject(id, productData),
      { success: `"${name}" added to Products` },
    );
  }

  // ── Card drag handlers ────────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent, statusId: number | null) {
    e.preventDefault();
    if (colDragId.current !== null) return;
    if (dragId.current === null) return;
    const id = dragId.current;
    dragId.current = null;
    void updateProject(id, { status_id: statusId }, () => updateRdProjectStatus(id, statusId), { success: "Moved" });
  }

  // ── Column drag handlers ──────────────────────────────────────────────────
  function handleColDragStart(e: React.DragEvent, colId: number) {
    e.stopPropagation();
    colDragId.current = colId;
    setDraggingColId(colId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleColDragOver(e: React.DragEvent, colId: number) {
    if (colDragId.current === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (colDragOver !== colId) setColDragOver(colId);
  }

  function handleColDrop(e: React.DragEvent, targetId: number) {
    e.preventDefault();
    e.stopPropagation();
    setColDragOver(null);
    const fromId = colDragId.current;
    colDragId.current = null;
    setDraggingColId(null);
    if (!fromId || fromId === targetId) return;

    const reordered = [...statuses];
    const fi = reordered.findIndex(s => s.id === fromId);
    const ti = reordered.findIndex(s => s.id === targetId);
    if (fi === -1 || ti === -1) return;
    const [item] = reordered.splice(fi, 1);
    reordered.splice(ti, 0, item);
    const withPositions = reordered.map((s, i) => ({ ...s, position: i }));
    setStatuses(withPositions);
    void reorderRdStatuses(withPositions.map(s => ({ id: s.id, position: s.position })));
  }

  // ── Column management ─────────────────────────────────────────────────────
  function addColumn() {
    if (!newColName.trim()) return;
    const name = newColName.trim();
    const color = newColColor;
    const maxPos = statuses.reduce((m, s) => Math.max(m, s.position), -1);
    const temp: RdStatus = { id: -new Date().getTime(), name, color, position: maxPos + 1 };
    setNewColName(""); setNewColColor(SWATCH_COLORS[0]);
    void addStatus(temp, () => createRdStatus(name, color), { success: "Column added" });
  }

  function saveColumn() {
    if (!editingStatus || !editingStatus.name.trim()) return;
    const { id, name, color } = editingStatus;
    setEditingStatus(null);
    void updateStatus(id, { name, color }, () => updateRdStatus(id, name, color), { success: "Column updated" });
  }

  async function removeColumn(id: number) {
    if (!await confirm("Delete this column?", "Projects in this column will become unassigned.")) return;
    void removeStatus(id, () => deleteRdStatus(id), { success: "Column deleted" });
  }

  const unassigned = projects.filter(p => p.status_id === null || !statuses.find(s => s.id === p.status_id));

  return (
    <div className="flex flex-col h-full min-h-0" style={{ gap: 0 }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold">R&D Board</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>
            {projects.filter(p => !p.finalized_at).length} active · {projects.filter(p => !!p.finalized_at).length} finalized
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {(["kanban", "table"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-semibold capitalize"
                style={{ background: view === v ? "var(--accent)" : "var(--card2)", color: view === v ? "#fff" : "var(--muted2)" }}>
                {v}
              </button>
            ))}
          </div>
          {canEdit && (
            <button onClick={() => setColPanel(true)}
              className="px-3 py-1.5 text-xs rounded font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              ⚙ Columns
            </button>
          )}
          {canEdit && (
            <button onClick={() => openCreate()}
              className="px-3 py-1.5 text-xs rounded font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}>
              + New Project
            </button>
          )}
        </div>
      </div>

      {/* ── KANBAN VIEW ─────────────────────────────────────────────────── */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0" style={{ alignItems: "flex-start" }}>
          {statuses.map(status => {
            const cols = projects.filter(p => p.status_id === status.id);
            const isDragTarget = colDragOver === status.id && draggingColId !== status.id;
            return (
              <div key={status.id}
                className="flex-shrink-0 flex flex-col rounded-xl transition-all"
                style={{
                  width: 272,
                  background: "var(--card2)",
                  border: isDragTarget ? "2px solid var(--accent)" : "1px solid var(--border)",
                  boxShadow: isDragTarget ? "0 0 0 3px rgba(236,72,153,.15)" : undefined,
                }}
                onDragOver={e => {
                  if (colDragId.current !== null) { handleColDragOver(e, status.id); return; }
                  e.preventDefault();
                }}
                onDrop={e => {
                  if (colDragId.current !== null) { handleColDrop(e, status.id); return; }
                  handleDrop(e, status.id);
                }}
                onDragLeave={() => { if (colDragOver === status.id) setColDragOver(null); }}
              >
                {/* Column header — drag handle for reordering */}
                <div
                  className="flex items-center justify-between px-3 py-2.5 border-b select-none"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Grip handle — initiates column drag */}
                    <div
                      draggable
                      onDragStart={e => handleColDragStart(e, status.id)}
                      onDragEnd={() => { colDragId.current = null; setDraggingColId(null); setColDragOver(null); }}
                      className="cursor-grab active:cursor-grabbing shrink-0 touch-none"
                      style={{ color: "var(--muted2)" }}
                      title="Drag to reorder column"
                    >
                      <GripVertical size={14} />
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: status.color }} />
                    <span className="font-semibold text-sm truncate">{status.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: "var(--card3)", color: "var(--muted2)" }}>
                      {cols.length}
                    </span>
                  </div>
                  {canEdit && (
                    <button onClick={() => openCreate(status.id)} className="text-xs font-bold shrink-0" style={{ color: "var(--accent)" }}>+</button>
                  )}
                </div>
                {/* Cards */}
                <div className="flex flex-col gap-2 p-2 min-h-[80px]">
                  {cols.map(p => (
                    <ProjectCard
                      key={p.id} p={p} members={members} currency={currency} canEdit={canEdit}
                      onEdit={openEdit}
                      onDragStart={id => { dragId.current = id; }}
                      onDragEnd={() => { dragId.current = null; }}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Unassigned column */}
          {unassigned.length > 0 && (
            <div className="flex-shrink-0 flex flex-col rounded-xl"
              style={{ width: 272, background: "var(--card2)", border: "1px dashed var(--border)" }}
              onDragOver={e => { if (colDragId.current === null) e.preventDefault(); }}
              onDrop={e => { if (colDragId.current === null) handleDrop(e, null); }}>
              <div className="px-3 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <span className="font-semibold text-sm" style={{ color: "var(--muted2)" }}>Unassigned</span>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {unassigned.map(p => (
                  <ProjectCard
                    key={p.id} p={p} members={members} currency={currency} canEdit={canEdit}
                    onEdit={openEdit}
                    onDragStart={id => { dragId.current = id; }}
                    onDragEnd={() => { dragId.current = null; }}
                  />
                ))}
              </div>
            </div>
          )}

          {statuses.length === 0 && unassigned.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <p className="text-3xl mb-3">🔬</p>
              <p className="font-semibold">No columns yet</p>
              <p className="text-sm mt-1" style={{ color: "var(--muted2)" }}>Click &ldquo;⚙ Columns&rdquo; to set up your board</p>
            </div>
          )}
        </div>
      )}

      {/* ── TABLE VIEW ──────────────────────────────────────────────────── */}
      {view === "table" && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ background: "var(--card2)" }}>
              <thead>
                <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                  {["Project", "Status", "Priority", "Target Date", "Budget", "Assigned To", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const status = statuses.find(s => s.id === p.status_id);
                  const assignee = members.find(m => m.user_id === p.assigned_to);
                  const overdue = p.target_date && !p.finalized_at && new Date(p.target_date) < new Date();
                  return (
                    <tr key={p.id} className="border-b hover:bg-[var(--card3)] cursor-pointer" style={{ borderColor: "var(--border)" }}
                      onClick={() => openEdit(p)}>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold">{p.name}</div>
                        {p.description && <div className="text-[10px] truncate max-w-[200px]" style={{ color: "var(--muted2)" }}>{p.description}</div>}
                        {p.finalized_at && <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>✓ Finalized</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {status
                          ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: status.color }} />{status.name}</span>
                          : <span style={{ color: "var(--muted2)" }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: PRIORITY_BG[p.priority], color: PRIORITY_COLORS[p.priority] }}>
                          {p.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: overdue ? "var(--red-c)" : "var(--muted2)" }}>
                        {fdate(p.target_date)}{overdue ? " ⚠" : ""}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono">
                        {p.budget_estimate ? `${currency} ${fmt(p.budget_estimate)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--muted2)" }}>
                        {assignee ? assignee.email.split("@")[0] : "—"}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {canEdit && !p.finalized_at && (
                            <button onClick={() => openFinalize(p)}
                              className="px-2 py-1 rounded text-[10px] font-semibold"
                              style={{ background: "var(--success-bg)", color: "var(--accent)", border: "1px solid rgba(236,72,153,.25)" }}>
                              Finalize
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={async () => {
                              if (!await confirm(`Delete "${p.name}"?`)) return;
                              void removeProject(p.id, () => deleteRdProject(p.id), { success: "Deleted" });
                            }}
                              className="px-2 py-1 rounded text-[10px] font-semibold"
                              style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)", border: "1px solid rgba(239,68,68,.2)" }}>
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {projects.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center" style={{ color: "var(--muted2)" }}>No projects yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COLUMN MANAGER PANEL ────────────────────────────────────────── */}
      {colPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-end"
          style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setColPanel(false); }}>
          <div className="h-full w-80 flex flex-col" style={{ background: "var(--card2)", borderLeft: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">Manage Columns</h3>
              <button onClick={() => setColPanel(false)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {statuses.map(st => (
                <div key={st.id}>
                  {editingStatus?.id === st.id ? (
                    <div className="rounded-lg p-3 space-y-2" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
                      <input value={editingStatus.name} onChange={e => setEditingStatus({ ...editingStatus, name: e.target.value })}
                        className={inp} style={inpS} placeholder="Column name" />
                      <div className="flex gap-1.5 flex-wrap">
                        {SWATCH_COLORS.map(c => (
                          <button key={c} onClick={() => setEditingStatus({ ...editingStatus, color: c })}
                            className="w-6 h-6 rounded-full border-2 transition-transform"
                            style={{ background: c, borderColor: editingStatus.color === c ? "#fff" : "transparent", transform: editingStatus.color === c ? "scale(1.2)" : "none" }} />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingStatus(null)} className="flex-1 py-1.5 text-xs rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                        <button onClick={saveColumn} className="flex-1 py-1.5 text-xs rounded font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--card3)" }}>
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: st.color }} />
                      <span className="flex-1 text-sm font-medium truncate">{st.name}</span>
                      <span className="text-xs shrink-0" style={{ color: "var(--muted2)" }}>{projects.filter(p => p.status_id === st.id).length}</span>
                      <button onClick={() => setEditingStatus(st)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--muted2)" }}>✏</button>
                      <button onClick={() => removeColumn(st.id)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--red-c)" }}>✕</button>
                    </div>
                  )}
                </div>
              ))}
              {statuses.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: "var(--muted2)" }}>No columns yet</p>
              )}
            </div>
            <div className="border-t p-4 space-y-3 shrink-0" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Add Column</p>
              <input value={newColName} onChange={e => setNewColName(e.target.value)}
                className={inp} style={inpS} placeholder="Column name" />
              <div className="flex gap-1.5 flex-wrap">
                {SWATCH_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition-transform"
                    style={{ background: c, borderColor: newColColor === c ? "#fff" : "transparent", transform: newColColor === c ? "scale(1.2)" : "none" }} />
                ))}
              </div>
              <button onClick={addColumn} disabled={!newColName.trim()}
                className="w-full py-2 text-sm rounded font-semibold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff" }}>
                + Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROJECT CREATE / EDIT MODAL ─────────────────────────────────── */}
      {projectModal.open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
          style={{ background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setProjectModal({ open: false, project: null }); }}>
          <div className="w-full max-w-lg rounded-xl mb-10" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">{projectModal.project ? "Edit Project" : "New R&D Project"}</h3>
              <button onClick={() => setProjectModal({ open: false, project: null })} style={{ color: "var(--muted2)" }}>✕</button>
            </div>

            {/* Tabs — only show for existing projects */}
            {projectModal.project && (
              <div className="flex border-b px-5" style={{ borderColor: "var(--border)" }}>
                {(["details", "updates", "time"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setModalTab(t);
                      if (t === "updates" && projectModal.project) void loadUpdates(projectModal.project.id);
                    }}
                    className="px-4 py-2.5 text-xs font-semibold capitalize border-b-2 -mb-px transition-colors"
                    style={{
                      borderColor: modalTab === t ? "var(--accent)" : "transparent",
                      color: modalTab === t ? "var(--accent)" : "var(--muted2)",
                    }}
                  >
                    {t === "updates" ? (
                      <span className="flex items-center gap-1.5">
                        <MessageSquare size={12} />
                        Updates
                      </span>
                    ) : t === "time" ? (
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} />
                        Time
                      </span>
                    ) : "Details"}
                  </button>
                ))}
              </div>
            )}

            {/* Details tab */}
            {modalTab === "details" && (
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Project Name *</label>
                  <input value={pName} onChange={e => setPName(e.target.value)} className={inp} style={inpS} placeholder="e.g. New mobile app feature" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                  <textarea value={pDesc} onChange={e => setPDesc(e.target.value)} rows={2} className={inp} style={{ ...inpS, resize: "none" }} placeholder="Brief overview…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Status / Column</label>
                    <select value={pStatus ?? ""} onChange={e => setPStatus(e.target.value ? Number(e.target.value) : null)} className={inp} style={inpS}>
                      <option value="">— Unassigned —</option>
                      {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Priority</label>
                    <select value={pPriority} onChange={e => setPPriority(e.target.value)} className={inp} style={inpS}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Target Launch Date</label>
                    <DateInput name="target_date" value={pTargetDate} onChange={setPTargetDate} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Budget Estimate ({currency})</label>
                    <input type="number" min={0} step="0.01" value={pBudget}
                      onChange={e => setPBudget(e.target.value === "" ? "" : Number(e.target.value))}
                      className={inp} style={inpS} placeholder="0.00" />
                  </div>
                  {members.length > 0 && (
                    <div className="col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Assign To</label>
                      <select value={pAssigned} onChange={e => setPAssigned(e.target.value)} className={inp} style={inpS}>
                        <option value="">— Unassigned —</option>
                        {members.map(m => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                  <textarea value={pNotes} onChange={e => setPNotes(e.target.value)} rows={2} className={inp} style={{ ...inpS, resize: "none" }} placeholder="Additional notes…" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setProjectModal({ open: false, project: null })}
                    className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                    Cancel
                  </button>
                  {projectModal.project && !projectModal.project.finalized_at && (
                    <button type="button" onClick={() => { setProjectModal({ open: false, project: null }); openFinalize(projectModal.project!); }}
                      className="px-4 py-2 text-sm rounded font-semibold"
                      style={{ background: "var(--success-bg)", color: "var(--accent)", border: "1px solid rgba(236,72,153,.25)" }}>
                      Finalize →
                    </button>
                  )}
                  {projectModal.project && canDelete && (
                    <button type="button" onClick={async () => {
                      const proj = projectModal.project!;
                      if (!await confirm(`Delete "${proj.name}"?`)) return;
                      setProjectModal({ open: false, project: null });
                      void removeProject(proj.id, () => deleteRdProject(proj.id), { success: "Deleted" });
                    }}
                      className="px-3 py-2 text-sm rounded"
                      style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>
                      🗑️
                    </button>
                  )}
                  <button type="button" onClick={saveProject} disabled={!pName.trim()}
                    className="flex-1 py-2 text-sm font-semibold rounded disabled:opacity-40"
                    style={{ background: "var(--accent)", color: "#fff" }}>
                    {projectModal.project ? "Save Changes" : "Create Project"}
                  </button>
                </div>
              </div>
            )}

            {/* Updates tab */}
            {modalTab === "updates" && projectModal.project && (
              <div className="p-5 space-y-4">
                {/* Post new update */}
                {canEdit && (
                  <div className="space-y-2">
                    <textarea
                      value={updateInput}
                      onChange={e => setUpdateInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void handlePostUpdate(); }}
                      rows={3}
                      placeholder="Add an update, note, or blocker… (Ctrl+Enter to post)"
                      className={inp}
                      style={{ ...inpS, resize: "none" }}
                    />
                    <button
                      onClick={handlePostUpdate}
                      disabled={updateBusy || !updateInput.trim()}
                      className="px-4 py-2 text-sm font-semibold rounded disabled:opacity-40"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      {updateBusy ? "Posting…" : "Post Update"}
                    </button>
                  </div>
                )}

                {/* Updates list */}
                {updatesLoading ? (
                  <div className="py-8 text-center text-sm" style={{ color: "var(--muted2)" }}>Loading…</div>
                ) : updates.length === 0 ? (
                  <div className="py-8 text-center" style={{ color: "var(--muted2)" }}>
                    <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No updates yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {updates.map(u => {
                      const authorEmail = members.find(m => m.user_id === u.author_id)?.email;
                      const authorName = authorEmail ? authorEmail.split("@")[0] : "Unknown";
                      return (
                        <div key={u.id} className="rounded-xl p-3" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>@{authorName}</span>
                            <span className="text-[10px]" style={{ color: "var(--muted2)" }}>{ftime(u.created_at)}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{u.content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Time tab */}
            {modalTab === "time" && projectModal.project && (
              <div className="p-5">
                <TimeTracker
                  entityType="rd_project"
                  entityId={projectModal.project.id}
                  members={members}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FINALIZE → PRODUCT MODAL ────────────────────────────────────── */}
      {finalizeProject && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
          style={{ background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setFinalizeProject(null); }}>
          <div className="w-full max-w-md rounded-xl mb-10" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="font-semibold">Finalize Project</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>This will add the product to your catalogue</p>
              </div>
              <button onClick={() => setFinalizeProject(null)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Product Name *</label>
                <input value={fName} onChange={e => setFName(e.target.value)} className={inp} style={inpS} placeholder="Product name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>SKU</label>
                  <input value={fSku} onChange={e => setFSku(e.target.value)} className={inp} style={inpS} placeholder="e.g. PRD-001" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Category</label>
                  <input value={fCategory} onChange={e => setFCategory(e.target.value)} className={inp} style={inpS} placeholder="e.g. Software" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} className={inp} style={{ ...inpS, resize: "none" }} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Unit Price ({currency}) *</label>
                <input type="number" min={0} step="0.01" value={fPrice}
                  onChange={e => setFPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  className={inp} style={inpS} placeholder="0.00" />
              </div>
              <div className="px-4 py-3 rounded-lg text-xs" style={{ background: "var(--success-bg)", color: "var(--accent)" }}>
                ✓ Project &ldquo;{finalizeProject.name}&rdquo; will be marked as finalized and the product will appear in your catalogue immediately.
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setFinalizeProject(null)}
                  className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                  Cancel
                </button>
                <button type="button" onClick={handleFinalize} disabled={!fName.trim()}
                  className="flex-1 py-2 text-sm font-semibold rounded disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "#fff" }}>
                  Finalize & Add to Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...dialogProps} confirmLabel="Confirm" />
    </div>
  );
}
