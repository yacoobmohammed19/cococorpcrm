"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = {
  userEmail: string;
  userName: string;
  role: string | null;
  signout: () => Promise<void>;
};

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("sidebar_collapsed") === "true"; } catch { return false; }
}

export function CollapsibleSidebar({ userEmail, userName, role, signout }: Props) {
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
        className="flex items-center gap-2.5 shrink-0"
        style={{
          borderBottom: "1px solid var(--sidebar-border)",
          height: "56px",
          padding: collapsed ? "0 0.75rem" : "0 1rem",
        }}
      >
        {/* Icon mark */}
        <div
          className="flex items-center justify-center shrink-0 rounded-lg text-sm font-black"
          style={{
            width: "28px", height: "28px",
            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            color: "#fff",
            boxShadow: "0 0 12px rgba(16,185,129,0.4)",
            letterSpacing: "-0.05em",
          }}
        >
          C
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-sm font-black tracking-wider leading-none">
              <span style={{ color: "var(--sidebar-indicator)" }}>COCO</span>
              <span style={{ color: "var(--sidebar-fg-active)" }}>CORP</span>
            </h1>
            <p className="text-[9px] mt-0.5 font-medium tracking-widest uppercase" style={{ color: "var(--sidebar-label)" }}>
              CRM Platform
            </p>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <SideNav collapsed={collapsed} role={role} />

      {/* ── Footer ── */}
      <div
        className="shrink-0"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        {/* Theme toggle */}
        <div style={{ padding: collapsed ? "0.375rem" : "0.375rem 0.25rem 0" }}>
          <ThemeToggle collapsed={collapsed} />
        </div>

        {/* Profile + sign out */}
        {!collapsed && (
          <div className="px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "#fff", boxShadow: "0 0 8px rgba(16,185,129,0.35)" }}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--sidebar-fg-active)" }}>
                  {userName || "User"}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--sidebar-fg)" }}>
                  {userEmail}
                </p>
              </div>
            </div>

            <form action={signout}>
              <button
                className="w-full text-xs rounded-md px-2 py-1.5 border text-left transition-colors hover:bg-white/[0.06]"
                style={{ borderColor: "var(--sidebar-border)", color: "var(--sidebar-fg)" }}
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
