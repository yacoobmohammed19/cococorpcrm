import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { TimelineClient, type TimelineRow } from "@/components/TimelineClient";

export const dynamic = "force-dynamic";

// activity_log stores the raw table name; map to the friendly entity we surface.
const ENTITY_LABELS: Record<string, "lead" | "product"> = {
  fact_leads: "lead",
  dim_products: "product",
};

type LogRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
};

export default async function TimelinePage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: logData }, { data: statusesData }, { data: membershipsData }] = await Promise.all([
    supabase.from("activity_log")
      .select("id, entity_type, entity_id, action, before_state, after_state, user_id, created_at")
      .eq("org_id", orgId)
      .in("entity_type", Object.keys(ENTITY_LABELS))
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("dim_statuses").select("id, name").eq("org_id", orgId),
    supabase.from("memberships").select("user_id").eq("org_id", orgId),
  ]);

  const statusName = new Map((statusesData ?? []).map(s => [Number(s.id), String(s.name)]));

  // Resolve member emails for author labels (same pattern as the lead detail page).
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
    } catch { /* admin client unavailable → fall back to "Someone" client-side */ }
  }

  // Fields worth surfacing per entity, with friendly labels + value rendering.
  const LEAD_FIELDS: Record<string, string> = {
    name: "Name", status_id: "Status", opportunity_value: "Opportunity",
    weight: "Weight", lead_date: "Lead date", last_follow_up: "Follow-up",
    contacted: "Contacted", responded: "Responded", developed: "Developed", completed: "Completed",
  };
  const PRODUCT_FIELDS: Record<string, string> = {
    name: "Name", unit_price: "Price", sku: "SKU", category: "Category", is_active: "Active",
  };

  const renderVal = (entity: "lead" | "product", key: string, val: unknown): string => {
    if (val === null || val === undefined || val === "") return "—";
    if (entity === "lead" && key === "status_id") return statusName.get(Number(val)) ?? String(val);
    if (typeof val === "boolean") return val ? "Yes" : "No";
    return String(val);
  };

  const rows: TimelineRow[] = (logData as LogRow[] ?? []).map(r => {
    const entity = ENTITY_LABELS[r.entity_type];
    const fields = entity === "lead" ? LEAD_FIELDS : PRODUCT_FIELDS;
    const before = r.before_state ?? {};
    const after = r.after_state ?? {};
    const record = String(after.name ?? before.name ?? `#${r.entity_id}`);

    const changes: { label: string; from: string; to: string }[] = [];
    if (r.action === "update") {
      for (const [key, label] of Object.entries(fields)) {
        if (String(before[key] ?? "") !== String(after[key] ?? "")) {
          changes.push({ label, from: renderVal(entity, key, before[key]), to: renderVal(entity, key, after[key]) });
        }
      }
    }

    return {
      id: r.id,
      entity,
      entityId: r.entity_id,
      action: r.action,
      record,
      author: r.user_id ? (emailById.get(r.user_id) ?? "Someone") : "System",
      createdAt: r.created_at,
      changes,
    };
  });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timeline</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted2)" }}>
          Timestamped progress across leads and products
        </p>
      </div>
      <TimelineClient rows={rows} />
    </section>
  );
}
