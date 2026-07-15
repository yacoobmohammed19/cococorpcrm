import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";

const ORG_COOKIE = "coco_active_org";

// Routes operators cannot access (they are redirected to /leads)
const OPERATOR_BLOCKED = [
  "/billing", "/costs", "/invoices", "/products", "/quotes",
  "/marketing", "/accounting", "/performance", "/settings", "/customers",
];

export async function middleware(request: NextRequest) {
  // Refreshes the session AND hands back the validated user, so the guard below
  // doesn't call getUser() a second time (each call is a network round-trip).
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Only run the role guard when the path is actually operator-restricted —
  // avoids a DB round-trip on every dashboard/leads navigation.
  if (!OPERATOR_BLOCKED.some(p => pathname.startsWith(p))) return response;
  if (!user) return response;

  // Cookie is the active-org source of truth (kept in sync with metadata).
  const orgId = request.cookies.get(ORG_COOKIE)?.value
    ?? String(user.user_metadata?.active_org_id ?? "");
  if (!orgId) return response;

  // Request-scoped read client (middleware must use request.cookies, not next/headers).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* read-only in the guard — session refresh already handled above */
        },
      },
    },
  );

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
