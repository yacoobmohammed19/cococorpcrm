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

  // Only apply role guard to app routes
  const isAppRoute =
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/invite") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next");

  if (!isAppRoute) return response;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response; // layout/auth will handle redirect

  const orgId = String(user.user_metadata?.active_org_id ?? "");
  if (!orgId) return response;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (
    membership?.role === "operator" &&
    OPERATOR_BLOCKED.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.redirect(new URL("/leads", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
