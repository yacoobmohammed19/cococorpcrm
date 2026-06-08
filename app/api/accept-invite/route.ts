import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Route handler so we can set the org cookie during invite acceptance,
// which is impossible from a server component (page.tsx).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invite_tokens")
    .select("id, org_id, email, role, expires_at, used_at")
    .eq("token", token)
    .single();

  const isValid =
    invite &&
    !invite.used_at &&
    new Date(invite.expires_at) > new Date();

  if (!isValid) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("This invite link is invalid or has expired."), request.url)
    );
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?invite=${encodeURIComponent(token)}`, request.url)
    );
  }

  // Add (or update) membership
  const { error: memberError } = await admin.from("memberships").upsert(
    { user_id: user.id, org_id: invite.org_id, role: invite.role },
    { onConflict: "user_id,org_id" }
  );

  if (memberError) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("Failed to accept invite. Please try again."), request.url)
    );
  }

  await admin.from("invite_tokens").update({ used_at: new Date().toISOString() }).eq("id", invite.id);

  // Set the active org cookie immediately so the layout doesn't need to fall back
  const jar = await cookies();
  jar.set("coco_active_org", String(invite.org_id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
