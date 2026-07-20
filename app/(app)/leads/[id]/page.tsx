import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId, getCurrentOrgRole } from "@/lib/supabase/org";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { LeadDetailClient } from "@/components/LeadDetailClient";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();
  const role = await getCurrentOrgRole();

  const [{ data: lead }, { data: statuses }, { data: org }] = await Promise.all([
    supabase.from("fact_leads").select("*").eq("id", leadId).single(),
    supabase.from("dim_statuses").select("id, name").eq("org_id", orgId).order("id"),
    supabase.from("organizations").select("currency").eq("id", orgId).single(),
  ]);

  if (!lead) notFound();

  // Activities, time entries, comments and change-history. A query against a
  // not-yet-migrated table returns { data: null } rather than throwing, so a
  // missing table just yields an empty list instead of a 500.
  const [
    { data: activitiesData },
    { data: timeData },
    { data: commentsData },
    { data: historyData },
    { data: membershipsData },
  ] = await Promise.all([
    supabase.from("fact_activities")
      .select("id, type, subject, notes, due_date, done, created_at")
      .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
    supabase.from("time_entries")
      .select("id, minutes, note, spent_on, author_id, created_at")
      .eq("entity_type", "lead").eq("entity_id", leadId)
      .order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("entity_comments")
      .select("id, content, author_id, created_at")
      .eq("entity_type", "lead").eq("entity_id", leadId)
      .order("created_at", { ascending: false }),
    supabase.from("activity_log")
      .select("id, action, before_state, after_state, user_id, created_at")
      .eq("entity_type", "fact_leads").eq("entity_id", leadId)
      .order("created_at", { ascending: false }).limit(40),
    supabase.from("memberships").select("user_id").eq("org_id", orgId),
  ]);

  const activities = activitiesData ?? [];
  const timeEntries = timeData ?? [];
  const comments = commentsData ?? [];
  const history = historyData ?? [];
  const memberships = membershipsData ?? [];

  // Resolve member emails (for author labels on time/comments/history)
  let members: { user_id: string; email: string }[] = [];
  if (memberships.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const memberIds = new Set(memberships.map(m => String(m.user_id)));
      members = (authData?.users ?? [])
        .filter(u => memberIds.has(u.id))
        .map(u => ({ user_id: u.id, email: u.email ?? u.id }));
    } catch { members = []; }
  }

  const currency = org?.currency || "ZAR";
  const cur = currency === "ZAR" ? "R" : "$";
  const status = (statuses || []).find(s => s.id === lead.status_id);
  const canEdit = ["owner", "admin", "member", "operator"].includes(role ?? "");
  const canDelete = ["owner", "admin"].includes(role ?? "");

  return (
    <section className="space-y-6 max-w-4xl">
      <Breadcrumb crumbs={[{ label: "Leads", href: "/leads" }, { label: lead.name }]} />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{lead.name}</h1>
          {status && (
            <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-semibold"
              style={{ background: "rgba(236,72,153,.12)", color: "var(--accent)" }}>
              {status.name}
            </span>
          )}
        </div>
      </div>

      <LeadDetailClient
        lead={lead}
        activities={activities}
        timeEntries={timeEntries}
        comments={comments}
        history={history}
        statuses={statuses || []}
        members={members}
        currency={cur}
        leadId={leadId}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </section>
  );
}
