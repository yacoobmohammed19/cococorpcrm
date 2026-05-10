import { GoogleGenerativeAI, SchemaType, Tool, Part } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import type { SupabaseClient } from "@supabase/supabase-js";

const S = SchemaType;

const SYSTEM_PROMPT = `You are Coco, a smart AI assistant built into CocoCRM. You help users manage their business through natural conversation.

You can:
- Search and manage customers
- Create and update invoices
- Log activities (calls, emails, meetings)
- Create leads
- Show stats and summaries

Guidelines:
- Be concise and friendly. Confirm actions after completing them.
- When creating invoices or customers, confirm key details in your response.
- Format amounts as currency (e.g. R 5,000).
- If you need a customer ID but only have a name, use search_customers first.`;

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

    // Load org's custom system prompt if set
    const { data: orgData } = await supabase
      .from("organizations")
      .select("feature_flags")
      .limit(1)
      .single();
    const customPrompt = (orgData?.feature_flags as Record<string, unknown>)?.ai_system_prompt as string | null;
    const systemPrompt = (customPrompt?.trim() || SYSTEM_PROMPT) + `\n\nToday's date: ${new Date().toISOString().slice(0, 10)}`;

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

    // Agentic loop: keep resolving tool calls until Gemini returns text
    let iterations = 0;
    while (result.response.functionCalls()?.length && iterations < 5) {
      iterations++;
      const calls = result.response.functionCalls()!;

      const toolParts: Part[] = await Promise.all(
        calls.map(async call => {
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
