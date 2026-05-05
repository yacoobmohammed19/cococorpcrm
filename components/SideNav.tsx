"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: string; group: string };

const sideNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", group: "Overview" },
  { href: "/leads", label: "Leads", icon: "🎯", group: "CRM" },
  { href: "/customers", label: "Customers", icon: "👥", group: "CRM" },
  { href: "/quotes", label: "Quotes", icon: "📝", group: "CRM" },
  { href: "/products", label: "Products", icon: "📦", group: "Catalog" },
  { href: "/invoices", label: "Invoices", icon: "🧾", group: "Finance" },
  { href: "/billing", label: "Billing", icon: "📅", group: "Finance" },
  { href: "/costs", label: "Costs", icon: "📤", group: "Finance" },
  { href: "/marketing", label: "Marketing", icon: "📣", group: "Marketing" },
  { href: "/accounting", label: "Accounting", icon: "📋", group: "Analytics" },
  { href: "/performance", label: "Snapshots", icon: "📈", group: "Analytics" },
  { href: "/settings", label: "Settings", icon: "⚙️", group: "Config" },
];

const groups = ["Overview", "CRM", "Catalog", "Finance", "Marketing", "Analytics", "Config"];

export function SideNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto" style={{ padding: collapsed ? "0.5rem 0.375rem" : "0.75rem" }}>
      {groups.map(group => {
        const items = sideNav.filter(n => n.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className={collapsed ? "mb-2" : "mb-4"}>
            {!collapsed && (
              <p className="text-xs font-semibold uppercase tracking-widest mb-1 px-2" style={{ color: "var(--muted2)" }}>
                {group}
              </p>
            )}
            {items.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-2 rounded text-sm font-medium transition-colors mb-0.5 ${collapsed ? "justify-center px-2 py-2" : "px-3 py-2"}`}
                  style={{
                    background: isActive ? "var(--accent)" : "transparent",
                    color: isActive ? "#fff" : "var(--muted)",
                  }}>
                  <span className="text-sm w-5 text-center shrink-0">{item.icon}</span>
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

const botNav = [
  { href: "/dashboard", label: "Home", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "🎯" },
  { href: "/invoices", label: "Invoices", icon: "🧾" },
  { href: "/customers", label: "Clients", icon: "👥" },
];

const moreNav = [
  { href: "/quotes", label: "Quotes", icon: "📝" },
  { href: "/products", label: "Products", icon: "📦" },
  { href: "/billing", label: "Billing", icon: "📅" },
  { href: "/costs", label: "Costs", icon: "📤" },
  { href: "/marketing", label: "Marketing", icon: "📣" },
  { href: "/accounting", label: "Accounting", icon: "📋" },
  { href: "/performance", label: "Snapshots", icon: "📈" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function BotNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {botNav.map(item => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={{ color: isActive ? "var(--accent)" : "var(--muted2)" }}>
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>
            {isActive && <span className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
          </Link>
        );
      })}

      <button onClick={() => setMoreOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative"
        style={{ color: "var(--muted2)" }}>
        <span className="text-xl leading-none">☰</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">More</span>
      </button>

      {moreOpen && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)" }}
          onClick={() => setMoreOpen(false)}>
          <div
            className="rounded-t-3xl px-5 pt-5 pb-10"
            style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }}
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border)" }} />
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted2)" }}>All Sections</span>
              <button onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--card2)", color: "var(--muted2)" }}>✕</button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {moreNav.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors"
                    style={{
                      background: isActive ? "var(--accent)" : "var(--card2)",
                      color: isActive ? "#fff" : "var(--muted)",
                      border: isActive ? "none" : "1px solid var(--border)",
                    }}>
                    <span className="text-2xl leading-none">{item.icon}</span>
                    <span className="text-xs font-semibold text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
