import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId, getCurrentOrgRole } from "@/lib/supabase/org";
import { RdClient } from "@/components/RdClient";

export default async function RdPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();
  const currentRole = await getCurrentOrgRole();

  const [
    { data: statuses },
    { data: projects },
    { data: org },
    { data: memberMemberships },
    { data: times },
    { data: tags },
    { data: projectTagRows },
  ] = await Promise.all([
    supabase.from("rd_statuses").select("*").eq("org_id", orgId).order("position"),
    supabase.from("rd_projects").select("*").eq("org_id", orgId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("organizations").select("currency, default_hourly_rate").eq("id", orgId).single(),
    supabase.from("memberships").select("user_id").eq("org_id", orgId),
    supabase.from("time_entries").select("entity_id, minutes").eq("org_id", orgId).eq("entity_type", "rd_project"),
    supabase.from("rd_tags").select("id, name, color").eq("org_id", orgId).order("name"),
    supabase.from("rd_project_tags").select("project_id, tag_id").eq("org_id", orgId),
  ]);

  // Map project → assigned tag ids
  const tagIdsByProject: Record<number, number[]> = {};
  (projectTagRows || []).forEach((r) => {
    const pid = Number(r.project_id);
    (tagIdsByProject[pid] ||= []).push(Number(r.tag_id));
  });

  // ── Build the "Report" view rows: logged hours + capex fields per project ──
  const minutesByProject: Record<number, number> = {};
  (times || []).forEach((t) => {
    const id = Number(t.entity_id);
    minutesByProject[id] = (minutesByProject[id] || 0) + Number(t.minutes || 0);
  });
  const statusById = new Map((statuses || []).map((s) => [s.id, s]));
  const reportProjects = (projects || []).map((p) => {
    const st = p.status_id != null ? statusById.get(p.status_id) : null;
    return {
      id: p.id,
      name: p.name as string,
      status_name: st?.name ?? null,
      status_color: st?.color ?? null,
      priority: (p.priority as string) ?? "medium",
      finalized_at: (p.finalized_at as string | null) ?? null,
      is_finalized: !!p.product_id || !!p.finalized_at,
      is_capex: !!p.is_capex,
      amortisation_months: (p.amortisation_months as number | null) ?? null,
      hourly_rate_override: p.hourly_rate_override != null ? Number(p.hourly_rate_override) : null,
      hours: (minutesByProject[p.id] || 0) / 60,
      tag_ids: tagIdsByProject[p.id] ?? [],
    };
  });

  const curCode = org?.currency || "ZAR";
  const reportCurrency = curCode === "ZAR" ? "R" : curCode === "USD" ? "$" : curCode === "EUR" ? "€" : "R";

  // Resolve member emails for assignment dropdown
  let members: { user_id: string; email: string }[] = [];
  if ((memberMemberships?.length ?? 0) > 0) {
    try {
      const admin = createAdminClient();
      const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const memberIds = new Set((memberMemberships ?? []).map(m => String(m.user_id)));
      members = (authData?.users ?? [])
        .filter(u => memberIds.has(u.id))
        .map(u => ({ user_id: u.id, email: u.email ?? u.id }));
    } catch {
      members = [];
    }
  }

  return (
    <section>
      <RdClient
        statuses={statuses || []}
        projects={projects || []}
        members={members}
        currency={org?.currency || "ZAR"}
        currentRole={currentRole ?? "member"}
        reportProjects={reportProjects}
        reportCurrency={reportCurrency}
        defaultRate={Number(org?.default_hourly_rate ?? 1000)}
        asOf={new Date().toISOString().slice(0, 10)}
        tags={tags || []}
        tagIdsByProject={tagIdsByProject}
      />
    </section>
  );
}
