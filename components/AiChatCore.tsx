"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import remarkGfm from "remark-gfm";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

export type Message = { role: "user" | "assistant"; content: string };

type PendingAction = {
  tool: string;
  args: Record<string, unknown>;
  label: string;
};

// ── Chart rendering ───────────────────────────────────────────────────────────

type ChartSpec = { type: "bar" | "line" | "pie"; title?: string; xKey: string; yKey: string; data: Record<string, unknown>[] };
const CHART_COLORS = ["#ec4899","#e84393","#8b5cf6","#f59e0b","#06b6d4","#ef4444","#84cc16","#f97316"];
const TT_STYLE = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 };
const TICK_STYLE = { fontSize: 10, fill: "var(--muted2)" };

function ChartBlock({ spec }: { spec: ChartSpec }) {
  const h = Math.max(160, Math.min(spec.data.length * 20, 220));
  if (spec.type === "pie") return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={spec.data} dataKey={spec.yKey} nameKey={spec.xKey} cx="50%" cy="50%" outerRadius={70}>
          {spec.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={TT_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  );
  if (spec.type === "line") return (
    <ResponsiveContainer width="100%" height={h}>
      <LineChart data={spec.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey={spec.xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TT_STYLE} />
        <Line type="monotone" dataKey={spec.yKey} stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={spec.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey={spec.xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TT_STYLE} />
        <Bar dataKey={spec.yKey} radius={[3,3,0,0]}>
          {spec.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function normalizeChartSpec(spec: ChartSpec): ChartSpec {
  if (!spec.data?.length) return spec;
  const sample = spec.data[0];
  // If xKey/yKey already exist in data, no change needed
  if (sample[spec.xKey] !== undefined && sample[spec.yKey] !== undefined) return spec;
  // AI used different key names — auto-detect: first string key = label, first number key = value
  const keys = Object.keys(sample);
  const numKey = keys.find(k => typeof sample[k] === "number") ?? keys[keys.length - 1];
  const strKey = keys.find(k => k !== numKey) ?? keys[0];
  return { ...spec, xKey: strKey, yKey: numKey };
}

function parseChartBlock(content: string): { text: string; chart: ChartSpec | null } {
  const match = content.match(/```chart\s*([\s\S]+?)\s*```/);
  if (!match) return { text: content, chart: null };
  const text = content.replace(/```chart[\s\S]+?```/, "").trim();
  try {
    const raw = JSON.parse(match[1]) as ChartSpec;
    if (raw.type && Array.isArray(raw.data) && raw.data.length) {
      const chart = normalizeChartSpec(raw);
      return { text, chart };
    }
  } catch { /* ignore */ }
  return { text, chart: null };
}

const QUICK_ACTIONS = [
  "Chart revenue last 6 months",
  "Chart profit trend",
  "Chart costs by category",
  "What's our revenue this month?",
  "Show pending invoices",
  "Create a new lead",
];

const TOOL_FIELD_LABELS: Record<string, string> = {
  customer_id: "Customer ID", amount: "Amount", invoice_number: "Invoice #",
  due_date: "Due Date", status: "Status", name: "Name", email: "Email",
  phone: "Phone", transaction_date: "Date", record_date: "Date",
  cost_details: "Description", balance: "Balance", account_id: "Account ID",
  cost_category_id: "Category ID", estimated_value: "Est. Value",
  source: "Source", notes: "Notes", subject: "Subject", type: "Type",
  entity_type: "Attach to", entity_id: "Record ID", minutes: "Minutes",
  content: "Comment", note: "Note", spent_on: "Date",
};

function formatFieldKey(key: string) {
  return TOOL_FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full animate-bounce"
          style={{ background: "var(--accent)", animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-1.5 space-y-0.5 pl-4" style={{ listStyleType: "disc" }}>{children}</ul>,
  ol: ({ children }) => <ol className="mb-1.5 space-y-0.5 pl-4" style={{ listStyleType: "decimal" }}>{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
  h2: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
  h3: ({ children }) => <p className="font-medium mb-0.5">{children}</p>,
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    return isBlock
      ? <code className="block text-xs font-mono rounded-lg p-2 my-1 overflow-x-auto" style={{ background: "rgba(0,0,0,.12)" }}>{children}</code>
      : <code className="text-xs font-mono px-1 py-0.5 rounded" style={{ background: "rgba(0,0,0,.1)" }}>{children}</code>;
  },
  pre: ({ children }) => <pre className="text-xs font-mono rounded-lg p-2 my-1 overflow-x-auto" style={{ background: "rgba(0,0,0,.12)" }}>{children}</pre>,
  blockquote: ({ children }) => <blockquote className="border-l-2 pl-2 my-1 opacity-80" style={{ borderColor: "var(--accent)" }}>{children}</blockquote>,
  hr: () => <hr className="my-2 opacity-20 border-current" />,
  table: ({ children }) => <div className="overflow-x-auto my-1.5"><table className="text-xs w-full border-collapse">{children}</table></div>,
  th: ({ children }) => <th className="text-left font-semibold px-2 py-1 border-b" style={{ borderColor: "rgba(0,0,0,.15)" }}>{children}</th>,
  td: ({ children }) => <td className="px-2 py-1 border-b" style={{ borderColor: "rgba(0,0,0,.08)" }}>{children}</td>,
};

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const { text, chart } = isUser ? { text: msg.content, chart: null } : parseChartBlock(msg.content);
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 text-xs font-bold"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--purple-c))", color: "#fff" }}>
          C
        </div>
      )}
      <div className={`max-w-[90%] ${isUser ? "max-w-[82%]" : ""}`}>
        {text && (
          <div
            className={`px-3.5 py-2.5 rounded-2xl text-sm ${isUser ? "rounded-tr-sm" : "rounded-tl-sm"} ${chart ? "mb-2" : ""}`}
            style={{
              background: isUser ? "var(--accent)" : "var(--card)",
              color: isUser ? "#fff" : "var(--foreground)",
              border: isUser ? "none" : "1px solid var(--border)",
              wordBreak: "break-word",
            }}>
            {isUser
              ? <p className="leading-relaxed whitespace-pre-wrap">{text}</p>
              : <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{text}</ReactMarkdown>
            }
          </div>
        )}
        {chart && (
          <div className="rounded-2xl rounded-tl-sm overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            {chart.title && (
              <p className="text-xs font-semibold px-3.5 pt-3 pb-1" style={{ color: "var(--foreground)" }}>{chart.title}</p>
            )}
            <div className="px-2 pb-3 pt-1">
              <ChartBlock spec={chart} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmActionCard({
  action,
  description,
  onConfirm,
  onCancel,
  busy,
}: {
  action: PendingAction;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const fields = Object.entries(action.args)
    .filter(([, v]) => v !== null && v !== undefined && v !== "");

  return (
    <div className="flex justify-start mb-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 text-xs font-bold"
        style={{ background: "linear-gradient(135deg, var(--accent), var(--purple-c))", color: "#fff" }}>
        C
      </div>
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
        {/* Header */}
        <div className="px-3.5 pt-3 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: "rgba(232,67,147,.12)", color: "var(--pink)" }}>
              Confirm Action
            </span>
          </div>
          <p className="text-sm font-semibold">{action.label}</p>
          {description && (
            <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>{description}</p>
          )}
        </div>

        {/* Data fields */}
        <div className="px-3.5 py-2.5 space-y-1.5">
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between items-start gap-3 text-xs">
              <span className="shrink-0 font-medium" style={{ color: "var(--muted2)" }}>
                {formatFieldKey(k)}
              </span>
              <span className="text-right font-mono break-all" style={{ color: "var(--foreground)" }}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 px-3.5 pb-3.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-opacity"
            style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-opacity"
            style={{ background: "var(--accent)", color: "#fff", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Saving…" : "✓ Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = { compact?: boolean; orgId?: string; conversationId?: number; agentId?: number | null };

export function AiChatCore({ compact = false, conversationId, agentId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryStatus, setRetryStatus] = useState("");
  const [pendingAction, setPendingAction] = useState<{ action: PendingAction; description: string } | null>(null);
  const [executing, setExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load the conversation's messages from the DB; if empty, kick off a proactive
  // greeting (persisted server-side). Re-runs whenever the active conversation changes.
  useEffect(() => {
    // Reset when switching conversations — a genuine external-store (DB) reload,
    // so the cascading-render concern of set-state-in-effect doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!conversationId) { setMessages([]); return; }
    let cancelled = false;
    setMessages([]);
    setPendingAction(null);
    (async () => {
      let existing: Message[] = [];
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("coco_messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });
        existing = (data ?? []).map(m => ({ role: m.role as "user" | "assistant", content: m.content as string }));
      } catch { /* ignore */ }
      if (cancelled) return;
      if (existing.length > 0) { setMessages(existing); return; }
      setLoading(true);
      try {
        const r = await fetch("/api/ai-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [], proactive: true, conversationId, agentId }),
        });
        const d = await r.json() as { reply?: string };
        if (!cancelled && d.reply) setMessages([{ role: "assistant", content: d.reply }]);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, pendingAction]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setError("");
    setRetryStatus("");
    setPendingAction(null);
    const userMsg: Message = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        setRetryStatus(attempt === 1 ? "AI is busy — retrying…" : "Retrying again…");
        await new Promise(r => setTimeout(r, 3000));
        setRetryStatus("");
      }
      try {
        const res = await fetch("/api/ai-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next, conversationId, agentId }),
        });
        const data = await res.json() as { reply?: string; error?: string; pendingAction?: PendingAction; overloaded?: boolean };

        if (data.overloaded) {
          if (attempt < MAX_RETRIES) continue;
          setError("The AI service is experiencing high demand. Please try again in a moment.");
          break;
        }
        if (data.error) {
          setError(data.error);
          break;
        }
        if (data.pendingAction) {
          if (data.reply) setMessages(prev => [...prev, { role: "assistant", content: data.reply! }]);
          setPendingAction({ action: data.pendingAction, description: data.reply || "" });
        } else if (data.reply) {
          setMessages(prev => [...prev, { role: "assistant", content: data.reply! }]);
        }
        break;
      } catch {
        setError("Network error — please try again.");
        break;
      }
    }

    setLoading(false);
    setRetryStatus("");
  }, [messages, loading, conversationId, agentId]);

  async function handleConfirm() {
    if (!pendingAction) return;
    setExecuting(true);
    try {
      const res = await fetch("/api/coco-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingAction.action),
      });
      const result = await res.json() as { success: boolean; error?: string };
      setPendingAction(null);
      if (result.success) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ Done! ${pendingAction.action.label} has been saved successfully.`,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `❌ Sorry, I couldn't save that: ${result.error || "Unknown error"}. Please try again.`,
        }]);
      }
    } catch {
      setPendingAction(null);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "❌ Network error while saving. Please try again.",
      }]);
    } finally {
      setExecuting(false);
    }
  }

  function handleCancel() {
    setPendingAction(null);
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "No problem — action cancelled. Is there anything else I can help with?",
    }]);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0 && !pendingAction;

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: compact ? "1rem" : "1.25rem 1.25rem 0.5rem" }}>
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 pb-4">
            <div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl font-bold"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--purple-c))", color: "#fff" }}>
                C
              </div>
              <p className="font-semibold">Hi, I&apos;m Coco!</p>
              <p className="text-sm mt-1" style={{ color: "var(--muted2)" }}>
                Ask me anything or create records by just talking to me.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_ACTIONS.map(q => (
                <button key={q} onClick={() => send(q)}
                  className="text-left text-xs px-3 py-2.5 rounded-xl transition-colors hover:opacity-80 active:scale-[.98]"
                  style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}

        {/* Confirmation card — shown after the last AI message */}
        {pendingAction && !loading && (
          <ConfirmActionCard
            action={pendingAction.action}
            description=""
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            busy={executing}
          />
        )}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 text-xs font-bold"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--purple-c))", color: "#fff" }}>C</div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              {retryStatus ? (
                <span className="text-xs" style={{ color: "var(--amber-c)" }}>⏳ {retryStatus}</span>
              ) : (
                <TypingDots />
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs px-3 py-2.5 rounded-xl mb-2 text-center"
            style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)", border: "1px solid rgba(239,68,68,.2)" }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={pendingAction ? "Confirm or cancel above, or ask something else…" : "Ask Coco anything…"}
            rows={1}
            disabled={loading || executing}
            className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              maxHeight: "120px",
              lineHeight: "1.5",
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || executing || !input.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity"
            style={{ background: "var(--accent)", color: "#fff", opacity: loading || executing || !input.trim() ? 0.4 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] mt-1.5 text-center" style={{ color: "var(--muted2)" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
