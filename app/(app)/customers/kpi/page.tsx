import { createServerClient } from "@/lib/supabase/server";
import { CustomerKpiClient } from "@/components/CustomerKpiClient";

export default async function CustomerKpiPage() {
  const supabase = await createServerClient();

  const [{ data: customers }, { data: invoices }, { data: costs }, { data: org }] = await Promise.all([
    supabase.from("dim_customers").select("id, name, status").is("deleted_at", null).order("name"),
    supabase
      .from("fact_invoices")
      .select("customer_id, amount, status, transaction_date")
      .is("deleted_at", null),
    supabase
      .from("fact_costs")
      .select("customer_id, amount")
      .is("deleted_at", null)
      .not("customer_id", "is", null),
    supabase.from("organizations").select("currency").single(),
  ]);

  // Build lookup maps
  const invByCustomer = new Map<number, { amount: number; status: string; date: string }[]>();
  for (const inv of invoices || []) {
    const cid = inv.customer_id as number;
    if (!invByCustomer.has(cid)) invByCustomer.set(cid, []);
    invByCustomer.get(cid)!.push({ amount: Number(inv.amount), status: inv.status, date: inv.transaction_date || "" });
  }

  const cacByCustomer = new Map<number, number>();
  for (const cost of costs || []) {
    const cid = cost.customer_id as number;
    cacByCustomer.set(cid, (cacByCustomer.get(cid) ?? 0) + Number(cost.amount));
  }

  const rows = (customers || []).map(c => {
    const cInvoices = invByCustomer.get(c.id) ?? [];
    const ltv = cInvoices.filter(i => i.status === "Completed").reduce((s, i) => s + i.amount, 0);
    const pendingAmount = cInvoices.filter(i => i.status === "Pending").reduce((s, i) => s + i.amount, 0);
    const invoiceCount = cInvoices.length;
    const totalInvoiced = cInvoices.reduce((s, i) => s + i.amount, 0);
    const aov = invoiceCount > 0 ? totalInvoiced / invoiceCount : 0;
    const cac = cacByCustomer.get(c.id) ?? 0;
    const netValue = ltv - cac;

    const dates = cInvoices.map(i => i.date).filter(Boolean).sort();
    const firstInvoice = dates[0] ?? null;
    const lastInvoice = dates[dates.length - 1] ?? null;
    let purchaseFreqDays: number | null = null;
    if (dates.length > 1) {
      const spanMs = new Date(lastInvoice!).getTime() - new Date(firstInvoice!).getTime();
      purchaseFreqDays = spanMs / (1000 * 60 * 60 * 24) / (dates.length - 1);
    }

    return {
      id: c.id,
      name: c.name,
      status: (c as Record<string, unknown>).status as string ?? "Active",
      ltv,
      cac,
      invoiceCount,
      aov,
      netValue,
      firstInvoice,
      lastInvoice,
      purchaseFreqDays,
      pendingAmount,
    };
  });

  return (
    <section>
      <CustomerKpiClient rows={rows} currency={org?.currency || "ZAR"} />
    </section>
  );
}
