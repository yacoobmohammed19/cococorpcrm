"use client";

import { useState } from "react";
import { SideNav } from "@/components/SideNav";

type Org = { org_id: string; name: string };

type Props = {
  userEmail: string;
  userName: string;
  orgs: Org[];
  activeOrgId: string;
  setActiveOrganization: (formData: FormData) => Promise<void>;
  signout: () => Promise<void>;
};

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("sidebar_collapsed") === "true"; } catch { return false; }
}

export function CollapsibleSidebar({ userEmail, userName, orgs, activeOrgId, setActiveOrganization, signout }: Props) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed());

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("sidebar_collapsed", String(next)); } catch { /* ignore */ }
  };

  return (
    <aside
      className="hidden md:flex flex-col border-r shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? "3.5rem" : "14rem",
        background: "var(--card)",
        borderColor: "var(--border)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "hidden",
      }}>
      {/* Logo */}
      <div className="border-b shrink-0 flex items-center"
        style={{ borderColor: "var(--border)", height: "56px", padding: collapsed ? "0 0.5rem" : "0 1rem" }}>
        {collapsed
          ? <span className="text-lg font-bold" style={{ color: "var(--pink)" }}>C</span>
          : <div>
              <h1 className="text-lg font-bold tracking-widest leading-none">
                <span style={{ color: "var(--pink)" }}>COCO</span>
                <span className="text-white">CORP</span>
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>CRM Engine v2</p>
            </div>
        }
      </div>

      {/* Nav */}
      <SideNav collapsed={collapsed} />

      {/* Profile + toggle */}
      <div className="border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        {!collapsed && (
          <div className="px-3 pt-2.5 pb-1 space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}>
                {(userName || userEmail).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>{userName || "User"}</p>
                <p className="text-xs truncate" style={{ color: "var(--muted2)" }}>{userEmail}</p>
              </div>
            </div>
            <form action={setActiveOrganization}>
              <select name="org_id" defaultValue={activeOrgId}
                className="w-full text-xs rounded px-2 py-1.5 border"
                style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
                {orgs.map(o => <option key={o.org_id} value={o.org_id}>{o.name}</option>)}
              </select>
            </form>
            <form action={signout}>
              <button className="w-full text-xs rounded px-2 py-1.5 border text-left transition-colors hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                Sign out
              </button>
            </form>
          </div>
        )}
        <div className={collapsed ? "p-1.5" : "px-3 py-2"}>
          <button onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-full flex items-center justify-center rounded py-1.5 text-xs transition-colors hover:opacity-80"
            style={{ background: "var(--card3)", color: "var(--muted2)" }}>
            {collapsed ? "▶" : "◀ Collapse"}
          </button>
        </div>
      </div>
    </aside>
  );
}
