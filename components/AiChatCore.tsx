"use client";

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";

export type Message = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS = [
  "What's our total revenue?",
  "Show pending invoices",
  "Add a new customer",
  "Create an invoice",
  "Show me recent leads",
  "Log a customer call",
];

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

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 text-xs font-bold"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--purple-c))", color: "#fff" }}>
          C
        </div>
      )}
      <div
        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isUser ? "rounded-tr-sm" : "rounded-tl-sm"}`}
        style={{
          background: isUser ? "var(--accent)" : "var(--card)",
          color: isUser ? "#fff" : "var(--foreground)",
          border: isUser ? "none" : "1px solid var(--border)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
        {msg.content}
      </div>
    </div>
  );
}

type Props = {
  compact?: boolean;
};

const HISTORY_KEY = "coco_chat_history";
const MAX_STORED = 100;

export function AiChatCore({ compact = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history from localStorage on mount
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setMessages(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Save history to localStorage whenever messages change
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setError("");
    const userMsg: Message = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0;

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
                Ask me anything or tap a suggestion below.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_ACTIONS.map(q => (
                <button key={q}
                  onClick={() => send(q)}
                  className="text-left text-xs px-3 py-2.5 rounded-xl transition-colors hover:opacity-80 active:scale-[.98]"
                  style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 text-xs font-bold"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--purple-c))", color: "#fff" }}>C</div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <TypingDots />
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
        {messages.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => { setMessages([]); setError(""); try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ } }}
              className="text-[11px] px-2.5 py-1 rounded-lg"
              style={{ color: "var(--muted2)", border: "1px solid var(--border)" }}>
              Clear chat
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Coco anything…"
            rows={1}
            disabled={loading}
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
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity"
            style={{ background: "var(--accent)", color: "#fff", opacity: loading || !input.trim() ? 0.4 : 1 }}>
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
