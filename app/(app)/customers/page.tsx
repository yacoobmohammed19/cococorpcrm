import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { CustomersClient } from "@/components/CustomersClient";

export default async function CustomersPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();
  const { data: customers } = await supabase
    .from("dim_customers")
    .select("id, name, email, phone, contact_person, source, notes, status, payment_method, reg_no, vat_no, created_at")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <section>
      <CustomersClient customers={customers || []} />
    </section>
  );
}
