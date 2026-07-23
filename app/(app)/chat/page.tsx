import { ChatShell } from "@/components/ChatShell";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";
import { ensureDefaultAgents } from "@/server-actions/coco";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const orgId = await getCurrentOrgId();
  await ensureDefaultAgents();

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: agents }, { data: conversations }] = await Promise.all([
    supabase.from("coco_agents").select("id, name, description, system_prompt, is_default")
      .eq("org_id", orgId).is("deleted_at", null).order("sort").order("name"),
    supabase.from("coco_conversations").select("id, title, agent_id, updated_at")
      .eq("org_id", orgId).eq("user_id", user?.id ?? "").is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  ]);

  return (
    // Remove the layout's padding so the chat fills edge-to-edge; bound the height to the
    // dynamic viewport minus the mobile header (48px) + bottom nav (64px) so it never "moves around".
    <div
      className="-mx-4 -mt-4 md:mx-0 md:mt-0"
      style={{ height: "calc(100dvh - 48px - 64px)" }}
    >
      <ChatShell
        orgId={orgId}
        agents={(agents || []).map(a => ({
          id: a.id as number, name: a.name as string, description: (a.description as string | null) ?? null,
          system_prompt: (a.system_prompt as string) ?? "", is_default: !!a.is_default,
        }))}
        conversations={(conversations || []).map(c => ({
          id: c.id as number, title: (c.title as string) ?? "New chat",
          agent_id: (c.agent_id as number | null) ?? null, updated_at: (c.updated_at as string) ?? "",
        }))}
      />
    </div>
  );
}
