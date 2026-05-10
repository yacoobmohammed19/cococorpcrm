import { AiChatCore } from "@/components/AiChatCore";

export default function ChatPage() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 4rem - 56px)" }}>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--purple-c))", color: "#fff" }}>
          C
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Coco AI</h1>
          <p className="text-xs" style={{ color: "var(--muted2)" }}>
            Ask anything · Create invoices · Update your CRM
          </p>
        </div>
      </div>

      {/* Chat container */}
      <div className="flex-1 rounded-2xl overflow-hidden min-h-0"
        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <AiChatCore />
      </div>
    </div>
  );
}
