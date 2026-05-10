"use client";

import { useState } from "react";
import { AiChatCore } from "@/components/AiChatCore";

export function AiAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button — desktop only (mobile uses the /chat page) */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open Coco AI assistant"
        className="hidden md:flex fixed bottom-8 right-24 z-50 w-12 h-12 rounded-full items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(135deg, var(--accent), var(--purple-c))",
          color: "#fff",
          boxShadow: "0 4px 20px rgba(16,185,129,.4)",
        }}>
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-4.906-1.285L2 22l1.285-5.094A9.96 9.96 0 0 1 2 12 10 10 0 0 1 12 2z" />
            <path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Floating chat panel — desktop only */}
      {open && (
        <div
          className="hidden md:flex fixed bottom-24 right-24 z-50 flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: "380px",
            height: "520px",
            background: "var(--card2)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 40px rgba(0,0,0,.4)",
          }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--purple-c))", color: "#fff" }}>C</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Coco AI</div>
              <div className="text-xs" style={{ color: "var(--accent)" }}>● Ready</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-lg leading-none" style={{ color: "var(--muted2)" }}>✕</button>
          </div>

          <AiChatCore compact />
        </div>
      )}
    </>
  );
}
