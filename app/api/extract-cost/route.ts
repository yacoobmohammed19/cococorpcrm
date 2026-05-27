import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Allow up to 60 s — Gemini 2.5 Flash uses thinking tokens and can be slow
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Wrap req.json() — a large base64 image body can cause a parse error which
  // would otherwise bubble up as an unhandled exception and return an HTML 500
  // page, causing res.json() on the client to throw → "Failed to scan receipt".
  let image: string, mimeType: string;
  try {
    const body = await req.json() as { image?: string; mimeType?: string };
    image = body.image ?? "";
    mimeType = body.mimeType ?? "image/jpeg";
  } catch {
    return NextResponse.json(
      { error: "Could not read request — image may be too large. Try a smaller file." },
      { status: 413 },
    );
  }
  if (!image) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  // Upload image to Supabase Storage
  let imageUrl: string | null = null;
  try {
    const admin = createAdminClient();
    const base64Data = image.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const ext = (mimeType || "image/jpeg").split("/")[1] || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { data: uploadData, error: uploadError } = await admin.storage
      .from("receipts")
      .upload(path, buffer, { contentType: mimeType || "image/jpeg", upsert: false });
    if (!uploadError && uploadData) {
      const { data: urlData } = admin.storage.from("receipts").getPublicUrl(uploadData.path);
      imageUrl = urlData.publicUrl;
    }
  } catch { /* storage may not be set up yet — continue without image URL */ }

  // Use Gemini vision to extract cost details
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Extract cost/expense details from this receipt or invoice image.
Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "amount": <number or null>,
  "date": "<YYYY-MM-DD or null>",
  "details": "<vendor name and brief description, max 100 chars, or null>",
  "category": "<one of: Advertising, Travel, Equipment, Software, Office Supplies, Utilities, Rent, Salaries, Professional Services, Food & Entertainment, Other, or null>"
}`;

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: image.replace(/^data:[^;]+;base64,/, ""), mimeType: mimeType || "image/jpeg" } },
    ]);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ imageUrl }, { status: 200 });
    const extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return NextResponse.json({ ...extracted, imageUrl });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err.status === 429) return NextResponse.json({ error: "Rate limit — try again shortly" }, { status: 429 });
    return NextResponse.json({ imageUrl, error: err.message || "AI error" }, { status: 200 });
  }
}
