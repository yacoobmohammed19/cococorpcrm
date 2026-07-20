"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { LeadSchema } from "@/lib/schemas/leads";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dimCacheTag } from "@/lib/supabase/cache";

export async function createLead(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const parsed = LeadSchema.parse({
    org_id: orgId,
    name: formData.get("name"),
    phone: formData.get("phone"),
    contact: formData.get("contact"),
    lead_date: formData.get("lead_date") || new Date().toISOString().split("T")[0],
    status_id: formData.get("status_id") || null,
    last_follow_up: formData.get("last_follow_up") || null,
    opportunity_value: formData.get("opportunity_value") || 0,
    weight: formData.get("weight") || 0,
    contacted: formData.get("contacted") === "true",
    responded: formData.get("responded") === "true",
    developed: formData.get("developed") === "true",
    completed: formData.get("completed") === "true",
    total_revenue: formData.get("total_revenue") || null,
    secured_revenue: formData.get("secured_revenue") || null,
  });

  const { data: { user } } = await supabase.auth.getUser();

  const productId = formData.get("product_id");
  const { error } = await supabase.from("fact_leads").insert({
    ...parsed,
    total_revenue: parsed.total_revenue || null,
    secured_revenue: parsed.secured_revenue || null,
    product_id: productId ? Number(productId) : null,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function updateLead(id: number, formData: FormData) {
  const supabase = await createServerClient();

  const productId = formData.get("product_id");
  const assignedTo = formData.get("assigned_to");
  const { data, error } = await supabase.from("fact_leads").update({
    name: formData.get("name"),
    phone: formData.get("phone") || null,
    contact: formData.get("contact") || null,
    lead_date: formData.get("lead_date") || null,
    status_id: formData.get("status_id") ? Number(formData.get("status_id")) : null,
    last_follow_up: formData.get("last_follow_up") || null,
    opportunity_value: formData.get("opportunity_value") ? Number(formData.get("opportunity_value")) : null,
    weight: formData.get("weight") ? Number(formData.get("weight")) : 0,
    total_revenue: formData.get("total_revenue") ? Number(formData.get("total_revenue")) : null,
    secured_revenue: formData.get("secured_revenue") ? Number(formData.get("secured_revenue")) : null,
    contacted: formData.get("contacted") === "true",
    responded: formData.get("responded") === "true",
    developed: formData.get("developed") === "true",
    completed: formData.get("completed") === "true",
    product_id: productId ? Number(productId) : null,
    assigned_to: assignedTo || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("id");

  if (error) throw new Error(error.message);
  // A row-level-security mismatch updates 0 rows WITHOUT an error, which silently
  // reverts the optimistic UI. Surface it instead of failing quietly.
  if (!data || data.length === 0) {
    throw new Error("Lead wasn't updated — it may have been removed, or you don't have permission to edit it.");
  }
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

/** Quickly assign a lead to a user (operator). Called from the leads list. */
export async function assignLead(leadId: number, userId: string | null) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("fact_leads")
    .update({ assigned_to: userId, updated_at: new Date().toISOString() })
    .eq("id", leadId).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Assignment wasn't saved — the lead may have been removed, or you don't have permission to edit it.");
  }
  revalidatePath("/leads");
}

export async function updateLeadStatus(id: number, statusId: number) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("fact_leads")
    .update({ status_id: statusId, updated_at: new Date().toISOString() })
    .eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Status wasn't updated — the lead may have been removed, or you don't have permission to edit it.");
  }
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function convertLeadToCustomer(leadId: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { data: lead } = await supabase.from("fact_leads").select("*").eq("id", leadId).single();
  if (!lead) throw new Error("Lead not found");

  const { data: customer, error: custErr } = await supabase.from("dim_customers").insert({
    org_id: orgId,
    name: lead.name,
    phone: lead.phone,
    contact_person: lead.contact,
    source: "CRM",
  }).select("id").single();

  if (custErr) throw new Error(custErr.message);

  await supabase.from("fact_leads").update({ customer_id: customer.id }).eq("id", leadId);
  revalidateTag(dimCacheTag(orgId), "default");
  revalidatePath("/leads");
  revalidatePath("/customers");
}

export async function deleteLead(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("fact_leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function restoreLead(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_leads").update({ deleted_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
}

// Fields worth surfacing in the lead history feed, with friendly labels.
const LEAD_HISTORY_FIELDS: Record<string, string> = {
  name: "Name", status_id: "Status", opportunity_value: "Opportunity", weight: "Weight",
  lead_date: "Lead date", last_follow_up: "Follow-up", phone: "Phone", contact: "Contact",
  contacted: "Contacted", responded: "Responded", developed: "Developed", completed: "Completed",
  total_revenue: "Total revenue", secured_revenue: "Secured revenue",
};

/**
 * Timestamped change history for a single lead — the same audit feed shown on
 * the lead detail page's History tab, used inline by the leads list edit modal.
 * Returns newest-first; empty if the audit log is unreadable or has no rows.
 */
export async function getLeadTimeline(leadId: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const [{ data: logData }, { data: statusesData }, { data: membershipsData }] = await Promise.all([
    supabase.from("activity_log")
      .select("id, action, before_state, after_state, user_id, created_at")
      .eq("org_id", orgId).eq("entity_type", "fact_leads").eq("entity_id", leadId)
      .order("created_at", { ascending: false }).limit(50),
    supabase.from("dim_statuses").select("id, name").eq("org_id", orgId),
    supabase.from("memberships").select("user_id").eq("org_id", orgId),
  ]);

  const statusName = new Map((statusesData ?? []).map(s => [Number(s.id), String(s.name)]));

  // Resolve author emails, scoped to org members (same pattern as the detail page).
  let emailById = new Map<string, string>();
  const memberships = membershipsData ?? [];
  if (memberships.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const ids = new Set(memberships.map(m => String(m.user_id)));
      emailById = new Map(
        (authData?.users ?? [])
          .filter(u => ids.has(u.id))
          .map(u => [u.id, (u.email ?? u.id).split("@")[0]]),
      );
    } catch { /* admin unavailable → fall back to "Someone" */ }
  }

  const render = (key: string, val: unknown): string => {
    if (val === null || val === undefined || val === "") return "—";
    if (key === "status_id") return statusName.get(Number(val)) ?? String(val);
    if (typeof val === "boolean") return val ? "Yes" : "No";
    return String(val);
  };

  return (logData ?? []).map(r => {
    const before = (r.before_state ?? {}) as Record<string, unknown>;
    const after = (r.after_state ?? {}) as Record<string, unknown>;
    const changes: { label: string; from: string; to: string }[] = [];
    if (r.action === "update") {
      for (const [key, label] of Object.entries(LEAD_HISTORY_FIELDS)) {
        if (String(before[key] ?? "") !== String(after[key] ?? "")) {
          changes.push({ label, from: render(key, before[key]), to: render(key, after[key]) });
        }
      }
    }
    return {
      id: r.id as number,
      action: String(r.action),
      author: r.user_id ? (emailById.get(r.user_id) ?? "Someone") : "System",
      createdAt: String(r.created_at),
      changes,
    };
  });
}
