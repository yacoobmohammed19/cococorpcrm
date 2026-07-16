import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Radar } from "lucide-react";
import { getServerUser } from "@/lib/supabase/org";
import { isSuperAdminUser } from "@/lib/supabase/platform";
import { signout } from "@/server-actions/auth";
import { ToastProvider } from "@/components/Toast";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  // Platform gate — anyone who isn't a super admin is bounced to the app.
  if (!isSuperAdminUser(user)) redirect("/dashboard");

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Command bar — ink-dark to signal you're in platform mode, not an org */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: "linear-gradient(180deg, #1B1A1E 0%, #141316 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          color: "#F5F4F2",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, var(--pink) 0%, var(--accent-hover) 100%)" }}
              >
                <Radar size={17} color="#fff" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-none tracking-wide">Control Tower</p>
                <p className="text-[11px] leading-none mt-1" style={{ color: "rgba(245,244,242,0.5)" }}>
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Open app
                <ArrowUpRight size={13} />
              </Link>
              <form action={signout}>
                <button
                  type="submit"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: "rgba(245,244,242,0.7)" }}
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>

      <ToastProvider>
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </ToastProvider>
    </div>
  );
}
