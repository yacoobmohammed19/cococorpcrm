import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { LeadDetailClient } from "@/components/LeadDetailClient";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  const supabase = await createServerClient();

  const [{ data: lead }, { data: statuses }, { data: org }] = await Promise.all([
    supabase.from("fact_leads").select("*").eq("id", leadId).single(),
    supabase.from("dim_statuses").select("id, name").order("id"),
    supabase.from("organizations").select("currency").single(),
  ]);

  if (!lead) notFound();

  let activities: { id: number; type: string; subject: string; notes: string | null; due_date: string | null; done: boolean; created_at: string }[] = [];
  try {
    const { data: a } = await supabase.from("fact_activities")
      .select("id, type, subject, notes, due_date, done, created_at")
      .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20);
    activities = a || [];
  } catch { /* table may not exist yet */ }

  const currency = org?.currency || "ZAR";
  const cur = currency === "ZAR" ? "R" : "$";
  const status = (statuses || []).find(s => s.id === lead.status_id);

  return (
    <section className="space-y-6 max-w-4xl">
      <Breadcrumb crumbs={[{ label: "Leads", href: "/leads" }, { label: lead.name }]} />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{lead.name}</h1>
          {status && (
            <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-semibold"
              style={{ background: "rgba(16,185,129,.12)", color: "var(--accent)" }}>
              {status.name}
            </span>
          )}
        </div>
      </div>

      <LeadDetailClient lead={lead} activities={activities} currency={cur} leadId={leadId} />
    </section>
  );
}
