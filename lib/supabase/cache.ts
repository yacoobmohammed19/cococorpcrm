import { unstable_cache } from "next/cache";
import { createAdminClient } from "./admin";

// Cache key prefix for dimension tables — tagged per org so mutations can invalidate selectively
export function dimCacheTag(orgId: string) {
  return `dim-${orgId}`;
}
export function orgMetaCacheTag(orgId: string) {
  return `org-meta-${orgId}`;
}

const _getDimensions = unstable_cache(
  async (orgId: string) => {
    const admin = createAdminClient();
    const [customers, statuses, paymentTypes, costCategories, accounts] = await Promise.all([
      admin.from("dim_customers").select("id, name").eq("org_id", orgId).is("deleted_at", null).order("name"),
      admin.from("dim_statuses").select("id, name").eq("org_id", orgId).order("id"),
      admin.from("dim_payment_types").select("id, name").eq("org_id", orgId).order("name"),
      admin.from("dim_cost_categories").select("id, name").eq("org_id", orgId).order("name"),
      admin.from("dim_accounts").select("id, name").eq("org_id", orgId).order("name"),
    ]);
    return {
      customers: (customers.data || []) as { id: number; name: string }[],
      statuses: (statuses.data || []) as { id: number; name: string }[],
      paymentTypes: (paymentTypes.data || []) as { id: number; name: string }[],
      costCategories: (costCategories.data || []) as { id: number; name: string }[],
      accounts: (accounts.data || []) as { id: number; name: string }[],
    };
  },
  ["dim"],
  { revalidate: 300 }
);

export function getCachedDimensions(orgId: string) {
  return _getDimensions(orgId);
}

const _getOrgMeta = unstable_cache(
  async (orgId: string) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("organizations")
      .select("name, currency, fiscal_year_start")
      .eq("id", orgId)
      .single();
    return data as { name: string; currency: string; fiscal_year_start: number } | null;
  },
  ["org-meta"],
  { revalidate: 300 }
);

export function getCachedOrgMeta(orgId: string) {
  return _getOrgMeta(orgId);
}
