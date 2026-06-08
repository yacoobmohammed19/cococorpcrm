import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { setActiveOrganization, signout } from "@/server-actions/auth";
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar";
import { BotNav } from "@/components/SideNav";
import { MobileHeader } from "@/components/MobileHeader";
import { FAB } from "@/components/FAB";
import { FABProvider } from "@/components/FABContext";
import { ToastProvider } from "@/components/Toast";
import { AiAssistant } from "@/components/AiAssistant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role, organizations(name)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) redirect("/onboarding");

  // Cookie is the authoritative source — updated immediately on org switch
  const jar = await cookies();
  const cookieOrgId = jar.get("coco_active_org")?.value;
  const activeOrgId = cookieOrgId
    ?? String(user.user_metadata?.active_org_id ?? memberships?.[0]?.org_id ?? "");

  // Resolve current role for the active org
  const currentRole = memberships.find(m => String(m.org_id) === activeOrgId)?.role ?? null;

  const [{ data: accounts }, { data: customers }, { data: payTypes }, { data: statuses }, { data: costCats }] = await Promise.all([
    supabase.from("dim_accounts").select("id, name").eq("org_id", activeOrgId).order("name"),
    supabase.from("dim_customers").select("id, name").eq("org_id", activeOrgId).is("deleted_at", null).order("name"),
    supabase.from("dim_payment_types").select("id, name").eq("org_id", activeOrgId).order("name"),
    supabase.from("dim_statuses").select("id, name").eq("org_id", activeOrgId).order("id"),
    supabase.from("dim_cost_categories").select("id, name").eq("org_id", activeOrgId).order("name"),
  ]);

  // Resolve org name safely — Supabase returns joined records as objects for m:1 joins
  const orgs = (memberships ?? []).map(m => {
    const org = m.organizations;
    const name = Array.isArray(org)
      ? ((org[0] as { name?: string })?.name ?? "Organization")
      : ((org as { name?: string } | null)?.name ?? "Organization");
    return { org_id: String(m.org_id), name };
  });

  const userName = String(
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""
  ).trim();

  return (
    <div className="flex min-h-screen" style={{ background: "var(--background)" }}>
      <CollapsibleSidebar
        userEmail={user.email ?? ""}
        userName={userName}
        orgs={orgs}
        activeOrgId={activeOrgId}
        role={currentRole}
        setActiveOrganization={setActiveOrganization}
        signout={signout}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with slide-out drawer */}
        <MobileHeader
          orgs={orgs}
          activeOrgId={activeOrgId}
          role={currentRole}
          setActiveOrganization={setActiveOrganization}
          signout={signout}
        />

        <FABProvider>
          <ToastProvider>
            <main className="flex-1 p-4 md:p-6 pb-[76px] md:pb-6">{children}</main>

            <FAB
              accounts={accounts || []}
              customers={customers || []}
              paymentTypes={payTypes || []}
              statuses={statuses || []}
              costCategories={costCats || []}
            />
            <AiAssistant orgId={activeOrgId} />

            {/* Mobile bottom nav — 64 px bar + safe-area inset */}
            <nav
              className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-40"
              style={{
                background: "var(--sidebar-bg)",
                borderColor: "var(--sidebar-border)",
                paddingBottom: "env(safe-area-inset-bottom)",
                height: "calc(64px + env(safe-area-inset-bottom))",
              }}
            >
              <BotNav role={currentRole} />
            </nav>
          </ToastProvider>
        </FABProvider>
      </div>
    </div>
  );
}
