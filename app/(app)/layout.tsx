import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/org";
import { isSuperAdminUser } from "@/lib/supabase/platform";
import { getCachedDimensions } from "@/lib/supabase/cache";
import { setActiveOrganization, signout } from "@/server-actions/auth";
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar";
import { BotNav } from "@/components/SideNav";
import { MobileHeader } from "@/components/MobileHeader";
import { UserProfileMenu } from "@/components/OrgSwitcher";
import { FAB } from "@/components/FAB";
import { FABProvider } from "@/components/FABContext";
import { ToastProvider } from "@/components/Toast";
import { AiAssistant } from "@/components/AiAssistant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const superAdmin = isSuperAdminUser(user);

  const supabase = await createServerClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role, organizations(name)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    // Super admins without an org belong in the control tower, not onboarding.
    redirect(superAdmin ? "/admin" : "/onboarding");
  }

  // Cookie is the authoritative source — updated immediately on org switch
  const jar = await cookies();
  const cookieOrgId = jar.get("coco_active_org")?.value;
  const activeOrgId = cookieOrgId
    ?? String(user.user_metadata?.active_org_id ?? memberships?.[0]?.org_id ?? "");

  // Resolve current role for the active org
  const currentRole = memberships.find(m => String(m.org_id) === activeOrgId)?.role ?? null;

  const { accounts, customers, paymentTypes: payTypes, statuses, costCategories: costCats } =
    await getCachedDimensions(activeOrgId);

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
        role={currentRole}
        isSuperAdmin={superAdmin}
        signout={signout}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header — hamburger + profile menu in one bar */}
        <MobileHeader
          role={currentRole}
          profileMenu={
            <UserProfileMenu
              orgs={orgs}
              activeOrgId={activeOrgId}
              userEmail={user.email ?? ""}
              userName={userName}
              isSuperAdmin={superAdmin}
              setActiveOrganization={setActiveOrganization}
              signout={signout}
            />
          }
        />

        {/* Desktop top bar — profile menu top-right */}
        <header
          className="hidden md:flex items-center justify-end px-6 py-2 border-b shrink-0 sticky top-0 z-30"
          style={{ background: "var(--background)", borderColor: "var(--border)", height: 48 }}
        >
          <UserProfileMenu
            orgs={orgs}
            activeOrgId={activeOrgId}
            userEmail={user.email ?? ""}
            userName={userName}
            setActiveOrganization={setActiveOrganization}
            signout={signout}
          />
        </header>

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
