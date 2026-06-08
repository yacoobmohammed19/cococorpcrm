import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { MarketingClient } from "@/components/MarketingClient";

export default async function MarketingPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  const [{ data: campaigns, error: campErr }, { data: updates, error: updErr }, { data: org }] = await Promise.all([
    supabase.from("fact_campaigns").select("id, name, platform, objective, status, total_budget, start_date, end_date, notes").eq("org_id", orgId).order("id", { ascending: false }),
    supabase.from("fact_campaign_updates").select("id, campaign_id, date, spend, impressions, clicks, conversions, revenue, notes").eq("org_id", orgId).order("date", { ascending: false }),
    supabase.from("organizations").select("currency").eq("id", orgId).single(),
  ]);

  if (campErr || updErr) {
    return (
      <section>
        <h1 className="text-2xl font-semibold mb-4">Marketing</h1>
        <div className="rounded-lg p-8 text-center" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
          <p className="text-sm mb-2" style={{ color: "var(--muted2)" }}>Marketing tables not set up yet</p>
          <p className="text-xs" style={{ color: "var(--muted2)" }}>
            Create <code className="px-1 py-0.5 rounded" style={{ background: "var(--card3)" }}>fact_campaigns</code> and{" "}
            <code className="px-1 py-0.5 rounded" style={{ background: "var(--card3)" }}>fact_campaign_updates</code> tables in Supabase to enable marketing tracking.
          </p>
        </div>
      </section>
    );
  }

  const mappedCampaigns = (campaigns || []).map(c => ({
    id: c.id,
    name: c.name || "",
    platform: c.platform ?? null,
    objective: c.objective ?? null,
    status: c.status || "Draft",
    total_budget: c.total_budget ? Number(c.total_budget) : null,
    start_date: c.start_date ?? null,
    end_date: c.end_date ?? null,
    notes: c.notes ?? null,
  }));

  const mappedUpdates = (updates || []).map(u => ({
    id: u.id,
    campaign_id: u.campaign_id,
    date: u.date ?? null,
    spend: Number(u.spend || 0),
    impressions: Number(u.impressions || 0),
    clicks: Number(u.clicks || 0),
    conversions: Number(u.conversions || 0),
    revenue: Number(u.revenue || 0),
    notes: u.notes ?? null,
  }));

  return (
    <section>
      <MarketingClient
        campaigns={mappedCampaigns}
        updates={mappedUpdates}
        currency={org?.currency || "ZAR"}
      />
    </section>
  );
}
