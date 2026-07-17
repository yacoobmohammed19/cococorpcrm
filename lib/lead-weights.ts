// Per-lead-status pipeline weight (%). Stored on the org's feature_flags under
// `status_weights` (keyed by dim_statuses.id), so no schema change is needed.
// A lead's weight is driven by its status; `opportunity_weighted` is a generated
// column (opportunity_value * weight / 100), so updating `weight` is enough.

export type StatusWeights = Record<string, number>;

export function resolveStatusWeights(featureFlags: unknown): StatusWeights {
  const flags = (featureFlags && typeof featureFlags === "object")
    ? (featureFlags as Record<string, unknown>)
    : {};
  const raw = (flags.status_weights && typeof flags.status_weights === "object")
    ? (flags.status_weights as Record<string, unknown>)
    : {};
  const out: StatusWeights = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = Math.min(100, Math.max(0, Math.round(n)));
  }
  return out;
}

/** Weight (%) configured for a given status id, or 0 if none. */
export function weightForStatus(weights: StatusWeights, statusId: number | null | undefined): number {
  if (statusId == null) return 0;
  return weights[String(statusId)] ?? 0;
}
