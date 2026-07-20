"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Target, Package } from "lucide-react";

export type TimelineRow = {
  id: number;
  entity: "lead" | "product";
  entityId: number;
  action: string;
  record: string;
  author: string;
  createdAt: string;
  changes: { label: string; from: string; to: string }[];
};

type Filter = "all" | "lead" | "product";

function fday(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
}
function ftime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

const actionStyle = (action: string): { label: string; color: string; bg: string } => {
  const a = action.toLowerCase();
  if (a === "insert") return { label: "Created", color: "var(--accent)", bg: "rgba(236,72,153,.14)" };
  if (a === "delete") return { label: "Deleted", color: "var(--red-c)", bg: "rgba(239,68,68,.14)" };
  return { label: "Updated", color: "var(--amber-c)", bg: "rgba(245,158,11,.14)" };
};

export function TimelineClient({ rows }: { rows: TimelineRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () => rows.filter(r => filter === "all" || r.entity === filter),
    [rows, filter],
  );

  // Group by calendar day, preserving the newest-first order from the server.
  const groups = useMemo(() => {
    const map = new Map<string, TimelineRow[]>();
    for (const r of filtered) {
      const key = fday(r.createdAt);
      const arr = map.get(key);
      if (arr) arr.push(r); else map.set(key, [r]);
    }
    return [...map.entries()];
  }, [filtered]);

  const chip = (key: Filter, label: string) => {
    const active = filter === key;
    return (
      <button onClick={() => setFilter(key)}
        className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
        style={{ background: active ? "var(--accent)" : "var(--card2)", color: active ? "#fff" : "var(--muted2)", border: "1px solid var(--border)" }}>
        {label}
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          {chip("all", "All")}
          {chip("lead", "Leads")}
          {chip("product", "Products")}
        </div>
        <span className="text-xs" style={{ color: "var(--muted2)" }}>
          {filtered.length} event{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm"
          style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted2)" }}>
          No timeline events yet. Create or update a lead or product and it will appear here, timestamped.
        </div>
      ) : (
        groups.map(([day, dayRows]) => (
          <div key={day} className="mb-6">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: "var(--muted2)" }}>{day}</h3>
            <div className="pl-5 space-y-3" style={{ borderLeft: "2px solid var(--border)", marginLeft: "0.35rem" }}>
              {dayRows.map(r => {
                const st = actionStyle(r.action);
                const Icon = r.entity === "lead" ? Target : Package;
                const href = r.entity === "lead" ? `/leads/${r.entityId}` : "/products";
                return (
                  <div key={r.id} className="relative rounded-xl p-4"
                    style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                    <span className="absolute rounded-full"
                      style={{ left: "-1.65rem", top: "1.25rem", width: "0.7rem", height: "0.7rem", background: st.color, boxShadow: "0 0 0 3px var(--bg)" }} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                        style={{ background: "var(--card3)", color: "var(--muted)" }}>
                        <Icon size={11} />{r.entity === "lead" ? "Lead" : "Product"}
                      </span>
                      <Link href={href} className="font-semibold text-sm hover:underline">{r.record}</Link>
                      <span className="ml-auto text-[11px]" style={{ color: "var(--muted2)" }}>
                        @{r.author} · {ftime(r.createdAt)}
                      </span>
                    </div>
                    {r.changes.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs" style={{ color: "var(--muted2)" }}>
                        {r.changes.map((c, i) => (
                          <li key={i}>
                            <span className="font-medium" style={{ color: "var(--foreground)" }}>{c.label}</span>: {c.from} → <span style={{ color: "var(--foreground)" }}>{c.to}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
