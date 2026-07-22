"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/components/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  computeCapex,
  amortisationSchedule,
  CAPEX_STATUS_LABEL,
  type CapexResult,
} from "@/lib/capex";
import { updateProjectCapex, updateDefaultHourlyRate } from "@/server-actions/reporting";

export type ReportProject = {
  id: number;
  name: string;
  status_name: string | null;
  status_color: string | null;
  priority: string;
  finalized_at: string | null;
  is_finalized: boolean;
  is_capex: boolean;
  amortisation_months: number | null;
  hourly_rate_override: number | null;
  hours: number;
  tag_ids: number[];
};
type Project = ReportProject;
type Tag = { id: number; name: string; color: string };

type Props = {
  projects: Project[];
  currency: string;
  defaultRate: number;
  asOf: string;
  tags?: Tag[];
};

function fmt(n: number) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmt2(n: number) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fhrs(n: number) {
  return n.toLocaleString("en-ZA", { maximumFractionDigits: 1 });
}
function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => { const s = v == null ? "" : String(v); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: filename });
  a.click(); URL.revokeObjectURL(a.href);
}

const CAPEX_STATUS_COLOR: Record<string, string> = {
  not_capex: "var(--muted2)",
  wip: "var(--accent)",
  no_period: "#f59e0b",
  amortising: "#a855f7",
  fully_amortised: "var(--muted2)",
};

export function ReportingClient({ projects, currency, defaultRate, asOf, tags = [] }: Props) {
  const cur = currency;
  const router = useRouter();
  const { success, error } = useToast();

  // Local, optimistic source of truth (persisted via server actions).
  const [rows, setRows] = useState<Project[]>(projects);
  const [rate, setRate] = useState<number>(defaultRate);
  const [rateInput, setRateInput] = useState<string>(String(defaultRate));
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<number>>(new Set());

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  // Compute capex result per row against the current (live) rate — all rows.
  const allComputed = useMemo(
    () =>
      rows.map((p) => ({
        p,
        c: computeCapex(
          {
            is_capex: p.is_capex,
            amortisation_months: p.amortisation_months,
            hourly_rate_override: p.hourly_rate_override,
            finalized_at: p.finalized_at,
          },
          p.hours,
          rate,
          asOf
        ),
      })),
    [rows, rate, asOf]
  );

  // Table/KPIs respect the tag filter (match any selected tag).
  const computed = useMemo(
    () =>
      tagFilter.size === 0
        ? allComputed
        : allComputed.filter(({ p }) => p.tag_ids.some((id) => tagFilter.has(id))),
    [allComputed, tagFilter]
  );

  // Per-tag rollup (over ALL rows). A project with N tags counts under each.
  const byTag = useMemo(() => {
    const map = new Map<number | "untagged", { hours: number; buildValue: number; nbv: number; count: number }>();
    const bump = (key: number | "untagged", c: CapexResult, hours: number) => {
      const e = map.get(key) || { hours: 0, buildValue: 0, nbv: 0, count: 0 };
      e.hours += hours; e.buildValue += c.buildValue; e.nbv += c.netBookValue; e.count += 1;
      map.set(key, e);
    };
    for (const { p, c } of allComputed) {
      if (p.tag_ids.length === 0) bump("untagged", c, p.hours);
      else p.tag_ids.forEach((id) => bump(id, c, p.hours));
    }
    return map;
  }, [allComputed]);

  const totals = useMemo(() => {
    let hours = 0, buildValue = 0, capitalised = 0, accumulated = 0, nbv = 0;
    for (const { p, c } of computed) {
      hours += p.hours;
      buildValue += c.buildValue;
      capitalised += c.capitalised;
      accumulated += c.accumulated;
      nbv += c.netBookValue;
    }
    return { hours, buildValue, capitalised, accumulated, nbv };
  }, [computed]);

  // ── Persistence helpers ──────────────────────────────────────────────────
  const patchRow = useCallback((id: number, patch: Partial<Project>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  async function saveRate() {
    const v = Number(rateInput);
    if (!Number.isFinite(v) || v < 0) {
      setRateInput(String(rate));
      error("Enter a valid rate");
      return;
    }
    if (v === rate) return;
    setRate(v);
    try {
      await updateDefaultHourlyRate(v);
      success(`Default rate set to ${cur} ${fmt(v)}/hr`);
      router.refresh();
    } catch (e) {
      error(e instanceof Error ? e.message : "Could not save rate");
    }
  }

  async function toggleCapex(p: Project) {
    const next = !p.is_capex;
    patchRow(p.id, { is_capex: next });
    try {
      await updateProjectCapex(p.id, { is_capex: next });
      success(next ? `"${p.name}" flagged as an asset` : `"${p.name}" removed from assets`);
      router.refresh();
    } catch (e) {
      patchRow(p.id, { is_capex: p.is_capex });
      error(e instanceof Error ? e.message : "Could not update");
    }
  }

  async function saveMonths(p: Project, raw: string) {
    const v = raw.trim() === "" ? null : Math.max(0, Math.floor(Number(raw)));
    const next = v && v > 0 ? v : null;
    if (next === p.amortisation_months) return;
    patchRow(p.id, { amortisation_months: next });
    try {
      await updateProjectCapex(p.id, { amortisation_months: next });
      router.refresh();
    } catch (e) {
      patchRow(p.id, { amortisation_months: p.amortisation_months });
      error(e instanceof Error ? e.message : "Could not update period");
    }
  }

  async function saveOverride(p: Project, raw: string) {
    const v = raw.trim() === "" ? null : Number(raw);
    const next = v != null && Number.isFinite(v) && v >= 0 ? v : null;
    if (next === p.hourly_rate_override) return;
    patchRow(p.id, { hourly_rate_override: next });
    try {
      await updateProjectCapex(p.id, { hourly_rate_override: next });
      router.refresh();
    } catch (e) {
      patchRow(p.id, { hourly_rate_override: p.hourly_rate_override });
      error(e instanceof Error ? e.message : "Could not update rate");
    }
  }

  function toggleExpand(id: number) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function exportCsv() {
    downloadCsv(
      `investments-${new Date().toISOString().slice(0, 10)}.csv`,
      computed.map(({ p, c }) => ({
        Project: p.name,
        Status: p.status_name || "",
        Hours: fhrs(p.hours),
        Rate: c.rate,
        "Build Value": Math.round(c.buildValue),
        Asset: p.is_capex ? "Yes" : "No",
        "Amortisation (months)": p.amortisation_months ?? "",
        Finalised: p.finalized_at ? p.finalized_at.slice(0, 10) : "",
        "Capex Status": CAPEX_STATUS_LABEL[c.status],
        "Monthly Charge": c.monthlyCharge ? Math.round(c.monthlyCharge) : "",
        "Accumulated Amortisation": Math.round(c.accumulated),
        "Net Book Value": p.is_capex ? Math.round(c.netBookValue) : "",
      }))
    );
  }

  const th = "px-3 py-2.5 font-semibold uppercase tracking-wider whitespace-nowrap";

  return (
    <div>
      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Kpi label="Total Hours" value={fhrs(totals.hours)} />
        <Kpi label="Build Value" value={`${cur} ${fmt(totals.buildValue)}`} color="var(--foreground)" />
        <Kpi label="Capitalised Assets" value={`${cur} ${fmt(totals.capitalised)}`} color="var(--accent)" />
        <Kpi label="Accum. Amortisation" value={`${cur} ${fmt(totals.accumulated)}`} color="var(--red-c)" />
        <Kpi label="Net Book Value" value={`${cur} ${fmt(totals.nbv)}`} color="var(--green-c)" />
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
            Default rate ({cur}/hr)
          </span>
          <input
            type="number"
            min={0}
            step={50}
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            onBlur={saveRate}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-24 px-2 py-1 rounded text-xs font-mono text-right outline-none"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        </div>
        <span className="text-xs" style={{ color: "var(--muted2)" }}>
          Toggle <strong>Asset?</strong> to capitalise a project; set months to amortise it.
        </span>
        <button
          onClick={exportCsv}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all hover:opacity-80 shrink-0"
          style={{ border: "1px solid var(--border)", color: "var(--muted)", background: "var(--card2)" }}>
          ↓ CSV
        </button>
      </div>

      {/* ── Tag filter ── */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: "var(--muted2)" }}>Filter:</span>
          {tags.map((t) => {
            const on = tagFilter.has(t.id);
            return (
              <button key={t.id}
                onClick={() => setTagFilter((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
                className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 transition-all"
                style={{ background: on ? t.color : "var(--card2)", color: on ? "#fff" : "var(--muted)", border: `1px solid ${on ? t.color : "var(--border)"}` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : t.color }} />
                {t.name}
              </button>
            );
          })}
          {tagFilter.size > 0 && (
            <button onClick={() => setTagFilter(new Set())} className="text-xs px-2 py-1 rounded" style={{ color: "var(--muted2)" }}>✕ Clear</button>
          )}
        </div>
      )}

      {/* ── Per-tag rollup ── */}
      {tags.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
              By tag <span className="font-normal normal-case ml-1">— a project with multiple tags counts under each</span>
            </h3>
          </div>
          <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "var(--card)", color: "var(--muted2)" }}>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Tag</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Projects</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Hours</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Build Value</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Net Book Value</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => {
                  const e = byTag.get(t.id);
                  if (!e) return null;
                  return (
                    <tr key={t.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5 font-medium"><span className="w-2 h-2 rounded-full" style={{ background: t.color }} />{t.name}</span></td>
                      <td className="px-3 py-2 text-right font-mono">{e.count}</td>
                      <td className="px-3 py-2 text-right font-mono">{fhrs(e.hours)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{cur} {fmt(e.buildValue)}</td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--green-c)" }}>{cur} {fmt(e.nbv)}</td>
                    </tr>
                  );
                })}
                {byTag.get("untagged") && (
                  <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2" style={{ color: "var(--muted2)" }}>Untagged</td>
                    <td className="px-3 py-2 text-right font-mono">{byTag.get("untagged")!.count}</td>
                    <td className="px-3 py-2 text-right font-mono">{fhrs(byTag.get("untagged")!.hours)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{cur} {fmt(byTag.get("untagged")!.buildValue)}</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--green-c)" }}>{cur} {fmt(byTag.get("untagged")!.nbv)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Mobile cards ── */}
      <div className="sm:hidden space-y-3">
        {computed.map(({ p, c }) => (
          <div key={p.id} className="rounded-2xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1 mr-3">
                <p className="font-semibold text-sm leading-tight">{p.name}</p>
                <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "var(--muted2)" }}>
                  {p.status_name && (
                    <>
                      <span className="w-2 h-2 rounded-full" style={{ background: p.status_color || "var(--muted2)" }} />
                      {p.status_name}
                    </>
                  )}
                  {p.is_finalized && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(34,197,94,.15)", color: "var(--green-c)" }}>finalised</span>}
                </p>
                {p.tag_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.tag_ids.map((id) => tagById.get(id)).filter((t): t is Tag => !!t).map((t) => (
                      <span key={t.id} className="inline-flex items-center gap-1 rounded-full text-[9px] font-semibold px-1.5 py-0.5" style={{ background: `${t.color}22`, color: t.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />{t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-lg font-bold font-mono shrink-0">{cur} {fmt(c.buildValue)}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs mb-3 mt-2" style={{ color: "var(--muted2)" }}>
              <span>⏱ {fhrs(p.hours)}h</span>
              <span>💰 {cur} {fmt(c.rate)}/hr</span>
              {p.is_capex && c.monthlyCharge > 0 && <span>📉 {cur} {fmt2(c.monthlyCharge)}/mo</span>}
              {p.is_capex && <span style={{ color: "var(--green-c)" }}>NBV {cur} {fmt(c.netBookValue)}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                <input type="checkbox" checked={p.is_capex} onChange={() => toggleCapex(p)} className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} />
                Asset?
              </label>
              <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted2)" }}>
                Amort (mo)
                <input
                  type="number" min={1} step={1} disabled={!p.is_capex}
                  defaultValue={p.amortisation_months ?? ""}
                  onBlur={(e) => saveMonths(p, e.target.value)}
                  className="w-16 px-1.5 py-1 rounded text-xs text-right font-mono disabled:opacity-40"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted2)" }}>
                Rate
                <input
                  type="number" min={0} step={50}
                  defaultValue={p.hourly_rate_override ?? ""}
                  placeholder={fmt(defaultRate)}
                  onBlur={(e) => saveOverride(p, e.target.value)}
                  className="w-20 px-1.5 py-1 rounded text-xs text-right font-mono"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </label>
            </div>
          </div>
        ))}
        {computed.length === 0 && (
          <EmptyState icon="🧱" title="No projects yet" description="Log time against projects in the R&D board and they'll appear here to value and capitalise." />
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)", color: "var(--muted2)" }}>
                <th className={th} style={{ width: 28 }} />
                <th className={`${th} text-left`}>Project</th>
                <th className={`${th} text-left`}>Status</th>
                <th className={`${th} text-left`}>Tags</th>
                <th className={`${th} text-right`}>Hours</th>
                <th className={`${th} text-right`}>Rate</th>
                <th className={`${th} text-right`}>Build Value</th>
                <th className={`${th} text-center`}>Asset?</th>
                <th className={`${th} text-right`}>Amort. (mo)</th>
                <th className={`${th} text-left`}>Capex Status</th>
                <th className={`${th} text-right`}>Monthly</th>
                <th className={`${th} text-right`}>Accum.</th>
                <th className={`${th} text-right`}>Net Book Value</th>
              </tr>
            </thead>
            <tbody>
              {computed.map(({ p, c }) => (
                <RowGroup
                  key={p.id}
                  p={p}
                  c={c}
                  tags={p.tag_ids.map((id) => tagById.get(id)).filter((t): t is Tag => !!t)}
                  isOpen={expanded.has(p.id)}
                  canSchedule={p.is_capex && (p.amortisation_months ?? 0) > 0 && c.capitalised > 0}
                  cur={cur}
                  defaultRate={defaultRate}
                  onToggleExpand={() => toggleExpand(p.id)}
                  onToggleCapex={() => toggleCapex(p)}
                  onSaveMonths={(v) => saveMonths(p, v)}
                  onSaveOverride={(v) => saveOverride(p, v)}
                />
              ))}
              {computed.length === 0 && (
                <tr><td colSpan={13}>
                  <EmptyState icon="🧱" title="No projects" description="No projects match this filter, or none have been created yet." />
                </td></tr>
              )}
            </tbody>
            {computed.length > 0 && (
              <tfoot>
                <tr className="border-t-2" style={{ borderColor: "var(--border2)", background: "var(--card)" }}>
                  <td />
                  <td className="px-3 py-2.5 font-bold" colSpan={3}>Total</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">{fhrs(totals.hours)}</td>
                  <td />
                  <td className="px-3 py-2.5 text-right font-mono font-bold">{cur} {fmt(totals.buildValue)}</td>
                  <td colSpan={4} />
                  <td className="px-3 py-2.5 text-right font-mono font-bold" style={{ color: "var(--red-c)" }}>{cur} {fmt(totals.accumulated)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold" style={{ color: "var(--green-c)" }}>{cur} {fmt(totals.nbv)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Explainer ── */}
      <div className="mt-4 rounded-lg px-4 py-3 text-xs leading-relaxed" style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted2)" }}>
        <p className="mb-1.5">
          <strong style={{ color: "var(--foreground)" }}>How this feeds your accounts.</strong>{" "}
          Projects flagged <em>Asset?</em> are capitalised (build value = hours × rate) and shown on the
          {" "}<strong>Balance Sheet → Intangible Assets (Capitalised Development)</strong> at their net book value.
        </p>
        <p>
          They are <strong>not</strong> posted to Costs, so your P&amp;L / Income Statement is unaffected.
          Once a project is finalised, its value amortises straight-line over the months you set.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{label}</div>
      <div className="text-xl font-bold font-mono" style={{ color: color || "var(--foreground)" }}>{value}</div>
    </div>
  );
}

// ── Single project row (+ optional schedule) ────────────────────────────────
function RowGroup({
  p, c, tags, isOpen, canSchedule, cur, defaultRate,
  onToggleExpand, onToggleCapex, onSaveMonths, onSaveOverride,
}: {
  p: Project;
  c: CapexResult;
  tags: Tag[];
  isOpen: boolean;
  canSchedule: boolean;
  cur: string;
  defaultRate: number;
  onToggleExpand: () => void;
  onToggleCapex: () => void;
  onSaveMonths: (v: string) => void;
  onSaveOverride: (v: string) => void;
}) {
  const [monthsInput, setMonthsInput] = useState<string>(
    p.amortisation_months != null ? String(p.amortisation_months) : ""
  );
  const [overrideInput, setOverrideInput] = useState<string>(
    p.hourly_rate_override != null ? String(p.hourly_rate_override) : ""
  );

  return (
    <>
      <tr className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
        <td className="px-1 py-2 text-center">
          {canSchedule && (
            <button onClick={onToggleExpand} className="p-1 rounded" title="Amortisation schedule" style={{ color: "var(--muted2)" }}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </td>
        <td className="px-3 py-2 font-medium">
          {p.name}
          {p.is_finalized && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,.15)", color: "var(--green-c)" }}>finalised</span>
          )}
        </td>
        <td className="px-3 py-2">
          {p.status_name ? (
            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: p.status_color || "var(--muted2)" }} />
              {p.status_name}
            </span>
          ) : <span style={{ color: "var(--muted2)" }}>—</span>}
        </td>
        <td className="px-3 py-2">
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {tags.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 whitespace-nowrap" style={{ background: `${t.color}22`, color: t.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />{t.name}
                </span>
              ))}
            </div>
          ) : <span style={{ color: "var(--muted2)" }}>—</span>}
        </td>
        <td className="px-3 py-2 text-right font-mono">{fhrs(p.hours)}</td>
        <td className="px-3 py-2 text-right">
          <input
            type="number" min={0} step={50}
            value={overrideInput}
            placeholder={fmt(defaultRate)}
            onChange={(e) => setOverrideInput(e.target.value)}
            onBlur={(e) => onSaveOverride(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            title={p.hourly_rate_override != null ? "Custom rate for this project" : "Using default rate"}
            className="w-20 px-1.5 py-1 rounded text-xs text-right font-mono outline-none"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: p.hourly_rate_override != null ? "var(--accent)" : "var(--muted)" }}
          />
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold">{cur} {fmt(c.buildValue)}</td>
        <td className="px-3 py-2 text-center">
          <button
            role="switch" aria-checked={p.is_capex} onClick={onToggleCapex}
            className="relative inline-flex items-center rounded-full transition-colors align-middle"
            style={{ width: 34, height: 18, background: p.is_capex ? "var(--accent)" : "var(--border)" }}
            title={p.is_capex ? "Capitalised as an asset" : "Not an asset"}>
            <span className="inline-block rounded-full bg-white transition-transform" style={{ width: 14, height: 14, transform: p.is_capex ? "translateX(18px)" : "translateX(2px)" }} />
          </button>
        </td>
        <td className="px-3 py-2 text-right">
          <input
            type="number" min={1} step={1} disabled={!p.is_capex}
            value={monthsInput} placeholder="—"
            onChange={(e) => setMonthsInput(e.target.value)}
            onBlur={(e) => onSaveMonths(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-16 px-1.5 py-1 rounded text-xs text-right font-mono outline-none disabled:opacity-40"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        </td>
        <td className="px-3 py-2" style={{ color: CAPEX_STATUS_COLOR[c.status] }}>{CAPEX_STATUS_LABEL[c.status]}</td>
        <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--muted)" }}>{c.monthlyCharge > 0 ? `${cur} ${fmt2(c.monthlyCharge)}` : "—"}</td>
        <td className="px-3 py-2 text-right font-mono" style={{ color: c.accumulated > 0 ? "var(--red-c)" : "var(--muted2)" }}>{c.accumulated > 0 ? `${cur} ${fmt(c.accumulated)}` : "—"}</td>
        <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: p.is_capex ? "var(--green-c)" : "var(--muted2)" }}>{p.is_capex ? `${cur} ${fmt(c.netBookValue)}` : "—"}</td>
      </tr>

      {isOpen && canSchedule && (
        <tr>
          <td colSpan={13} className="p-0" style={{ background: "var(--card)" }}>
            <ScheduleTable
              capitalised={c.capitalised}
              months={p.amortisation_months as number}
              elapsed={c.monthsElapsed}
              cur={cur}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ScheduleTable({ capitalised, months, elapsed, cur }: {
  capitalised: number; months: number; elapsed: number; cur: string;
}) {
  const schedule = useMemo(() => amortisationSchedule(capitalised, months), [capitalised, months]);
  return (
    <div className="px-6 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted2)" }}>
        Straight-line amortisation · {cur} {fmt2(capitalised / months)}/mo over {months} months
      </p>
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: "var(--card2)", color: "var(--muted2)" }}>
              <th className="px-3 py-2 text-left font-semibold">Month</th>
              <th className="px-3 py-2 text-right font-semibold">Charge</th>
              <th className="px-3 py-2 text-right font-semibold">Accumulated</th>
              <th className="px-3 py-2 text-right font-semibold">Book Value</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((r) => {
              const past = r.month <= elapsed;
              return (
                <tr key={r.month} style={{ borderTop: "1px solid var(--border)", opacity: past ? 1 : 0.55 }}>
                  <td className="px-3 py-1.5">
                    {r.month}
                    {r.month === elapsed && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--card2)", color: "var(--accent)" }}>now</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{cur} {fmt2(r.charge)}</td>
                  <td className="px-3 py-1.5 text-right font-mono" style={{ color: "var(--red-c)" }}>{cur} {fmt2(r.accumulated)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium" style={{ color: "var(--green-c)" }}>{cur} {fmt2(r.bookValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
