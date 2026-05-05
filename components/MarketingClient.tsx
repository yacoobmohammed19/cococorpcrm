"use client";

import { useState, useMemo } from "react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/hooks/useConfirm";
import { runAction } from "@/lib/action-utils";
import { createCampaign, logCampaignUpdate, deleteCampaign, deleteCampaignUpdate, updateCampaignStatus } from "@/server-actions/marketing";

type Campaign = {
  id: number; name: string; platform: string | null; objective: string | null;
  status: string; total_budget: number | null; start_date: string | null; end_date: string | null; notes: string | null;
};
type CampaignUpdate = {
  id: number; campaign_id: number; date: string | null; spend: number;
  impressions: number; clicks: number; conversions: number; revenue: number; notes: string | null;
};
type Props = { campaigns: Campaign[]; updates: CampaignUpdate[]; currency: string };

const PLATFORMS = ["Meta (Facebook/Instagram)", "Google Ads", "TikTok", "LinkedIn", "Twitter/X", "Other"];
const OBJECTIVES = ["Brand Awareness", "Traffic", "Lead Generation", "Conversions", "Sales", "Engagement"];
const STATUSES = ["Draft", "Active", "Paused", "Completed"];

const STATUS_COLORS: Record<string, string> = {
  Active: "var(--accent)", Draft: "var(--muted2)", Paused: "var(--amber-c)", Completed: "var(--purple-c)"
};
const PLAT_COLORS: Record<string, string> = {
  "Meta (Facebook/Instagram)": "var(--pink)", "Google Ads": "var(--cyan-c)", "TikTok": "var(--accent)"
};

function fmt(n: number) { return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmt2(n: number) { return Number(n).toFixed(2); }
function fdate(d: string | null) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return "—"; } }

function aggCampaign(updates: CampaignUpdate[], cid: number) {
  const ups = updates.filter(u => u.campaign_id === cid);
  const spend = ups.reduce((s, u) => s + u.spend, 0);
  const impressions = ups.reduce((s, u) => s + u.impressions, 0);
  const clicks = ups.reduce((s, u) => s + u.clicks, 0);
  const conversions = ups.reduce((s, u) => s + u.conversions, 0);
  const revenue = ups.reduce((s, u) => s + u.revenue, 0);
  return {
    spend, impressions, clicks, conversions, revenue,
    ctr: impressions > 0 ? (clicks / impressions * 100) : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? revenue / spend : 0,
    entries: ups.length,
  };
}

export function MarketingClient({ campaigns, updates, currency }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();
  const [tab, setTab] = useState<"dashboard" | "campaigns" | "log">("dashboard");
  const [campModal, setCampModal] = useState(false);
  const [campStartDate, setCampStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [campEndDate, setCampEndDate] = useState("");
  const [logModal, setLogModal] = useState<number | null>(null);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const allAgg = useMemo(() => {
    const spend = updates.reduce((s, u) => s + u.spend, 0);
    const impressions = updates.reduce((s, u) => s + u.impressions, 0);
    const clicks = updates.reduce((s, u) => s + u.clicks, 0);
    const conversions = updates.reduce((s, u) => s + u.conversions, 0);
    const revenue = updates.reduce((s, u) => s + u.revenue, 0);
    const totalBudget = campaigns.reduce((s, c) => s + (c.total_budget || 0), 0);
    return {
      spend, impressions, clicks, conversions, revenue, totalBudget,
      activeCamps: campaigns.filter(c => c.status === "Active").length,
      ctr: impressions > 0 ? clicks / impressions * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
      roas: spend > 0 ? revenue / spend : 0,
      budgetUsed: totalBudget > 0 ? spend / totalBudget * 100 : 0,
    };
  }, [campaigns, updates]);

  const today = new Date().toISOString().slice(0, 10);
  const inputCss = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
  const inputStyle = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

  async function handleCreateCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    await createCampaign(new FormData(e.currentTarget));
    setBusy(false);
    setCampModal(false);
  }

  async function handleLogUpdate(e: React.FormEvent<HTMLFormElement>, cid: number) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set("campaign_id", String(cid));
    await logCampaignUpdate(fd);
    setBusy(false);
    setLogModal(null);
  }

  async function handleDeleteCampaign(id: number) {
    if (!await confirm("Delete this campaign?", "All associated log entries will also be removed.")) return;
    setBusy(true);
    await runAction(() => deleteCampaign(id), toast, "Campaign deleted");
    setBusy(false);
  }

  async function handleDeleteUpdate(id: number) {
    if (!await confirm("Delete this log entry?", "This performance record will be permanently removed.")) return;
    setBusy(true);
    await runAction(() => deleteCampaignUpdate(id), toast, "Log entry deleted");
    setBusy(false);
  }

  async function handleStatusChange(id: number, status: string) {
    setBusy(true);
    await updateCampaignStatus(id, status);
    setBusy(false);
  }

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)}
      className="px-4 py-2 text-xs font-semibold rounded transition-colors"
      style={{ background: tab === t ? "var(--accent)" : "var(--card3)", color: tab === t ? "#fff" : "var(--muted)", border: "1px solid var(--border)" }}>
      {label}
    </button>
  );

  const Kpi = ({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) => (
    <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{label}</div>
      <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>{sub}</div>}
    </div>
  );

  const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4"
      style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} style={{ color: "var(--muted2)", background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Marketing</h1>
        <div className="flex gap-2 flex-wrap">
          {tabBtn("dashboard", "📊 Dashboard")}
          {tabBtn("campaigns", "📋 Campaigns")}
          {tabBtn("log", "📈 Performance Log")}
          <button onClick={() => { setCampStartDate(new Date().toISOString().slice(0, 10)); setCampEndDate(""); setCampModal(true); }}
            className="px-4 py-2 text-xs font-semibold rounded"
            style={{ background: "var(--accent)", color: "#fff" }}>+ Campaign</button>
        </div>
      </div>

      {/* Dashboard Tab */}
      {tab === "dashboard" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <Kpi label="Total Ad Spend" value={`${cur} ${fmt(allAgg.spend)}`} color="var(--red-c)" sub={`${campaigns.length} campaigns`} />
            <Kpi label="Active Campaigns" value={String(allAgg.activeCamps)} color="var(--accent)" sub={`of ${campaigns.length} total`} />
            <Kpi label="Impressions" value={fmt(allAgg.impressions)} color="var(--purple-c)" />
            <Kpi label="Clicks" value={fmt(allAgg.clicks)} color="var(--cyan-c)" sub={`CTR: ${fmt2(allAgg.ctr)}%`} />
            <Kpi label="Conversions" value={fmt(allAgg.conversions)} color="var(--accent)" />
            <Kpi label="CPC" value={`${cur} ${fmt2(allAgg.cpc)}`} color="var(--amber-c)" />
            <Kpi label="CPA" value={`${cur} ${fmt2(allAgg.cpa)}`} color="var(--red-c)" />
            <Kpi label="ROAS" value={`${fmt2(allAgg.roas)}x`} color="var(--accent)" sub={`${cur} ${fmt(allAgg.revenue)} revenue`} />
            <Kpi label="Budget Used" value={`${allAgg.budgetUsed.toFixed(0)}%`} color="var(--amber-c)" sub={`${cur} ${fmt(allAgg.spend)} of ${cur} ${fmt(allAgg.totalBudget)}`} />
          </div>

          {/* Campaign Performance Table */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Campaign Performance</h3>
            </div>
            <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                    {["Campaign", "Platform", "Status", "Spend", "Impressions", "Clicks", "CTR", "Conv.", "CPC", "ROAS"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => {
                    const ag = aggCampaign(updates, c.id);
                    const sc = STATUS_COLORS[c.status] || "var(--muted2)";
                    const pc = PLAT_COLORS[c.platform || ""] || "var(--muted2)";
                    return (
                      <tr key={c.id} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2 font-semibold max-w-[160px] truncate">{c.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: pc }}>{c.platform || "—"}</td>
                        <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: sc + "22", color: sc }}>{c.status}</span></td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--red-c)" }}>{cur} {fmt(ag.spend)}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{fmt(ag.impressions)}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{fmt(ag.clicks)}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{fmt2(ag.ctr)}%</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{fmt(ag.conversions)}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{cur} {fmt2(ag.cpc)}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: ag.roas >= 2 ? "var(--accent)" : ag.roas < 1 ? "var(--red-c)" : "var(--amber-c)" }}>{fmt2(ag.roas)}x</td>
                      </tr>
                    );
                  })}
                  {campaigns.length === 0 && <tr><td colSpan={10}><EmptyState icon="📣" title="No campaigns yet" description="Create your first campaign to start tracking marketing performance." /></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Tab */}
      {tab === "campaigns" && (
        <div className="space-y-3">
          {campaigns.map(c => {
            const ag = aggCampaign(updates, c.id);
            const sc = STATUS_COLORS[c.status] || "var(--muted2)";
            return (
              <div key={c.id} className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>
                      {c.platform && <span className="mr-2">{c.platform}</span>}
                      {c.objective && <span className="mr-2">· {c.objective}</span>}
                      {c.start_date && <span>· {fdate(c.start_date)} → {fdate(c.end_date)}</span>}
                    </div>
                    {c.notes && <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>{c.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={c.status} onChange={e => handleStatusChange(c.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded border-0 outline-none cursor-pointer font-semibold"
                      style={{ background: sc + "22", color: sc }}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => { setLogDate(new Date().toISOString().slice(0, 10)); setLogModal(c.id); }}
                      className="text-xs px-3 py-1.5 rounded font-semibold"
                      style={{ background: "var(--card3)", color: "var(--accent)", border: "1px solid var(--border)" }}>📊 Log</button>
                    <button onClick={() => handleDeleteCampaign(c.id)}
                      className="text-xs px-2 py-1.5 rounded"
                      style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>✕</button>
                  </div>
                </div>
                {ag.entries > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                    {[["Spend", `${cur} ${fmt(ag.spend)}`, "var(--red-c)"], ["Clicks", fmt(ag.clicks), "var(--cyan-c)"], ["Conv.", fmt(ag.conversions), "var(--accent)"], ["ROAS", `${fmt2(ag.roas)}x`, "var(--purple-c)"]].map(([l, v, c]) => (
                      <div key={l}>
                        <div className="text-xs" style={{ color: "var(--muted2)" }}>{l}</div>
                        <div className="text-sm font-bold font-mono" style={{ color: c }}>{v}</div>
                      </div>
                    ))}
                    {c.total_budget && (
                      <div>
                        <div className="text-xs" style={{ color: "var(--muted2)" }}>Budget</div>
                        <div className="text-sm font-bold font-mono" style={{ color: "var(--amber-c)" }}>{cur} {fmt(c.total_budget)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {campaigns.length === 0 && (
            <EmptyState icon="📣" title="No campaigns yet" description='Click "+ Campaign" to create your first marketing campaign.' />
          )}
        </div>
      )}

      {/* Performance Log Tab */}
      {tab === "log" && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                  {["Date", "Campaign", "Spend", "Impressions", "Clicks", "Conv.", "Revenue", "Notes", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...updates].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(u => {
                  const camp = campaigns.find(c => c.id === u.campaign_id);
                  return (
                    <tr key={u.id} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(u.date)}</td>
                      <td className="px-3 py-2 font-semibold max-w-[150px] truncate">{camp?.name || `#${u.campaign_id}`}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--red-c)" }}>{cur} {fmt(u.spend)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(u.impressions)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(u.clicks)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(u.conversions)}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--accent)" }}>{cur} {fmt(u.revenue)}</td>
                      <td className="px-3 py-2 max-w-[150px] truncate" style={{ color: "var(--muted2)" }}>{u.notes || "—"}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => handleDeleteUpdate(u.id)}
                          className="px-2 py-1 rounded text-xs"
                          style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
                {updates.length === 0 && <tr><td colSpan={9}><EmptyState icon="📈" title="No performance entries yet" description="Click the log button on a campaign to record results." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
      {campModal && (
        <Modal title="Create Campaign" onClose={() => setCampModal(false)}>
          <form onSubmit={handleCreateCampaign}>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Campaign Name *</label>
                <input name="name" required className={inputCss} style={inputStyle} placeholder="e.g. March Meta Ads" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Platform</label>
                  <select name="platform" className={inputCss} style={inputStyle}>
                    <option value="">— Select —</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Objective</label>
                  <select name="objective" className={inputCss} style={inputStyle}>
                    <option value="">— Select —</option>
                    {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                  <select name="status" defaultValue="Draft" className={inputCss} style={inputStyle}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Total Budget ({cur})</label>
                  <input name="total_budget" type="number" step="0.01" min="0" className={inputCss} style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Start Date</label>
                  <DateInput name="start_date" value={campStartDate} onChange={setCampStartDate} placeholder="Start date" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>End Date</label>
                  <DateInput name="end_date" value={campEndDate} onChange={setCampEndDate} placeholder="End date (optional)" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                <textarea name="notes" className={inputCss} style={inputStyle} rows={2} placeholder="Campaign notes…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
              <button type="button" onClick={() => setCampModal(false)}
                className="px-4 py-2 rounded text-sm" style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
              <button type="submit" disabled={busy}
                className="px-5 py-2 rounded text-sm font-semibold"
                style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                {busy ? "Saving…" : "Create Campaign"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log Update Modal */}
      {logModal !== null && (
        <Modal title={`Log Results — ${campaigns.find(c => c.id === logModal)?.name || ""}`} onClose={() => setLogModal(null)}>
          <form onSubmit={e => handleLogUpdate(e, logModal)}>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                <DateInput name="date" value={logDate} onChange={setLogDate} placeholder="Log date" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[["spend", "Ad Spend", "0.00", true], ["impressions", "Impressions", "0", false], ["clicks", "Clicks", "0", false], ["conversions", "Conversions", "0", false], ["revenue", "Revenue from Ads", "0.00", false]].map(([name, label, placeholder, decimal]) => (
                  <div key={name as string}>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{label}</label>
                    <input name={name as string} type="number" step={decimal ? "0.01" : "1"} min="0" defaultValue="0" placeholder={placeholder as string} className={inputCss} style={inputStyle} />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                  <input name="notes" className={inputCss} style={inputStyle} placeholder="Any notes on this period…" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
              <button type="button" onClick={() => setLogModal(null)}
                className="px-4 py-2 rounded text-sm" style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
              <button type="submit" disabled={busy}
                className="px-5 py-2 rounded text-sm font-semibold"
                style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                {busy ? "Saving…" : "Log Results"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      <ConfirmDialog {...dialogProps} confirmLabel="Delete" />
    </div>
  );
}
