/**
 * Capex / capitalised-development maths — pure, shared by the Reporting tab,
 * its client grid, and the Accounting Balance Sheet.
 *
 * Model (IAS 38, simplified):
 *   • Build value      = hours logged × effective hourly rate.
 *   • Capitalised      = build value, once the project is flagged as capex.
 *   • Amortisation     = straight-line over `amortisation_months`, starting when
 *                        the project is finalised (put into use). Assets still in
 *                        development ("WIP") sit at full value and don't amortise.
 *   • Net book value   = capitalised − accumulated amortisation.
 *
 * Nothing here touches fact_costs, so the P&L is never affected — this is a
 * balance-sheet-only view of the value invested in building products.
 */

export type CapexInput = {
  is_capex: boolean;
  amortisation_months: number | null;
  hourly_rate_override: number | null;
  finalized_at: string | null; // ISO timestamp or null
};

export type CapexStatus =
  | "not_capex" // not flagged as an asset
  | "wip" // capex, not yet finalised → not amortising
  | "no_period" // capex + finalised but no amortisation period set
  | "amortising" // capex, finalised, partway through its life
  | "fully_amortised"; // capex, life elapsed, NBV ≈ 0

export type CapexResult = {
  rate: number;
  buildValue: number;
  capitalised: number;
  monthlyCharge: number;
  monthsElapsed: number;
  accumulated: number;
  netBookValue: number;
  status: CapexStatus;
};

/** The rate that applies to a project — its override, else the org default. */
export function effectiveRate(p: Pick<CapexInput, "hourly_rate_override">, defaultRate: number): number {
  return p.hourly_rate_override != null ? Number(p.hourly_rate_override) : defaultRate;
}

/** Whole months elapsed between two ISO dates (0 if `to` precedes `from`). */
export function monthsElapsed(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Compute build value + amortisation for a single project.
 * @param asOfISO date (YYYY-MM-DD) to evaluate amortisation against.
 */
export function computeCapex(
  p: CapexInput,
  hours: number,
  defaultRate: number,
  asOfISO: string
): CapexResult {
  const rate = effectiveRate(p, defaultRate);
  const buildValue = Math.max(0, hours) * rate;
  const months = p.amortisation_months ?? 0;

  if (!p.is_capex) {
    return {
      rate, buildValue,
      capitalised: 0, monthlyCharge: 0, monthsElapsed: 0, accumulated: 0,
      netBookValue: 0, status: "not_capex",
    };
  }

  // Flagged asset but still in development → carried at full value, not amortising.
  if (!p.finalized_at) {
    return {
      rate, buildValue,
      capitalised: buildValue, monthlyCharge: 0, monthsElapsed: 0, accumulated: 0,
      netBookValue: buildValue, status: "wip",
    };
  }

  // Finalised but no useful life chosen yet.
  if (months <= 0) {
    return {
      rate, buildValue,
      capitalised: buildValue, monthlyCharge: 0, monthsElapsed: 0, accumulated: 0,
      netBookValue: buildValue, status: "no_period",
    };
  }

  const monthlyCharge = buildValue / months;
  const elapsed = Math.min(monthsElapsed(p.finalized_at, asOfISO), months);
  const accumulated = monthlyCharge * elapsed;
  const netBookValue = Math.max(0, buildValue - accumulated);

  return {
    rate, buildValue,
    capitalised: buildValue, monthlyCharge, monthsElapsed: elapsed, accumulated, netBookValue,
    status: elapsed >= months ? "fully_amortised" : "amortising",
  };
}

export type ScheduleRow = { month: number; charge: number; accumulated: number; bookValue: number };

/** Straight-line month-by-month amortisation schedule for a capitalised value. */
export function amortisationSchedule(capitalised: number, months: number): ScheduleRow[] {
  if (months <= 0 || capitalised <= 0) return [];
  const monthly = capitalised / months;
  const rows: ScheduleRow[] = [];
  for (let m = 1; m <= months; m++) {
    const accumulated = m === months ? capitalised : monthly * m; // snap final row to zero
    rows.push({
      month: m,
      charge: monthly,
      accumulated,
      bookValue: Math.max(0, capitalised - accumulated),
    });
  }
  return rows;
}

export const CAPEX_STATUS_LABEL: Record<CapexStatus, string> = {
  not_capex: "—",
  wip: "In development",
  no_period: "Set period",
  amortising: "Amortising",
  fully_amortised: "Fully amortised",
};
