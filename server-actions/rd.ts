"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

// ── Statuses (swimlane columns) ────────────────────────────────────────────

export async function createRdStatus(name: string, color: string) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { data: last } = await supabase
    .from("rd_statuses").select("position").eq("org_id", orgId)
    .order("position", { ascending: false }).limit(1).single();
  const { error } = await supabase.from("rd_statuses").insert({
    org_id: orgId, name, color, position: (last?.position ?? -1) + 1,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/rd");
}

export async function updateRdStatus(id: number, name: string, color: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("rd_statuses").update({ name, color }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rd");
}

export async function deleteRdStatus(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("rd_statuses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rd");
}

export async function reorderRdStatuses(ordered: { id: number; position: number }[]) {
  const supabase = await createServerClient();
  await Promise.all(ordered.map(({ id, position }) =>
    supabase.from("rd_statuses").update({ position }).eq("id", id)
  ));
  revalidatePath("/rd");
}

// ── Tags (classification, separate from status) ─────────────────────────────

export async function createRdTag(name: string, color: string) {
  if (!name.trim()) throw new Error("Tag name is required");
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("rd_tags").insert({ org_id: orgId, name: name.trim(), color });
  if (error) throw new Error(error.message);
  revalidatePath("/rd");
}

export async function updateRdTag(id: number, name: string, color: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("rd_tags").update({ name: name.trim(), color }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rd");
}

export async function deleteRdTag(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("rd_tags").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rd");
}

/** Replace the full set of tags on a project. */
export async function setProjectTags(projectId: number, tagIds: number[]) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  // Simplest correct approach: clear then re-insert the desired set.
  const { error: delErr } = await supabase.from("rd_project_tags").delete().eq("project_id", projectId);
  if (delErr) throw new Error(delErr.message);
  if (tagIds.length > 0) {
    const rows = tagIds.map((tag_id) => ({ project_id: projectId, tag_id, org_id: orgId }));
    const { error: insErr } = await supabase.from("rd_project_tags").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
  revalidatePath("/rd");
}

// ── Projects ───────────────────────────────────────────────────────────────

export async function createRdProject(data: {
  name: string;
  description?: string | null;
  status_id?: number | null;
  target_date?: string | null;
  assigned_to?: string | null;
  priority: string;
  budget_estimate?: number | null;
  notes?: string | null;
  tag_ids?: number[];
}) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { tag_ids, ...projectData } = data;
  const { data: created, error } = await supabase
    .from("rd_projects")
    .insert({ org_id: orgId, ...projectData })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (tag_ids && tag_ids.length > 0 && created) {
    const rows = tag_ids.map((tag_id) => ({ project_id: created.id, tag_id, org_id: orgId }));
    const { error: tagErr } = await supabase.from("rd_project_tags").insert(rows);
    if (tagErr) throw new Error(tagErr.message);
  }
  revalidatePath("/rd");
}

export async function updateRdProject(id: number, data: {
  name?: string;
  description?: string | null;
  status_id?: number | null;
  target_date?: string | null;
  assigned_to?: string | null;
  priority?: string;
  budget_estimate?: number | null;
  notes?: string | null;
}) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("rd_projects").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rd");
}

export async function updateRdProjectStatus(id: number, statusId: number | null) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("rd_projects").update({ status_id: statusId }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rd");
}

export async function deleteRdProject(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("rd_projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rd");
}

export async function finalizeRdProject(
  projectId: number,
  productData: {
    name: string;
    sku?: string | null;
    description?: string | null;
    unit_price: number;
    category?: string | null;
  },
  options?: { capitalise?: boolean; amortisationMonths?: number | null }
) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { data: product, error: prodErr } = await supabase.from("dim_products").insert({
    org_id: orgId,
    name: productData.name,
    sku: productData.sku || null,
    description: productData.description || null,
    unit_price: productData.unit_price,
    category: productData.category || null,
    is_active: true,
  }).select("id").single();

  if (prodErr) throw new Error(prodErr.message);

  // Base finalize patch + optional capitalisation (import to Balance Sheet)
  const patch: Record<string, unknown> = {
    product_id: product.id,
    finalized_at: new Date().toISOString(),
  };
  if (options?.capitalise) {
    patch.is_capex = true;
    const m = options.amortisationMonths;
    patch.amortisation_months = m != null && m > 0 ? m : null;
  }

  const { error } = await supabase.from("rd_projects").update(patch).eq("id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath("/rd");
  revalidatePath("/products");
  revalidatePath("/accounting");
}

export async function addRdProjectUpdate(projectId: number, content: string) {
  if (!content.trim()) throw new Error("Update content is required");
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("rd_project_updates").insert({
    org_id: orgId,
    project_id: projectId,
    content: content.trim(),
    author_id: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}
