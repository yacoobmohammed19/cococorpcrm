import { createServerClient } from "@/lib/supabase/server";
import { CustomersClient } from "@/components/CustomersClient";

export default async function CustomersPage() {
  const supabase = await createServerClient();
  const { data: customers } = await supabase
    .from("dim_customers")
    .select("id, name, email, phone, contact_person, source, notes, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <section>
      <CustomersClient customers={customers || []} />
    </section>
  );
}
