"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

// ── Personas / agents ─────────────────────────────────────────────────────

export async function ensureDefaultAgents() {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("coco_agents").select("id").eq("org_id", orgId).is("deleted_at", null).limit(1);
  if (existing && existing.length > 0) return;
  await supabase.from("coco_agents").insert([
    { org_id: orgId, name: "General Admin", description: "All-round business assistant", system_prompt: "", is_default: true, sort: 0 },
    {
      org_id: orgId, name: "SARS Expert",
      description: "South African tax & annual financial statements specialist",
      system_prompt: "You are Coco in SARS Expert mode — a South African tax and accounting specialist. Focus on IFRS-for-SMEs financial statements, the ITR14 company return, VAT, provisional tax and SARS compliance. Be precise about what belongs in the income statement vs balance sheet vs tax computation. When unsure, recommend a registered tax practitioner.",
      is_default: false, sort: 1,
    },
  ]);
  // No revalidatePath here — this runs during the /chat render (unsupported);
  // the page reads the agents in the same request right after this returns.
}

export async function createAgent(input: { name: string; description?: string; systemPrompt?: string }) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("coco_agents").insert({
    org_id: orgId,
    name: input.name.trim() || "New persona",
    description: input.description?.trim() || null,
    system_prompt: input.systemPrompt ?? "",
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
  revalidatePath("/settings");
  return { id: data.id as number };
}

export async function updateAgent(id: number, input: { name?: string; description?: string; systemPrompt?: string }) {
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim() || "Untitled";
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  if (input.systemPrompt !== undefined) patch.system_prompt = input.systemPrompt;
  const { error } = await supabase.from("coco_agents").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
  revalidatePath("/settings");
}

export async function deleteAgent(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("coco_agents").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
  revalidatePath("/settings");
}

// ── Conversations ─────────────────────────────────────────────────────────

export async function createConversation(agentId: number | null) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("coco_conversations").insert({
    org_id: orgId,
    user_id: user?.id ?? null,
    agent_id: agentId,
    title: "New chat",
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
  return { id: data.id as number };
}

export async function renameConversation(id: number, title: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("coco_conversations").update({ title: title.trim() || "Untitled" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}

export async function setConversationAgent(id: number, agentId: number | null) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("coco_conversations").update({ agent_id: agentId }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}

export async function deleteConversation(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("coco_conversations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}
