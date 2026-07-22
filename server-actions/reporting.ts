"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

/** Toggle capex flag / set amortisation life / set a per-project rate override. */
export async function updateProjectCapex(
  id: number,
  data: {
    is_capex?: boolean;
    amortisation_months?: number | null;
    hourly_rate_override?: number | null;
  }
) {
  const patch: Record<string, unknown> = {};
  if (data.is_capex !== undefined) patch.is_capex = data.is_capex;
  if (data.amortisation_months !== undefined) {
    patch.amortisation_months =
      data.amortisation_months && data.amortisation_months > 0 ? data.amortisation_months : null;
  }
  if (data.hourly_rate_override !== undefined) {
    patch.hourly_rate_override =
      data.hourly_rate_override != null && data.hourly_rate_override >= 0
        ? data.hourly_rate_override
        : null;
  }
  if (Object.keys(patch).length === 0) return;

  const supabase = await createServerClient();
  const { error } = await supabase.from("rd_projects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/rd");
  revalidatePath("/accounting");
}

/** Set the org-wide default hourly rate used when a project has no override. */
export async function updateDefaultHourlyRate(rate: number) {
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Rate must be a non-negative number");
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({ default_hourly_rate: rate })
    .eq("id", orgId);
  if (error) throw new Error(error.message);

  revalidatePath("/rd");
  revalidatePath("/accounting");
}
