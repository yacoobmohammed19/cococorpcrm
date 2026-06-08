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
}) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("rd_projects").insert({ org_id: orgId, ...data });
  if (error) throw new Error(error.message);
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

export async function finalizeRdProject(projectId: number, productData: {
  name: string;
  sku?: string | null;
  description?: string | null;
  unit_price: number;
  category?: string | null;
}) {
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

  const { error } = await supabase.from("rd_projects").update({
    product_id: product.id,
    finalized_at: new Date().toISOString(),
  }).eq("id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath("/rd");
  revalidatePath("/products");
}
