import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CustomerDetailClient } from "@/components/CustomerDetailClient";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  const supabase = await createServerClient();

  const [{ data: customer }, { data: invoices }, { data: org }, { data: paymentTypes }, { data: products }] = await Promise.all([
    supabase.from("dim_customers").select("*").eq("id", customerId).single(),
    supabase.from("fact_invoices")
      .select("id, invoice_number, amount, status, transaction_date, due_date, description, payment_type_id, dim_payment_types(name)")
      .eq("customer_id", customerId).is("deleted_at", null)
      .order("transaction_date", { ascending: false }),
    supabase.from("organizations").select("currency").single(),
    supabase.from("dim_payment_types").select("id, name").order("name"),
    supabase.from("dim_products").select("id, name, unit_price, sku, is_active").is("deleted_at", null).order("name"),
  ]);

  // Derive products purchased from invoice lines (graceful — column may not exist yet)
  let productsPurchased: { id: number; name: string; times: number; revenue: number }[] = [];
  try {
    const invoiceIds = (invoices || []).map(i => i.id);
    if (invoiceIds.length > 0) {
      const { data: lines } = await supabase
        .from("fact_invoice_lines")
        .select("product_id, unit_price, quantity, dim_products(id, name)")
        .in("invoice_id", invoiceIds)
        .not("product_id", "is", null);
      if (lines) {
        const map: Record<number, { id: number; name: string; times: number; revenue: number }> = {};
        lines.forEach((l: Record<string, unknown>) => {
          const prod = l.dim_products as { id: number; name: string } | null;
          if (!prod) return;
          if (!map[prod.id]) map[prod.id] = { id: prod.id, name: prod.name, times: 0, revenue: 0 };
          map[prod.id].times += 1;
          map[prod.id].revenue += Number(l.unit_price || 0) * Number(l.quantity || 1);
        });
        productsPurchased = Object.values(map).sort((a, b) => b.revenue - a.revenue);
      }
    }
  } catch { /* invoice_lines product_id column may not exist yet */ }

  if (!customer) notFound();

  // Contacts and activities — gracefully handle missing tables
  let contacts: { id: number; name: string; email: string | null; phone: string | null; role: string | null; is_primary: boolean }[] = [];
  let activities: { id: number; type: string; subject: string; notes: string | null; due_date: string | null; done: boolean; created_at: string }[] = [];
  try {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("dim_contacts").select("id, name, email, phone, role, is_primary")
        .eq("customer_id", customerId).is("deleted_at", null).order("is_primary", { ascending: false }),
      supabase.from("fact_activities").select("id, type, subject, notes, due_date, done, created_at")
        .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(20),
    ]);
    contacts = c || [];
    activities = a || [];
  } catch { /* tables may not exist yet */ }

  const currency = org?.currency || "ZAR";
  const cur = currency === "ZAR" ? "R" : "$";
  const allInvoices = invoices || [];
  const collected = allInvoices.filter(i => i.status === "Completed").reduce((s, i) => s + Number(i.amount), 0);
  const pending = allInvoices.filter(i => i.status === "Pending").reduce((s, i) => s + Number(i.amount), 0);
  const fmt = (n: number) => n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <section className="space-y-6 max-w-4xl">
      <Breadcrumb crumbs={[{ label: "Customers", href: "/customers" }, { label: customer.name }]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          {customer.source && <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: "rgba(16,185,129,.12)", color: "var(--accent)" }}>{customer.source}</span>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Total Invoiced", allInvoices.reduce((s, i) => s + Number(i.amount), 0), "var(--purple-c)"],
          ["Collected", collected, "var(--accent)"],
          ["Outstanding", pending, "var(--amber-c)"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-lg p-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
            <div className="text-xl font-bold font-mono" style={{ color: c as string }}>{cur} {fmt(v as number)}</div>
          </div>
        ))}
      </div>

      <CustomerDetailClient
        customer={customer}
        invoices={allInvoices.map(i => ({
          ...i,
          amount: Number(i.amount),
          description: (i as Record<string, unknown>).description as string | null ?? null,
          payment_type_name: (i.dim_payment_types as unknown as { name: string } | null)?.name ?? null,
        }))}
        contacts={contacts}
        activities={activities}
        currency={cur}
        customerId={customerId}
        productsPurchased={productsPurchased}
      />
    </section>
  );
}
