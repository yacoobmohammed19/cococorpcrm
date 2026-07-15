"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

type ToastItem = {
  id: number;
  msg: string;
  type: "success" | "error";
  undo?: () => void | Promise<void>;
  undone?: boolean;
};

type ToastCtx = {
  success: (m: string) => void;
  error: (m: string) => void;
  undoable: (m: string, undoFn: () => void | Promise<void>) => void;
};

const ToastCtx = createContext<ToastCtx>({ success: () => {}, error: () => {}, undoable: () => {} });
export const useToast = () => useContext(ToastCtx);

const DURATION_NORMAL = 3500;
const DURATION_UNDOABLE = 5500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setList(l => l.filter(x => x.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const schedule = useCallback((id: number, ms: number) => {
    const t = setTimeout(() => dismiss(id), ms);
    timers.current.set(id, t);
  }, [dismiss]);

  const add = useCallback((msg: string, type: ToastItem["type"], undo?: () => void | Promise<void>) => {
    const id = Date.now() + Math.random();
    setList(l => [...l, { id, msg, type, undo }]);
    schedule(id, undo ? DURATION_UNDOABLE : DURATION_NORMAL);
    return id;
  }, [schedule]);

  async function handleUndo(item: ToastItem) {
    // Mark as undone and dismiss immediately
    setList(l => l.map(x => x.id === item.id ? { ...x, undone: true, undo: undefined } : x));
    const t = timers.current.get(item.id);
    if (t) { clearTimeout(t); timers.current.delete(item.id); }
    try {
      await item.undo?.();
      // Show brief "Undone" confirmation
      setList(l => l.map(x => x.id === item.id ? { ...x, msg: "Undone", undone: true } : x));
      schedule(item.id, 1800);
    } catch {
      setList(l => l.map(x => x.id === item.id ? { ...x, msg: "Undo failed", type: "error", undone: true } : x));
      schedule(item.id, 2500);
    }
  }

  const ctx: ToastCtx = {
    success:  (m) => add(m, "success"),
    error:    (m) => add(m, "error"),
    undoable: (m, fn) => { add(m, "success", fn); },
  };

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2" style={{ maxWidth: 360, pointerEvents: "none" }}>
        {list.map(t => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl"
            style={{
              background: t.type === "success" ? "var(--accent)" : "#ef4444",
              color: "#fff",
              pointerEvents: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}
          >
            <span className="flex-1">{t.undone ? "↩ " : t.type === "success" ? "✓ " : "✕ "}{t.msg}</span>
            {t.undo && !t.undone && (
              <button
                onClick={() => handleUndo(t)}
                className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
                style={{ background: "rgba(0,0,0,0.2)", color: "#fff" }}
              >
                Undo
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-xs"
              style={{ color: "#fff" }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
