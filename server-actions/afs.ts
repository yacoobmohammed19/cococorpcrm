"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { AfsLineSchema } from "@/lib/schemas/afs";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";
import { orgMetaCacheTag } from "@/lib/supabase/cache";

/**
 * Replace all saved lines for one (org, financial year, statement). The client
 * sends only the lines it has touched — standard overrides and custom lines —
 * so untouched standard lines keep reflecting the live auto figures. We hard-
 * delete the scope first (the unique constraint on line_key forbids leaving
 * soft-deleted duplicates behind) and then bulk-insert the current set.
 */
export async function saveAfsStatement(finYear: number, statement: string, linesJson: string) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const raw = JSON.parse(linesJson) as unknown[];
  const rows = raw.map((item, index) => {
    const parsed = AfsLineSchema.parse({ ...(item as object), fin_year: finYear, statement });
    return {
      org_id: orgId,
      fin_year: parsed.fin_year,
      statement: parsed.statement,
      section: parsed.section,
      line_key: parsed.is_custom ? null : parsed.line_key ?? null,
      label: parsed.label,
      amount: parsed.amount,
      is_custom: parsed.is_custom,
      sort: parsed.is_custom ? index : parsed.sort,
      note: parsed.note ?? null,
    };
  });

  const del = await supabase
    .from("fact_afs_lines")
    .delete()
    .eq("org_id", orgId)
    .eq("fin_year", finYear)
    .eq("statement", statement);
  if (del.error) throw new Error(del.error.message);

  if (rows.length > 0) {
    const { error } = await supabase.from("fact_afs_lines").insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/accounting");
  return { ok: true };
}

/** Per-org default income-tax rate (%), stored on organizations.feature_flags. */
export async function setTaxRate(rate: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { data: org } = await supabase.from("organizations").select("feature_flags").eq("id", orgId).single();
  const existing = (org?.feature_flags as Record<string, unknown>) ?? {};
  const { error } = await supabase
    .from("organizations")
    .update({ feature_flags: { ...existing, tax_rate: rate } })
    .eq("id", orgId);
  if (error) throw new Error(error.message);

  revalidateTag(orgMetaCacheTag(orgId), "default");
  revalidatePath("/accounting");
  return { ok: true };
}
