import { GoogleGenerativeAI, SchemaType, Tool, Part } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import type { SupabaseClient } from "@supabase/supabase-js";

const S = SchemaType;

// Write tools require user confirmation before executing.
const WRITE_TOOLS = new Set([
  "create_customer", "update_customer",
  "create_invoice", "update_invoice_status",
  "create_lead",
  "log_activity",
  "create_cost", "record_cashflow",
]);

const TOOL_LABELS: Record<string, string> = {
  create_customer: "Create Customer",
  update_customer: "Update Customer",
  create_invoice: "Create Invoice",
  update_invoice_status: "Update Invoice Status",
  create_lead: "Create Lead",
  log_activity: "Log Activity",
  create_cost: "Record Cost",
  record_cashflow: "Record Bank Balance",
};

const BASE_SYSTEM_PROMPT = `You are Coco, a smart AI assistant built into CocoCRM. You help users manage their business through natural conversation.

You can:
- Search and manage customers, invoices, leads, and costs
- Create and update invoices, leads, customers, and costs
- Log activities (calls, emails, meetings)
- Show stats, financial summaries, and business insights
- Perform dynamic calculations on business data

Guidelines:
- Be concise and friendly.
- When creating or updating records, collect information conversationally. Ask for missing fields one or two at a time.
- Before calling any write function, summarise what you are about to save in one clear sentence (e.g. "Creating invoice INV-045 for Acme Corp — R 5,000, due 2026-06-30."). The user will see a confirmation card and must approve before the record is saved.
- Format amounts as currency (e.g. R 5,000).
- If you need a customer ID but only have a name, use search_customers first.
- Use get_financial_summary for detailed financial questions.
- Use list_costs to answer questions about expenses.
- Use list_leads to answer questions about the sales pipeline.`;

const crmTools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "search_customers",
        description: "Search customers by name. Use this to find customer IDs before creating invoices.",
        parameters: {
          type: S.OBJECT,
          properties: {
            query: { type: S.STRING, description: "Customer name to search for" },
          },
          required: ["query"],
        },
      },
      {
        name: "get_customer_details",
        description: "Get full details for a customer including their recent invoices and balance",
        parameters: {
          type: S.OBJECT,
          properties: {
            customer_id: { type: S.NUMBER, description: "The customer numeric ID" },
          },
          required: ["customer_id"],
        },
      },
      {
        name: "create_customer",
        description: "Create a new customer/company record",
        parameters: {
          type: S.OBJECT,
          properties: {
            name: { type: S.STRING, description: "Customer or company name" },
            email: { type: S.STRING },
            phone: { type: S.STRING },
            contact_person: { type: S.STRING, description: "Primary contact person" },
            source: { type: S.STRING, description: "One of: Referral, Website, Cold Call, Social Media, Event, Other" },
          },
          required: ["name"],
        },
      },
      {
        name: "update_customer",
        description: "Update an existing customer's details",
        parameters: {
          type: S.OBJECT,
          properties: {
            customer_id: { type: S.NUMBER },
            name: { type: S.STRING },
            email: { type: S.STRING },
            phone: { type: S.STRING },
            contact_person: { type: S.STRING },
            notes: { type: S.STRING },
          },
          required: ["customer_id"],
        },
      },
      {
        name: "list_invoices",
        description: "List recent invoices, optionally filtered by status or customer",
        parameters: {
          type: S.OBJECT,
          properties: {
            status: { type: S.STRING, description: "Pending, Completed, or Written Off" },
            customer_id: { type: S.NUMBER },
            limit: { type: S.NUMBER, description: "Max results (default 10)" },
          },
        },
      },
      {
        name: "create_invoice",
        description: "Create a new invoice for a customer",
        parameters: {
          type: S.OBJECT,
          properties: {
            customer_id: { type: S.NUMBER },
            amount: { type: S.NUMBER, description: "Invoice total amount" },
            description: { type: S.STRING },
            invoice_number: { type: S.STRING, description: "e.g. INV-001" },
            due_date: { type: S.STRING, description: "YYYY-MM-DD format" },
            status: { type: S.STRING, description: "Pending (default) or Completed" },
          },
          required: ["customer_id", "amount"],
        },
      },
      {
        name: "update_invoice_status",
        description: "Change the status of an invoice",
        parameters: {
          type: S.OBJECT,
          properties: {
            invoice_id: { type: S.NUMBER },
            status: { type: S.STRING, description: "Pending, Completed, or Written Off" },
          },
          required: ["invoice_id", "status"],
        },
      },
      {
        name: "get_dashboard_stats",
        description: "Get overall CRM stats: customers, revenue, pending invoices, leads",
        parameters: {
          type: S.OBJECT,
          properties: {},
        },
      },
      {
        name: "create_lead",
        description: "Create a new sales lead / prospect",
        parameters: {
          type: S.OBJECT,
          properties: {
            name: { type: S.STRING, description: "Lead name or company" },
            email: { type: S.STRING },
            phone: { type: S.STRING },
            estimated_value: { type: S.NUMBER },
            source: { type: S.STRING },
            notes: { type: S.STRING },
          },
          required: ["name"],
        },
      },
      {
        name: "log_activity",
        description: "Log a CRM activity for a customer (call, email, meeting, etc.)",
        parameters: {
          type: S.OBJECT,
          properties: {
            customer_id: { type: S.NUMBER },
            type: { type: S.STRING, description: "Call, Email, Meeting, Task, or Note" },
            subject: { type: S.STRING },
            notes: { type: S.STRING },
            due_date: { type: S.STRING, description: "YYYY-MM-DD" },
          },
          required: ["customer_id", "type", "subject"],
        },
      },
      {
        name: "list_costs",
        description: "List recent costs/expenses, optionally filtered by category",
        parameters: {
          type: S.OBJECT,
          properties: {
            limit: { type: S.NUMBER, description: "Max results (default 20)" },
            category_id: { type: S.NUMBER, description: "Filter by cost category ID" },
          },
        },
      },
      {
        name: "list_leads",
        description: "List sales leads/prospects with their pipeline status and opportunity values",
        parameters: {
          type: S.OBJECT,
          properties: {
            status_id: { type: S.NUMBER, description: "Filter by status ID" },
            limit: { type: S.NUMBER, description: "Max results (default 20)" },
          },
        },
      },
      {
        name: "get_financial_summary",
        description: "Get a detailed financial summary: revenue by month, costs by category, profit margins, and bank balance. Use this for financial analysis questions.",
        parameters: {
          type: S.OBJECT,
          properties: {
            period_months: { type: S.NUMBER, description: "Number of months to look back (default 12)" },
          },
        },
      },
      {
        name: "create_cost",
        description: "Record a new business expense / cost",
        parameters: {
          type: S.OBJECT,
          properties: {
            amount: { type: S.NUMBER, description: "Cost amount" },
            transaction_date: { type: S.STRING, description: "YYYY-MM-DD" },
            cost_details: { type: S.STRING, description: "Description of the cost" },
            cost_category_id: { type: S.NUMBER, description: "Cost category ID (optional)" },
            account_id: { type: S.NUMBER, description: "Bank account ID (optional)" },
          },
          required: ["amount", "transaction_date"],
        },
      },
      {
        name: "record_cashflow",
        description: "Record an actual bank balance snapshot for an account",
        parameters: {
          type: S.OBJECT,
          properties: {
            balance: { type: S.NUMBER, description: "Actual bank balance amount" },
            record_date: { type: S.STRING, description: "YYYY-MM-DD" },
            account_id: { type: S.NUMBER, description: "Bank account ID" },
            notes: { type: S.STRING },
          },
          required: ["balance", "record_date", "account_id"],
        },
      },
    ],
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  orgId: string | number
): Promise<unknown> {
  switch (name) {
    case "search_customers": {
      const { data } = await supabase
        .from("dim_customers")
        .select("id, name, email, phone, contact_person")
        .ilike("name", `%${args.query}%`)
        .is("deleted_at", null)
        .limit(8);
      return data || [];
    }

    case "get_customer_details": {
      const [{ data: customer }, { data: invoices }] = await Promise.all([
        supabase.from("dim_customers").select("*").eq("id", args.customer_id).single(),
        supabase
          .from("fact_invoices")
          .select("id, invoice_number, amount, status, transaction_date, due_date")
          .eq("customer_id", args.customer_id as number)
          .is("deleted_at", null)
          .order("transaction_date", { ascending: false })
          .limit(10),
      ]);
      const invList = invoices || [];
      return {
        customer,
        recentInvoices: invList,
        totalInvoiced: invList.reduce((s, i) => s + Number(i.amount), 0),
        outstanding: invList.filter(i => i.status === "Pending").reduce((s, i) => s + Number(i.amount), 0),
      };
    }

    case "create_customer": {
      const { data, error } = await supabase
        .from("dim_customers")
        .insert({ ...args, org_id: orgId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { success: true, customer: data };
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
      return { success: true, customer: data };
    }

    case "list_invoices": {
      let query = supabase
        .from("fact_invoices")
        .select("id, invoice_number, amount, status, transaction_date, due_date, customer_id, dim_customers(name)")
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .limit(Number(args.limit) || 10);
      if (args.status) query = query.eq("status", args.status as string);
      if (args.customer_id) query = query.eq("customer_id", args.customer_id as number);
      const { data } = await query;
      return data || [];
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
          transaction_date: new Date().toISOString().slice(0, 10),
          org_id: orgId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { success: true, invoice: data };
    }

    case "update_invoice_status": {
      const { error } = await supabase
        .from("fact_invoices")
        .update({ status: args.status })
        .eq("id", args.invoice_id as number);
      if (error) throw new Error(error.message);
      return { success: true };
    }

    case "get_dashboard_stats": {
      const [{ data: customers }, { data: invoices }, { data: leads }] = await Promise.all([
        supabase.from("dim_customers").select("id").is("deleted_at", null),
        supabase.from("fact_invoices").select("amount, status").is("deleted_at", null),
        supabase.from("fact_leads").select("id").is("deleted_at", null),
      ]);
      const invList = invoices || [];
      return {
        totalCustomers: (customers || []).length,
        totalLeads: (leads || []).length,
        totalRevenue: invList.filter(i => i.status === "Completed").reduce((s, i) => s + Number(i.amount), 0),
        pendingAmount: invList.filter(i => i.status === "Pending").reduce((s, i) => s + Number(i.amount), 0),
        totalInvoices: invList.length,
      };
    }

    case "create_lead": {
      const { data: defaultStatus } = await supabase.from("dim_statuses").select("id").limit(1).single();
      const { data, error } = await supabase
        .from("fact_leads")
        .insert({
          name: args.name,
          email: args.email || null,
          phone: args.phone || null,
          estimated_value: args.estimated_value || null,
          source: args.source || null,
          notes: args.notes || null,
          status_id: defaultStatus?.id,
          org_id: orgId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { success: true, lead: data };
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
      return { success: true, activity: data };
    }

    case "list_costs": {
      let query = supabase
        .from("fact_costs")
        .select("id, amount, transaction_date, cost_details, dim_cost_categories(name)")
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .limit(Number(args.limit) || 20);
      if (args.category_id) query = query.eq("cost_category_id", args.category_id as number);
      const { data } = await query;
      const items = (data || []).map(c => ({
        id: c.id,
        amount: Number(c.amount),
        date: c.transaction_date,
        details: c.cost_details,
        category: (c.dim_cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised",
      }));
      const total = items.reduce((s, c) => s + c.amount, 0);
      return { costs: items, totalAmount: total };
    }

    case "list_leads": {
      let query = supabase
        .from("fact_leads")
        .select("id, name, email, phone, opportunity_value, opportunity_weighted, last_follow_up, dim_statuses(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(Number(args.limit) || 20);
      if (args.status_id) query = query.eq("status_id", args.status_id as number);
      const { data } = await query;
      return (data || []).map(l => ({
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        opportunityValue: Number(l.opportunity_value || 0),
        weightedValue: Number(l.opportunity_weighted || 0),
        lastFollowUp: l.last_follow_up,
        status: (l.dim_statuses as unknown as { name: string } | null)?.name ?? "Unknown",
      }));
    }

    case "get_financial_summary": {
      const months = Number(args.period_months) || 12;
      const since = new Date();
      since.setMonth(since.getMonth() - months);
      const sinceStr = since.toISOString().slice(0, 10);

      const [{ data: invData }, { data: costData }, { data: cfData }, { data: catData }] = await Promise.all([
        supabase.from("fact_invoices").select("amount, status, transaction_date").is("deleted_at", null).gte("transaction_date", sinceStr),
        supabase.from("fact_costs").select("amount, transaction_date, cost_category_id").is("deleted_at", null).gte("transaction_date", sinceStr),
        supabase.from("fact_cashflow").select("balance, record_date").order("record_date", { ascending: false }).limit(1),
        supabase.from("dim_cost_categories").select("id, name"),
      ]);

      const inv = invData || [];
      const catMap: Record<number, string> = Object.fromEntries((catData || []).map(c => [c.id, c.name]));
      const revenue = inv.filter(i => i.status === "Completed" || i.status === "Paid").reduce((s, i) => s + Number(i.amount), 0);
      const pending = inv.filter(i => i.status === "Pending").reduce((s, i) => s + Number(i.amount), 0);
      const costs = (costData || []).reduce((s, c) => s + Number(c.amount), 0);
      const byMonth: Record<string, { revenue: number; costs: number }> = {};
      inv.filter(i => i.status === "Completed" || i.status === "Paid").forEach(i => {
        const m = (i.transaction_date as string).slice(0, 7);
        if (!byMonth[m]) byMonth[m] = { revenue: 0, costs: 0 };
        byMonth[m].revenue += Number(i.amount);
      });
      (costData || []).forEach(c => {
        const m = (c.transaction_date as string).slice(0, 7);
        if (!byMonth[m]) byMonth[m] = { revenue: 0, costs: 0 };
        byMonth[m].costs += Number(c.amount);
      });
      const byCat: Record<string, number> = {};
      (costData || []).forEach(c => {
        const cat = c.cost_category_id ? (catMap[c.cost_category_id] || `Cat ${c.cost_category_id}`) : "Uncategorised";
        byCat[cat] = (byCat[cat] || 0) + Number(c.amount);
      });
      return {
        periodMonths: months,
        revenue,
        costs,
        profit: revenue - costs,
        margin: revenue > 0 ? ((revenue - costs) / revenue * 100).toFixed(1) + "%" : "0%",
        pendingInvoices: pending,
        latestBankBalance: cfData?.[0]?.balance ?? null,
        monthlyBreakdown: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ month: m, ...v, profit: v.revenue - v.costs })),
        costsByCategory: Object.entries(byCat).sort(([, a], [, b]) => b - a),
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getCurrentOrgId();
    const { messages } = (await req.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // Load org data + live business snapshot for context
    const [{ data: orgData }, { data: snapInv }, { data: snapCosts }, { data: snapCustomers }, { data: snapLeads }, { data: snapCashflow }] = await Promise.all([
      supabase.from("organizations").select("feature_flags, currency, name").limit(1).single(),
      supabase.from("fact_invoices").select("amount, status").is("deleted_at", null),
      supabase.from("fact_costs").select("amount").is("deleted_at", null),
      supabase.from("dim_customers").select("id").is("deleted_at", null),
      supabase.from("fact_leads").select("id, status_id").is("deleted_at", null),
      supabase.from("fact_cashflow").select("balance").order("record_date", { ascending: false }).limit(1),
    ]);

    const cur = (orgData?.currency === "USD" ? "$" : orgData?.currency === "EUR" ? "€" : "R");
    const invList = snapInv || [];
    const totalRevenue = invList.filter(i => i.status === "Completed" || i.status === "Paid").reduce((s, i) => s + Number(i.amount), 0);
    const totalPending = invList.filter(i => i.status === "Pending").reduce((s, i) => s + Number(i.amount), 0);
    const totalCosts = (snapCosts || []).reduce((s, c) => s + Number(c.amount), 0);
    const latestBalance = snapCashflow?.[0]?.balance;

    const snapshot = `
LIVE BUSINESS SNAPSHOT (${new Date().toISOString().slice(0, 10)}):
- Organisation: ${orgData?.name || "Your business"}
- Customers: ${(snapCustomers || []).length}
- Leads in pipeline: ${(snapLeads || []).length}
- Total revenue (completed): ${cur} ${totalRevenue.toLocaleString()}
- Pending invoices: ${cur} ${totalPending.toLocaleString()}
- Total costs recorded: ${cur} ${totalCosts.toLocaleString()}
- Profit: ${cur} ${(totalRevenue - totalCosts).toLocaleString()}${latestBalance != null ? `\n- Latest bank balance: ${cur} ${Number(latestBalance).toLocaleString()}` : ""}`;

    const customPrompt = (orgData?.feature_flags as Record<string, unknown>)?.ai_system_prompt as string | null;
    const systemPrompt = (customPrompt?.trim() || BASE_SYSTEM_PROMPT) + snapshot + `\n\nToday's date: ${new Date().toISOString().slice(0, 10)}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: crmTools,
      systemInstruction: systemPrompt,
    });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }] as Part[],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1].content;

    let result = await chat.sendMessage(lastMessage);

    // Agentic loop: resolve read tool calls; pause on first write tool call for user approval.
    let iterations = 0;
    while (result.response.functionCalls()?.length && iterations < 5) {
      iterations++;
      const calls = result.response.functionCalls()!;

      // Separate read vs write calls
      const readCalls = calls.filter(c => !WRITE_TOOLS.has(c.name));
      const writeCalls = calls.filter(c => WRITE_TOOLS.has(c.name));

      if (writeCalls.length > 0) {
        // Return the write action as a pending confirmation — do NOT execute.
        const writeCall = writeCalls[0];
        const textSoFar = result.response.text()?.trim() || "";
        return NextResponse.json({
          reply: textSoFar || "I have all the information needed. Please review and confirm:",
          pendingAction: {
            tool: writeCall.name,
            args: writeCall.args,
            label: TOOL_LABELS[writeCall.name] || writeCall.name,
          },
        });
      }

      // Execute read calls normally
      const toolParts: Part[] = await Promise.all(
        readCalls.map(async call => {
          let output: unknown;
          try {
            output = await executeTool(call.name, call.args as Record<string, unknown>, supabase, orgId);
          } catch (e) {
            output = { error: String(e) };
          }
          return {
            functionResponse: { name: call.name, response: { output } },
          } as Part;
        })
      );

      result = await chat.sendMessage(toolParts);
    }

    const reply = result.response.text();
    return NextResponse.json({ reply });
  } catch (e: unknown) {
    console.error("[ai-assistant]", e);
    const err = e as { status?: number; message?: string };
    if (err.status === 429) {
      return NextResponse.json({ error: "Rate limit reached — please wait a moment and try again." }, { status: 429 });
    }
    const msg = err.message || String(e);
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 500 });
  }
}
