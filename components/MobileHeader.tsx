"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X, Menu,
  LayoutDashboard, Target, Users, FileText, Package,
  Receipt, CalendarDays, TrendingDown, Megaphone,
  BookOpen, BarChart2, Settings, Sparkles, UsersRound, Building2, TableProperties,
} from "lucide-react";

const allDrawerNav = [
  { href: "/dashboard",  label: "Dashboard",  Icon: LayoutDashboard, group: "Overview"   },
  { href: "/leads",      label: "Leads",       Icon: Target,          group: "CRM"        },
  { href: "/customers",  label: "Customers",   Icon: Users,           group: "CRM"        },
  { href: "/quotes",     label: "Quotes",      Icon: FileText,        group: "CRM"        },
  { href: "/products",   label: "Products",    Icon: Package,         group: "Catalog"    },
  { href: "/invoices",   label: "Invoices",    Icon: Receipt,         group: "Finance"    },
  { href: "/billing",    label: "Billing",     Icon: CalendarDays,    group: "Finance"    },
  { href: "/costs",      label: "Costs",       Icon: TrendingDown,    group: "Finance"    },
  { href: "/marketing",  label: "Marketing",   Icon: Megaphone,       group: "Marketing"  },
  { href: "/accounting", label: "Accounting",  Icon: BookOpen,        group: "Analytics"  },
  { href: "/performance",label: "Snapshots",   Icon: BarChart2,       group: "Analytics"  },
  { href: "/reports",    label: "Reports",     Icon: TableProperties, group: "Analytics"  },
  { href: "/settings",                label: "Settings",  Icon: Settings,    group: "Config" },
  { href: "/settings/team",           label: "Team",      Icon: UsersRound,  group: "Config" },
  { href: "/settings/organisations",  label: "Orgs",      Icon: Building2,   group: "Config" },
  { href: "/chat",                    label: "Coco AI",   Icon: Sparkles,    group: "Config" },
];
const OPERATOR_ALLOWED_MOBILE = new Set(["/dashboard", "/leads", "/chat"]);
const groups = ["Overview", "CRM", "Catalog", "Finance", "Marketing", "Analytics", "Config"];

type Props = {
  role: string | null;
  profileMenu?: ReactNode;
};

export function MobileHeader({ role, profileMenu }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerNav = role === "operator"
    ? allDrawerNav.filter(n => OPERATOR_ALLOWED_MOBILE.has(n.href))
    : allDrawerNav;

  return (
    <>
      {/* Top bar */}
      <header
        className="md:hidden flex items-center px-3 border-b shrink-0"
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)", height: 48 }}
      >
        {/* Hamburger — opens left drawer */}
        <button
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors active:scale-95"
          style={{ color: "var(--sidebar-fg)" }}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        {/* Logo */}
        <h1 className="text-sm font-bold tracking-widest absolute left-1/2 -translate-x-1/2">
          <span style={{ color: "var(--sidebar-indicator)" }}>COCO</span>
          <span style={{ color: "var(--sidebar-fg-active)" }}>CORP</span>
        </h1>

        {/* Profile menu — right slot */}
        {profileMenu && (
          <div className="ml-auto">
            {profileMenu}
          </div>
        )}
      </header>

      {/* Backdrop */}
      <div
        className="md:hidden fixed inset-0 z-[490]"
        style={{
          background: "rgba(0,0,0,.55)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
        onClick={() => setOpen(false)}
      />

      {/* Slide-out drawer from left */}
      <div
        className="md:hidden fixed top-0 left-0 bottom-0 z-[500] flex flex-col"
        style={{
          width: 280,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: open ? "6px 0 32px rgba(0,0,0,.45)" : "none",
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-4 border-b shrink-0"
          style={{ borderColor: "var(--sidebar-border)", height: 56 }}
        >
          <span className="text-sm font-bold tracking-widest">
            <span style={{ color: "var(--sidebar-indicator)" }}>COCO</span>
            <span style={{ color: "var(--sidebar-fg-active)" }}>CORP</span>
          </span>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: "var(--sidebar-hover)", color: "var(--sidebar-fg)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {groups.map(group => {
            const items = drawerNav.filter(n => n.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="mb-3">
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.12em] px-3 py-1.5"
                  style={{ color: "var(--sidebar-label)" }}
                >
                  {group}
                </p>
                {items.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 active:scale-[.98] transition-transform"
                      style={{
                        background: isActive ? "var(--sidebar-active)" : "transparent",
                        color: isActive ? "var(--sidebar-fg-active)" : "var(--sidebar-fg)",
                        boxShadow: isActive ? "inset 0 0 0 1px rgba(236,72,153,.2)" : undefined,
                      }}
                    >
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                          style={{ background: "var(--sidebar-indicator)", width: 3, height: 18, boxShadow: "0 0 8px var(--sidebar-indicator)" }}
                        />
                      )}
                      <item.Icon
                        size={16}
                        style={{
                          color: isActive ? "var(--sidebar-indicator)" : "var(--sidebar-fg)",
                          filter: isActive ? "drop-shadow(0 0 4px rgba(236,72,153,.5))" : undefined,
                        }}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}
