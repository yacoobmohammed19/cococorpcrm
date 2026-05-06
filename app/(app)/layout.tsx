import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { setActiveOrganization, signout } from "@/server-actions/auth";
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar";
import { BotNav } from "@/components/SideNav";
import { FAB } from "@/components/FAB";
import { ToastProvider } from "@/components/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, organizations(name)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) redirect("/onboarding");

  const activeOrgId = String(user.user_metadata?.active_org_id ?? memberships?.[0]?.org_id ?? "");

  const [{ data: accounts }, { data: customers }, { data: payTypes }, { data: statuses }, { data: costCats }] = await Promise.all([
    supabase.from("dim_accounts").select("id, name").order("name"),
    supabase.from("dim_customers").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("dim_payment_types").select("id, name").order("name"),
    supabase.from("dim_statuses").select("id, name").order("id"),
    supabase.from("dim_cost_categories").select("id, name").order("name"),
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
        setActiveOrganization={setActiveOrganization}
        signout={signout}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-3 border-b"
          style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}>
          <h1 className="text-base font-bold tracking-widest">
            <span style={{ color: "var(--sidebar-indicator)" }}>COCO</span>
            <span style={{ color: "var(--sidebar-fg-active)" }}>CORP</span>
          </h1>
          <div className="flex items-center gap-2">
            <form action={setActiveOrganization}>
              <select name="org_id" defaultValue={activeOrgId}
                className="text-xs rounded px-2 py-1 border"
                style={{ background: "rgba(255,255,255,0.08)", borderColor: "var(--sidebar-border)", color: "var(--sidebar-fg)" }}>
                {orgs.map(o => (
                  <option key={o.org_id} value={o.org_id}>{o.name}</option>
                ))}
              </select>
            </form>
            <form action={signout}>
              <button className="text-xs rounded border px-2 py-1" style={{ borderColor: "var(--sidebar-border)", color: "var(--sidebar-fg)" }}>
                Out
              </button>
            </form>
          </div>
        </header>

        <ToastProvider>
          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>

          <FAB
            accounts={accounts || []}
            customers={customers || []}
            paymentTypes={payTypes || []}
            statuses={statuses || []}
            costCategories={costCats || []}
          />

          {/* Mobile bottom nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-40"
            style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}>
            <BotNav />
          </nav>
        </ToastProvider>
      </div>
    </div>
  );
}
