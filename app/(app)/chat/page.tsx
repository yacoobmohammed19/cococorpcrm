import { AiChatCore } from "@/components/AiChatCore";
import { getCurrentOrgId } from "@/lib/supabase/org";

export default async function ChatPage() {
  const orgId = await getCurrentOrgId();
  return (
    // -mx-4 -mt-4 removes the layout's p-4 so the chat fills edge-to-edge on mobile.
    // Height = full dynamic viewport minus the fixed mobile header (48px) and bottom nav (64px).
    <div
      className="-mx-4 -mt-4 md:mx-0 md:mt-0 flex flex-col"
      style={{ height: "calc(100dvh - 48px - 64px)" }}
    >
      {/* Page header */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base shrink-0"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--purple-c))", color: "#fff" }}
        >
          C
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Coco AI</h1>
          <p className="text-xs" style={{ color: "var(--muted2)" }}>
            Ask anything · create records · manage your CRM
          </p>
        </div>
      </div>

      {/* Chat fills remaining space */}
      <div className="flex-1 min-h-0" style={{ background: "var(--card2)" }}>
        <AiChatCore orgId={orgId} />
      </div>
    </div>
  );
}
