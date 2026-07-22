import { CATALOG, type StatementKey } from "./catalog";
import type { AutoFigures } from "./compute";

// A saved override / custom line from fact_afs_lines.
export type SavedAfsRow = {
  id: number;
  fin_year: number;
  statement: string;
  section: string;
  line_key: string | null;
  label: string;
  amount: number;
  is_custom: boolean;
  sort: number;
  note: string | null;
};

// The render model for a single statement line (standard or custom).
export type RenderLine = {
  id: number | null; // DB id when a saved row exists
  line_key: string | null;
  section: string;
  label: string;
  amount: number;
  is_custom: boolean;
  sort: number;
  note: string | null;
  auto: boolean; // this line has an auto-computed default
  overridden: boolean; // a saved row overrides the auto/default value
};

/**
 * Merge the static catalog, the auto-computed figures for a year, and any saved
 * rows into the render model for one statement. Saved rows override the standard
 * line's value/label; custom saved rows are appended.
 */
export function buildStatement(
  statement: StatementKey,
  autoFigures: AutoFigures | null | undefined,
  savedRows: SavedAfsRow[],
): RenderLine[] {
  const fig = autoFigures ?? null;
  const savedForStmt = savedRows.filter((r) => r.statement === statement);
  const savedByKey = new Map(savedForStmt.filter((r) => r.line_key).map((r) => [r.line_key as string, r]));

  const lines: RenderLine[] = [];

  for (const c of CATALOG) {
    if (c.statement !== statement) continue;
    const saved = savedByKey.get(c.line_key);
    const autoVal = c.auto && fig ? Number(fig[c.auto] ?? 0) : 0;
    lines.push({
      id: saved?.id ?? null,
      line_key: c.line_key,
      section: saved?.section ?? c.section,
      label: saved?.label ?? c.label,
      amount: saved ? Number(saved.amount) : autoVal,
      is_custom: false,
      sort: saved?.sort ?? 0,
      note: saved?.note ?? null,
      auto: !!c.auto,
      overridden: !!saved,
    });
  }

  // Custom (free-form) saved lines, in sort order.
  savedForStmt
    .filter((r) => r.is_custom || !r.line_key)
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .forEach((r) => {
      lines.push({
        id: r.id,
        line_key: null,
        section: r.section,
        label: r.label,
        amount: Number(r.amount),
        is_custom: true,
        sort: r.sort,
        note: r.note,
        auto: false,
        overridden: true,
      });
    });

  return lines;
}

export function linesInSection(lines: RenderLine[], section: string): RenderLine[] {
  return lines.filter((l) => l.section === section);
}

export function sectionTotal(lines: RenderLine[], section: string): number {
  return linesInSection(lines, section).reduce((s, l) => s + l.amount, 0);
}
