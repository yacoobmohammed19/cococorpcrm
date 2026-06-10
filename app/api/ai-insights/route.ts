import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, data } = (await req.json()) as { type: string; data: Record<string, unknown> };

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let prompt = "";

  if (type === "dashboard") {
    const { revenue, opex, profit, margin, pending, overdueCount, overdueAmount, staleLeads, totalLeads, wonLeads, currency } = data as {
      revenue: number; opex: number; profit: number; margin: number; pending: number;
      overdueCount: number; overdueAmount: number; staleLeads: number; totalLeads: number; wonLeads: number; currency: string;
    };
    const fmtNum = (n: number) => n.toLocaleString("en-US");
    prompt = `You are a business analyst for a small business. Write a concise business briefing (3-4 sentences) based on these metrics. Be specific with numbers. Highlight what is notable — good or bad — and end with one actionable recommendation.

Metrics:
- Revenue collected: ${currency} ${fmtNum(revenue)}
- Operating costs: ${currency} ${fmtNum(opex)}
- Profit: ${currency} ${fmtNum(profit)} (${margin.toFixed(1)}% margin)
- Pending invoices: ${currency} ${fmtNum(pending)}
- Overdue invoices: ${overdueCount} totalling ${currency} ${fmtNum(overdueAmount)}
- Total leads: ${totalLeads} (${wonLeads} won)
- Leads needing follow-up: ${staleLeads}

Write in plain prose. No bullet points. No markdown. No headers. Use commas as thousands separators in numbers (e.g. 45,000 not 45 000).`;
  } else if (type === "health") {
    const { customerName, totalInvoices, paidCount, pendingCount, overdueCount, lastActivityDays, activeSubscriptions, currency, totalRevenue } = data as {
      customerName: string; totalInvoices: number; paidCount: number; pendingCount: number; overdueCount: number;
      lastActivityDays: number | null; activeSubscriptions: number; currency: string; totalRevenue: number;
    };
    prompt = `Assess this customer relationship. Respond with ONLY valid JSON, no other text: {"score":"Healthy"|"At Risk"|"Churned","reason":"<one short sentence>"}

Customer: ${customerName}
- Invoices: ${totalInvoices} total (${paidCount} paid, ${pendingCount} pending, ${overdueCount} overdue)
- Days since last logged activity: ${lastActivityDays ?? "none on record"}
- Active subscriptions: ${activeSubscriptions}
- Total revenue generated: ${currency} ${totalRevenue.toLocaleString()}

Scoring: "Healthy" = good payment + activity within 30 days. "At Risk" = overdue invoices OR inactive 30-90 days. "Churned" = inactive 90+ days AND unpaid invoices.`;
  } else if (type === "description") {
    const { customerName, lines, totalAmount, currency } = data as {
      customerName: string;
      lines: { description: string; quantity: number; unit_price: number }[];
      totalAmount: number;
      currency: string;
    };
    const lineList = lines
      .filter((l) => l.description.trim())
      .map((l) => `${l.quantity}× ${l.description}`)
      .join(", ");
    prompt = `Write a professional invoice description for a ${currency} ${totalAmount.toLocaleString()} invoice to ${customerName}.
Items: ${lineList || "general services"}
Respond with one concise sentence only (max 80 characters). No quotes. No punctuation at the end. Just the description text.`;
  }

  if (type === "report_graph") {
    const { query, table, metric, groupBy, results, currency } = data as {
      query: string; table: string; metric: string; groupBy: string;
      results: { label: string; value: number }[]; currency: string;
    };
    const cur = currency === "ZAR" ? "R" : "$";
    const dataStr = results.slice(0, 30).map(r => `${r.label}: ${cur} ${r.value.toLocaleString()}`).join(", ");
    prompt = `You are a data visualisation expert. The user has the following report data from a ${table} table and wants a chart.

Metric: ${metric}
Group by: ${groupBy === "none" ? "no grouping" : groupBy}
Data: ${dataStr}

User request: "${query}"

FIRST, try to return a structured chart spec as JSON in a markdown code block:
\`\`\`json
{"chartType":"bar","title":"<title>","xKey":"label","yKey":"value","data":[{"label":"...","value":...},...]}
\`\`\`
chartType must be "bar", "line", or "pie".
Include max 15 data points in the JSON.

ONLY if the request cannot be satisfied with bar/line/pie (e.g. complex annotations, multi-series with formatting), return a complete self-contained HTML file using Chart.js CDN in a markdown html code block. The HTML must include dark-mode friendly colors (background #1a1f2e, text #e2e8f0). Provide ONLY the code block, no explanations.`;

    try {
      const result = await model.generateContent(prompt);
      return NextResponse.json({ result: result.response.text().trim() });
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err.status === 429) return NextResponse.json({ error: "Rate limit — try again shortly" }, { status: 429 });
      return NextResponse.json({ error: err.message || "AI error" }, { status: 500 });
    }
  }

  if (type === "chat") {
    const { metrics, messages, briefing } = data as {
      metrics: { revenue: number; opex: number; profit: number; margin: number; pending: number; overdueCount: number; overdueAmount: number; staleLeads: number; totalLeads: number; wonLeads: number; currency: string };
      messages: { role: string; content: string }[];
      briefing: string | null;
    };
    const m = metrics;
    const ctx = `Business context:
- Revenue collected: ${m.currency} ${m.revenue.toLocaleString()}
- Operating costs: ${m.currency} ${m.opex.toLocaleString()}
- Profit: ${m.currency} ${m.profit.toLocaleString()} (${m.margin.toFixed(1)}% margin)
- Pending invoices: ${m.currency} ${m.pending.toLocaleString()}
- Overdue invoices: ${m.overdueCount} totalling ${m.currency} ${m.overdueAmount.toLocaleString()}
- Total leads: ${m.totalLeads} (${m.wonLeads} won, ${m.staleLeads} need follow-up)${briefing ? `\n\nAI briefing: ${briefing}` : ""}`;

    const chatModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are a business analyst assistant. Answer questions concisely using the data provided. Format amounts with the currency symbol. No markdown, no bullet points — plain prose only.\n\n${ctx}`,
    });
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === "user" ? "user" : "model" as "user" | "model",
      parts: [{ text: msg.content }],
    }));
    const chat = chatModel.startChat({ history });
    const lastMsg = messages[messages.length - 1]?.content || "";
    try {
      const result = await chat.sendMessage(lastMsg);
      return NextResponse.json({ result: result.response.text().trim() });
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err.status === 429) return NextResponse.json({ error: "Rate limit — try again shortly" }, { status: 429 });
      return NextResponse.json({ error: err.message || "AI error" }, { status: 500 });
    }
  }

  if (!prompt) return NextResponse.json({ error: "Unknown insight type" }, { status: 400 });

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return NextResponse.json({ result: text });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err.status === 429) return NextResponse.json({ error: "Rate limit — try again shortly" }, { status: 429 });
    return NextResponse.json({ error: err.message || "AI error" }, { status: 500 });
  }
}
