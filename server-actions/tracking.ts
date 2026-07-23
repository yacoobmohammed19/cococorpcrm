"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Shared time-tracking + comment thread actions.
 *
 * These are entity-agnostic: the same code path serves leads, R&D projects and
 * any future entity, keyed by (entity_type, entity_id). Keep the union in sync
 * with the CHECK constraint in supabase/migrations/0022_time_tracking.sql.
 */
export type TrackedEntity = "lead" | "rd_project";

/** Revalidate the page(s) that display tracking data for the given entity. */
function revalidateEntity(entityType: TrackedEntity, entityId: number) {
  if (entityType === "lead") revalidatePath(`/leads/${entityId}`);
  else if (entityType === "rd_project") revalidatePath("/rd");
  revalidatePath("/dashboard");
}

// ── Time entries ────────────────────────────────────────────────────────────

export async function logTime(input: {
  entityType: TrackedEntity;
  entityId: number;
  minutes: number;
  note?: string | null;
  spentOn?: string | null;
}) {
  const minutes = Math.max(0, Math.round(Number(input.minutes)) || 0);
  const note = input.note?.trim() || null;
  // A log entry needs either time or a note (a pure narrative update = 0 minutes).
  if (minutes <= 0 && !note) {
    throw new Error("Enter a time or a note.");
  }

  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("time_entries").insert({
    org_id: orgId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    minutes,
    note,
    spent_on: input.spentOn || new Date().toISOString().slice(0, 10),
    author_id: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidateEntity(input.entityType, input.entityId);
}

export async function updateTimeEntry(input: {
  id: number;
  entityType: TrackedEntity;
  entityId: number;
  minutes: number;
  note?: string | null;
  spentOn?: string | null;
}) {
  const minutes = Math.max(0, Math.round(Number(input.minutes)) || 0);
  const note = input.note?.trim() || null;
  if (minutes <= 0 && !note) {
    throw new Error("Enter a time or a note.");
  }
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = { minutes, note };
  if (input.spentOn) patch.spent_on = input.spentOn;
  const { error } = await supabase.from("time_entries").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidateEntity(input.entityType, input.entityId);
}

export async function deleteTimeEntry(id: number, entityType: TrackedEntity, entityId: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateEntity(entityType, entityId);
}

// ── Entity comments ──────────────────────────────────────────────────────────

export async function addEntityComment(input: {
  entityType: TrackedEntity;
  entityId: number;
  content: string;
}) {
  const content = input.content.trim();
  if (!content) throw new Error("Comment cannot be empty.");

  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("entity_comments").insert({
    org_id: orgId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    content,
    author_id: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidateEntity(input.entityType, input.entityId);
}

export async function deleteEntityComment(id: number, entityType: TrackedEntity, entityId: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("entity_comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateEntity(entityType, entityId);
}
