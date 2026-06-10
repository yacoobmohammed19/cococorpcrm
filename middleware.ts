import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@/lib/supabase/server";

// Routes operators cannot access (they are redirected to /leads)
const OPERATOR_BLOCKED = [
  "/billing", "/costs", "/invoices", "/products", "/quotes",
  "/marketing", "/accounting", "/performance", "/settings", "/customers",
];

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Only run the role guard when the path is actually operator-restricted —
  // avoids two DB round-trips on every dashboard/leads/customers navigation.
  if (!OPERATOR_BLOCKED.some(p => pathname.startsWith(p))) return response;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response;

  const orgId = String(user.user_metadata?.active_org_id ?? "");
  if (!orgId) return response;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (membership?.role === "operator") {
    return NextResponse.redirect(new URL("/leads", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
