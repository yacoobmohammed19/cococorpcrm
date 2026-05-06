"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { ThemeToggle } from "@/components/ThemeToggle";

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

export function CollapsibleSidebar({
  userEmail,
  userName,
  orgs,
  activeOrgId,
  setActiveOrganization,
  signout,
}: Props) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed());

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("sidebar_collapsed", String(next)); } catch { /* ignore */ }
  };

  const initial = (userName || userEmail).slice(0, 1).toUpperCase();

  return (
    <aside
      className="hidden md:flex flex-col shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? "3.5rem" : "14rem",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center shrink-0"
        style={{
          borderBottom: "1px solid var(--sidebar-border)",
          height: "56px",
          padding: collapsed ? "0 0.75rem" : "0 1rem",
        }}
      >
        {collapsed ? (
          <span
            className="text-lg font-black tracking-widest"
            style={{ color: "var(--sidebar-indicator)" }}
          >
            C
          </span>
        ) : (
          <div>
            <h1 className="text-base font-black tracking-widest leading-none">
              <span style={{ color: "var(--sidebar-indicator)" }}>COCO</span>
              <span style={{ color: "var(--sidebar-fg-active)" }}>CORP</span>
            </h1>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--sidebar-label)" }}>
              CRM Engine v2
            </p>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <SideNav collapsed={collapsed} />

      {/* ── Footer ── */}
      <div
        className="shrink-0"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        {/* Theme toggle */}
        <div style={{ padding: collapsed ? "0.375rem" : "0.375rem 0.25rem 0" }}>
          <ThemeToggle collapsed={collapsed} />
        </div>

        {/* Profile + org switcher */}
        {!collapsed && (
          <div className="px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: "var(--sidebar-indicator)", color: "#fff" }}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <p
                  className="text-xs font-semibold truncate"
                  style={{ color: "var(--sidebar-fg-active)" }}
                >
                  {userName || "User"}
                </p>
                <p
                  className="text-[11px] truncate"
                  style={{ color: "var(--sidebar-fg)" }}
                >
                  {userEmail}
                </p>
              </div>
            </div>

            <form action={setActiveOrganization}>
              <select
                name="org_id"
                defaultValue={activeOrgId}
                className="w-full text-xs rounded-md px-2 py-1.5 border appearance-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "var(--sidebar-border)",
                  color: "var(--sidebar-fg)",
                }}
              >
                {orgs.map(o => (
                  <option key={o.org_id} value={o.org_id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </form>

            <form action={signout}>
              <button
                className="w-full text-xs rounded-md px-2 py-1.5 border text-left transition-colors hover:bg-white/[0.06]"
                style={{
                  borderColor: "var(--sidebar-border)",
                  color: "var(--sidebar-fg)",
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        )}

        {/* Collapse toggle */}
        <div style={{ padding: collapsed ? "0.375rem" : "0 0.75rem 0.75rem" }}>
          <button
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-full flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors hover:bg-white/[0.06]"
            style={{ color: "var(--sidebar-fg)" }}
          >
            {collapsed ? <ChevronRight size={14} /> : (
              <>
                <ChevronLeft size={14} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
