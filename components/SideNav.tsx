"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LucideIcon, LayoutDashboard, Target, Users, FileText, Package, Receipt, CalendarDays, TrendingDown, Megaphone, BookOpen, BarChart2, Settings, X, AlignJustify, Sparkles } from "lucide-react";

type NavItem = { href: string; label: string; Icon: LucideIcon; group: string };

const sideNav: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard",  Icon: LayoutDashboard, group: "Overview"   },
  { href: "/leads",       label: "Leads",       Icon: Target,          group: "CRM"        },
  { href: "/customers",   label: "Customers",   Icon: Users,           group: "CRM"        },
  { href: "/quotes",      label: "Quotes",      Icon: FileText,        group: "CRM"        },
  { href: "/products",    label: "Products",    Icon: Package,         group: "Catalog"    },
  { href: "/invoices",    label: "Invoices",    Icon: Receipt,         group: "Finance"    },
  { href: "/billing",     label: "Billing",     Icon: CalendarDays,    group: "Finance"    },
  { href: "/costs",       label: "Costs",       Icon: TrendingDown,    group: "Finance"    },
  { href: "/marketing",   label: "Marketing",   Icon: Megaphone,       group: "Marketing"  },
  { href: "/accounting",  label: "Accounting",  Icon: BookOpen,        group: "Analytics"  },
  { href: "/performance", label: "Snapshots",   Icon: BarChart2,       group: "Analytics"  },
  { href: "/settings",    label: "Settings",    Icon: Settings,        group: "Config"     },
  { href: "/chat",        label: "Coco AI",     Icon: Sparkles,        group: "Config"     },
];

const groups = ["Overview", "CRM", "Catalog", "Finance", "Marketing", "Analytics", "Config"];

export function SideNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      className="flex-1 overflow-y-auto"
      style={{ padding: collapsed ? "0.5rem 0.375rem" : "0.75rem 0.5rem" }}
    >
      {groups.map((group, gi) => {
        const items = sideNav.filter(n => n.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className={collapsed ? "mb-2" : "mb-4"}>
            {!collapsed && (
              <div className="flex items-center gap-2 mb-1.5 px-3">
                {gi > 0 && <div className="flex-1 h-px" style={{ background: "var(--sidebar-border)" }} />}
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.12em] shrink-0"
                  style={{ color: "var(--sidebar-label)" }}
                >
                  {group}
                </p>
                <div className="flex-1 h-px" style={{ background: "var(--sidebar-border)" }} />
              </div>
            )}
            {items.map(item => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className="relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium mb-0.5"
                  style={{
                    padding: collapsed ? "0.6rem" : "0.45rem 0.75rem",
                    justifyContent: collapsed ? "center" : undefined,
                    background: isActive ? "var(--sidebar-active)" : "transparent",
                    color: isActive ? "var(--sidebar-fg-active)" : "var(--sidebar-fg)",
                    boxShadow: isActive && !collapsed ? "inset 0 0 0 1px rgba(16,185,129,0.2)" : undefined,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover)"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {isActive && !collapsed && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: "var(--sidebar-indicator)", width: "3px", height: "18px", boxShadow: "0 0 8px var(--sidebar-indicator)" }}
                    />
                  )}
                  {isActive && collapsed && (
                    <span
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--sidebar-indicator)", boxShadow: "0 0 6px var(--sidebar-indicator)" }}
                    />
                  )}
                  <item.Icon
                    size={15}
                    className="shrink-0"
                    style={{
                      color: isActive ? "var(--sidebar-indicator)" : "var(--sidebar-fg)",
                      filter: isActive ? "drop-shadow(0 0 4px rgba(16,185,129,0.5))" : undefined,
                    }}
                  />
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

/* ── Mobile bottom nav ── */

const botNav = [
  { href: "/dashboard", label: "Home",     Icon: LayoutDashboard },
  { href: "/invoices",  label: "Invoices", Icon: Receipt          },
  { href: "/customers", label: "Clients",  Icon: Users            },
  { href: "/chat",      label: "Coco AI",  Icon: Sparkles         },
];

const moreNav = [
  { href: "/quotes",       label: "Quotes",      Icon: FileText     },
  { href: "/products",     label: "Products",    Icon: Package      },
  { href: "/billing",      label: "Billing",     Icon: CalendarDays },
  { href: "/costs",        label: "Costs",       Icon: TrendingDown },
  { href: "/marketing",    label: "Marketing",   Icon: Megaphone    },
  { href: "/accounting",   label: "Accounting",  Icon: BookOpen     },
  { href: "/performance",  label: "Snapshots",   Icon: BarChart2    },
  { href: "/settings",     label: "Settings",    Icon: Settings     },
  { href: "/leads",        label: "Leads",       Icon: Target       },
];

export function BotNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {botNav.map(item => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
            style={{ color: isActive ? "var(--accent)" : "var(--muted2)" }}
          >
            <item.Icon size={20} />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {item.label}
            </span>
            {isActive && (
              <span
                className="absolute bottom-0 w-6 h-0.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            )}
          </Link>
        );
      })}

      <button
        onClick={() => setMoreOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
        style={{ color: "var(--muted2)" }}
      >
        <AlignJustify size={20} />
        <span className="text-[10px] font-semibold uppercase tracking-wide">More</span>
      </button>

      {moreOpen && (
        <div
          className="fixed inset-0 z-[300] flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)" }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="rounded-t-3xl px-5 pt-5 pb-12"
            style={{
              background: "var(--card)",
              borderTop: "1px solid var(--border)",
              boxShadow: "var(--shadow-xl)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="w-10 h-1 rounded-full mx-auto mb-5"
              style={{ background: "var(--border2)" }}
            />
            <div className="flex items-center justify-between mb-5">
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--muted2)" }}
              >
                All Sections
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "var(--card2)", color: "var(--muted2)" }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {moreNav.map(item => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors"
                    style={{
                      background: isActive ? "var(--accent)" : "var(--card2)",
                      color: isActive ? "#fff" : "var(--muted)",
                      border: isActive ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <item.Icon size={22} />
                    <span className="text-xs font-semibold text-center leading-tight">
                      {item.label}
                    </span>
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
