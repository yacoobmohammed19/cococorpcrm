import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";

const ALLOWED_WRITE_TOOLS = new Set([
  "create_customer", "update_customer",
  "create_invoice", "update_invoice_status",
  "create_lead",
  "log_activity",
  "create_cost", "record_cashflow",
]);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getCurrentOrgId();
    const { tool, args } = (await req.json()) as { tool: string; args: Record<string, unknown> };

    if (!ALLOWED_WRITE_TOOLS.has(tool)) {
      return NextResponse.json({ error: "Tool not allowed" }, { status: 400 });
    }

    const result = await executeWrite(tool, args, supabase, orgId);
    return NextResponse.json({ success: true, result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

async function executeWrite(
  tool: string,
  args: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string | number
): Promise<unknown> {
  switch (tool) {
    case "create_customer": {
      const { data, error } = await supabase
        .from("dim_customers")
        .insert({ ...args, org_id: orgId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { customer: data };
    }

    case "update_customer": {
      const { customer_id, ...fields } = args;
      const { data, error } = await supabase
        .from("dim_customers")
        .update(fields)
        .eq("id", customer_id as number)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { customer: data };
    }

    case "create_invoice": {
      const { data, error } = await supabase
        .from("fact_invoices")
        .insert({
          customer_id: args.customer_id,
          amount: args.amount,
          description: args.description || null,
          invoice_number: args.invoice_number || null,
          due_date: args.due_date || null,
          status: args.status || "Pending",
          transaction_date: args.transaction_date || new Date().toISOString().slice(0, 10),
          org_id: orgId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { invoice: data };
    }

    case "update_invoice_status": {
      const { error } = await supabase
        .from("fact_invoices")
        .update({ status: args.status })
        .eq("id", args.invoice_id as number);
      if (error) throw new Error(error.message);
      return { updated: true };
    }

    case "create_lead": {
      const { data: defaultStatus } = await supabase.from("dim_statuses").select("id").limit(1).single();
      const { data, error } = await supabase
        .from("fact_leads")
        .insert({
          name: args.name,
          email: args.email || null,
          phone: args.phone || null,
          opportunity_value: args.estimated_value || null,
          source: args.source || null,
          notes: args.notes || null,
          status_id: defaultStatus?.id,
          org_id: orgId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { lead: data };
    }

    case "log_activity": {
      const { data, error } = await supabase
        .from("fact_activities")
        .insert({
          customer_id: args.customer_id,
          type: args.type,
          subject: args.subject,
          notes: args.notes || null,
          due_date: args.due_date || null,
          done: false,
          org_id: orgId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { activity: data };
    }

    case "create_cost": {
      const { data, error } = await supabase
        .from("fact_costs")
        .insert({
          amount: args.amount,
          transaction_date: args.transaction_date,
          cost_details: args.cost_details || null,
          cost_category_id: args.cost_category_id || null,
          account_id: args.account_id || null,
          cost_type: "operational",
          include_in_pnl: true,
          org_id: orgId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { cost: data };
    }

    case "record_cashflow": {
      const { data, error } = await supabase
        .from("fact_cashflow")
        .insert({
          balance: args.balance,
          record_date: args.record_date,
          account_id: args.account_id,
          notes: args.notes || null,
          org_id: orgId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { cashflow: data };
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
