"use client";

import { useState } from "react";
import { Plus, Trash2, Menu, X, Sparkles, Settings2, Pencil } from "lucide-react";
import { useToast } from "@/components/Toast";
import { AiChatCore } from "@/components/AiChatCore";
import {
  createConversation, renameConversation, deleteConversation, setConversationAgent,
  createAgent, updateAgent, deleteAgent,
} from "@/server-actions/coco";

type Agent = { id: number; name: string; description: string | null; system_prompt: string; is_default: boolean };
type Conversation = { id: number; title: string; agent_id: number | null; updated_at: string };

type Props = {
  orgId: string;
  agents: Agent[];
  conversations: Conversation[];
};

const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

export function ChatShell({ agents: initialAgents, conversations: initialConversations }: Props) {
  const toast = useToast();
  const [agents, setAgents] = useState(initialAgents);
  const [convs, setConvs] = useState(initialConversations);
  const defaultAgentId = agents.find(a => a.is_default)?.id ?? agents[0]?.id ?? null;
  const [activeId, setActiveId] = useState<number | null>(initialConversations[0]?.id ?? null);
  const [sidebar, setSidebar] = useState(false); // mobile drawer
  const [personaMgr, setPersonaMgr] = useState(false);
  const [busy, setBusy] = useState(false);

  const active = convs.find(c => c.id === activeId) ?? null;
  const activeAgentId = active?.agent_id ?? defaultAgentId;

  async function newChat() {
    setBusy(true);
    try {
      const { id } = await createConversation(defaultAgentId);
      setConvs(c => [{ id, title: "New chat", agent_id: defaultAgentId, updated_at: new Date().toISOString() }, ...c]);
      setActiveId(id);
      setSidebar(false);
    } catch { toast.error("Failed to start chat"); }
    finally { setBusy(false); }
  }

  async function removeConv(id: number) {
    setConvs(c => c.filter(x => x.id !== id));
    if (activeId === id) setActiveId(cs => (convs.find(x => x.id !== id)?.id ?? null));
    try { await deleteConversation(id); } catch { toast.error("Failed to delete"); }
  }

  async function rename(id: number, title: string) {
    setConvs(c => c.map(x => x.id === id ? { ...x, title } : x));
    try { await renameConversation(id, title); } catch { /* best-effort */ }
  }

  async function switchAgent(agentId: number) {
    if (!active) return;
    setConvs(c => c.map(x => x.id === active.id ? { ...x, agent_id: agentId } : x));
    try { await setConversationAgent(active.id, agentId); } catch { toast.error("Failed to switch persona"); }
  }

  return (
    <div className="flex h-full rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {/* Sidebar */}
      <aside
        className={`${sidebar ? "flex" : "hidden"} md:flex flex-col w-64 shrink-0 absolute md:static z-30 h-full`}
        style={{ background: "var(--card2)", borderRight: "1px solid var(--border)" }}
      >
        <div className="p-3 flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={newChat} disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}>
            <Plus size={14} /> New chat
          </button>
          <button onClick={() => setSidebar(false)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center" style={{ color: "var(--muted2)" }}><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {convs.length === 0 && <p className="text-xs text-center py-6" style={{ color: "var(--muted2)" }}>No chats yet</p>}
          {convs.map(c => (
            <div key={c.id}
              className="group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer"
              style={{ background: c.id === activeId ? "var(--card3)" : "transparent" }}
              onClick={() => { setActiveId(c.id); setSidebar(false); }}>
              <span className="flex-1 text-sm truncate" style={{ color: c.id === activeId ? "var(--foreground)" : "var(--muted)" }}>{c.title || "New chat"}</span>
              <button onClick={e => { e.stopPropagation(); const t = prompt("Rename chat", c.title); if (t != null) void rename(c.id, t); }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center" style={{ color: "var(--muted2)" }}><Pencil size={11} /></button>
              <button onClick={e => { e.stopPropagation(); void removeConv(c.id); }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center" style={{ color: "var(--red-c)" }}><Trash2 size={11} /></button>
            </div>
          ))}
        </div>

        <button onClick={() => setPersonaMgr(true)}
          className="m-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>
          <Settings2 size={13} /> Manage personas
        </button>
      </aside>

      {/* Backdrop for mobile drawer */}
      {sidebar && <div className="md:hidden fixed inset-0 z-20" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setSidebar(false)} />}

      {/* Main thread */}
      <div className="flex-1 flex flex-col min-w-0 h-full" style={{ background: "var(--card)" }}>
        {/* Thread header: persona switcher + mobile menu */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
          <button onClick={() => setSidebar(true)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center" style={{ color: "var(--muted)" }}><Menu size={18} /></button>
          <Sparkles size={15} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold truncate flex-1">{active?.title || "Coco AI"}</span>
          {active && agents.length > 0 && (
            <select value={activeAgentId ?? ""} onChange={e => switchAgent(Number(e.target.value))}
              className="px-2 py-1.5 text-xs rounded border outline-none" style={inpS} title="Persona">
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>

        {/* Thread body */}
        {active ? (
          <div className="flex-1 min-h-0">
            <AiChatCore key={active.id} conversationId={active.id} agentId={activeAgentId} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Sparkles size={28} style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--muted2)" }}>Start a conversation with Coco.</p>
            <button onClick={newChat} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
              <Plus size={14} className="inline mr-1" /> New chat
            </button>
          </div>
        )}
      </div>

      {personaMgr && (
        <PersonaManager
          agents={agents}
          onClose={() => setPersonaMgr(false)}
          onChange={setAgents}
        />
      )}
    </div>
  );
}

// ── Persona manager modal ───────────────────────────────────────────────────
function PersonaManager({ agents, onClose, onChange }: {
  agents: Agent[];
  onClose: () => void;
  onChange: (a: Agent[]) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<Agent | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  function startEdit(a: Agent) { setEditing(a); setAdding(false); setName(a.name); setDesc(a.description ?? ""); setPrompt(a.system_prompt); }
  function startAdd() { setAdding(true); setEditing(null); setName(""); setDesc(""); setPrompt(""); }

  async function save() {
    if (!name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    try {
      if (adding) {
        const { id } = await createAgent({ name, description: desc, systemPrompt: prompt });
        onChange([...agents, { id, name: name.trim(), description: desc || null, system_prompt: prompt, is_default: false }]);
        toast.success("Persona created");
      } else if (editing) {
        await updateAgent(editing.id, { name, description: desc, systemPrompt: prompt });
        onChange(agents.map(a => a.id === editing.id ? { ...a, name: name.trim(), description: desc || null, system_prompt: prompt } : a));
        toast.success("Persona saved");
      }
      setAdding(false); setEditing(null);
    } catch { toast.error("Failed to save persona"); }
    finally { setBusy(false); }
  }

  async function remove(a: Agent) {
    if (!confirm(`Delete persona "${a.name}"?`)) return;
    onChange(agents.filter(x => x.id !== a.id));
    if (editing?.id === a.id) { setEditing(null); setAdding(false); }
    try { await deleteAgent(a.id); } catch { toast.error("Failed to delete"); }
  }

  const showForm = adding || editing;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold">Coco Personas</h2>
          <button onClick={onClose} style={{ color: "var(--muted2)" }}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {!showForm && (
            <>
              {agents.map(a => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg p-3" style={{ background: "var(--card3)", border: "1px solid var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{a.name}{a.is_default && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent)", color: "#fff" }}>default</span>}</p>
                    {a.description && <p className="text-xs truncate" style={{ color: "var(--muted2)" }}>{a.description}</p>}
                  </div>
                  <button onClick={() => startEdit(a)} className="px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)" }}>Edit</button>
                  {!a.is_default && <button onClick={() => remove(a)} className="px-2 py-1 rounded text-xs" style={{ color: "var(--red-c)", border: "1px solid var(--border)" }}>Delete</button>}
                </div>
              ))}
              <button onClick={startAdd} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--card3)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                <Plus size={14} /> New persona
              </button>
            </>
          )}
          {showForm && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inp} style={inpS} placeholder="e.g. SARS Expert" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                <input value={desc} onChange={e => setDesc(e.target.value)} className={inp} style={inpS} placeholder="Short summary" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>System prompt</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={6} className={inp} style={{ ...inpS, resize: "vertical" }} placeholder="How should Coco behave in this mode? (Leave blank to use the default Coco prompt.)" />
              </div>
              <div className="flex gap-2">
                <button onClick={save} disabled={busy} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: "var(--accent)", color: "#fff" }}>{busy ? "Saving…" : "Save"}</button>
                <button onClick={() => { setAdding(false); setEditing(null); }} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--muted)" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
