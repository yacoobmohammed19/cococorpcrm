// Lead "activity progress" stages. The four keys are fixed (they map to boolean
// columns on fact_leads); each org can configure the display label and the
// default pipeline weight (%) applied when a lead reaches that stage.

export type LeadStageKey = "contacted" | "responded" | "developed" | "completed";

export type LeadStage = { key: LeadStageKey; label: string; weight: number };

export const LEAD_STAGE_KEYS: readonly LeadStageKey[] = [
  "contacted", "responded", "developed", "completed",
];

export const DEFAULT_LEAD_STAGES: LeadStage[] = [
  { key: "contacted", label: "Called",    weight: 10 },
  { key: "responded", label: "Responded", weight: 20 },
  { key: "developed", label: "Developed", weight: 50 },
  { key: "completed", label: "Closed",    weight: 99 },
];

function clampWeight(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Resolve the org's configured lead stages from `organizations.feature_flags`
 * (key `lead_stages`), falling back to defaults for any missing/invalid entry.
 * Always returns all four stages in canonical order.
 */
export function resolveLeadStages(featureFlags: unknown): LeadStage[] {
  const flags = (featureFlags && typeof featureFlags === "object")
    ? (featureFlags as Record<string, unknown>)
    : {};
  const cfg = (flags.lead_stages && typeof flags.lead_stages === "object")
    ? (flags.lead_stages as Record<string, { label?: unknown; weight?: unknown }>)
    : {};

  return DEFAULT_LEAD_STAGES.map((def) => {
    const entry = cfg[def.key];
    const rawLabel = typeof entry?.label === "string" ? entry.label.trim() : "";
    return {
      key: def.key,
      label: rawLabel || def.label,
      weight: clampWeight(entry?.weight, def.weight),
    };
  });
}

/** The default weight for the furthest-reached stage, given the stage booleans. */
export function defaultWeightForStages(
  reached: Record<LeadStageKey, boolean>,
  stages: LeadStage[],
): number {
  for (let i = stages.length - 1; i >= 0; i--) {
    if (reached[stages[i].key]) return stages[i].weight;
  }
  return 0;
}
