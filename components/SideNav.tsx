"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LucideIcon, LayoutDashboard, Target, Users, FileText, Package, Receipt, CalendarDays, TrendingDown, Megaphone, BookOpen, BarChart2, Settings, X, AlignJustify, Sparkles, Plus } from "lucide-react";
import { useFAB } from "@/components/FABContext";

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
  // centre slot is the FAB button
  { href: "/chat",      label: "Coco AI",  Icon: Sparkles         },
  { href: "/customers", label: "Clients",  Icon: Users            },
];

const moreNav = [
  { href: "/leads",        label: "Leads",      Icon: Target       },
  { href: "/quotes",       label: "Quotes",     Icon: FileText     },
  { href: "/products",     label: "Products",   Icon: Package      },
  { href: "/billing",      label: "Billing",    Icon: CalendarDays },
  { href: "/costs",        label: "Costs",      Icon: TrendingDown },
  { href: "/marketing",    label: "Marketing",  Icon: Megaphone    },
  { href: "/accounting",   label: "Accounting", Icon: BookOpen     },
  { href: "/performance",  label: "Snapshots",  Icon: BarChart2    },
  { href: "/settings",     label: "Settings",   Icon: Settings     },
];

const QUICK_ADDS = [
  { label: "New Lead",        icon: "📋", type: "lead"     },
  { label: "New Invoice",     icon: "🧾", type: "invoice"  },
  { label: "New Cost",        icon: "💸", type: "cost"     },
  { label: "Record Balance",  icon: "🏦", type: "cashflow" },
] as const;

export function BotNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { openModal } = useFAB();

  const NavItem = ({ href, label, Icon }: { href: string; label: string; Icon: LucideIcon }) => {
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className="relative flex-1 flex flex-col items-center justify-center gap-1 py-3 min-w-0"
        style={{ color: isActive ? "var(--accent)" : "var(--muted2)" }}
      >
        <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
        <span className="text-[10px] font-semibold tracking-wide leading-none truncate max-w-full px-1">
          {label}
        </span>
        {isActive && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
            style={{ background: "var(--accent)" }} />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Left two tabs */}
      {botNav.slice(0, 2).map(item => <NavItem key={item.href} {...item} />)}

      {/* Centre raised FAB button */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <button
          onClick={() => setAddOpen(true)}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{
            background: "var(--pink)",
            boxShadow: "0 4px 16px rgba(232,67,147,.55)",
            marginTop: -20,
          }}
          aria-label="Quick add"
        >
          <Plus size={26} color="#fff" strokeWidth={2.5} />
        </button>
        <span className="text-[10px] font-semibold mt-1 leading-none" style={{ color: "var(--pink)" }}>Add</span>
      </div>

      {/* Right two tabs */}
      {botNav.slice(2).map(item => <NavItem key={item.href} {...item} />)}

      {/* More button */}
      <button
        onClick={() => setMoreOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-w-0"
        style={{ color: "var(--muted2)" }}
      >
        <AlignJustify size={22} strokeWidth={1.8} />
        <span className="text-[10px] font-semibold tracking-wide leading-none">More</span>
      </button>

      {/* Quick-add action sheet */}
      {addOpen && (
        <div
          className="fixed inset-0 z-[300] flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)" }}
          onClick={() => setAddOpen(false)}
        >
          <div
            className="rounded-t-3xl px-5 pt-5"
            style={{
              background: "var(--card)",
              borderTop: "1px solid var(--border)",
              paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border)" }} />
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted2)" }}>
                Quick Add
              </span>
              <button onClick={() => setAddOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--card2)", color: "var(--muted2)" }}>
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              {QUICK_ADDS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => { setAddOpen(false); openModal(opt.type); }}
                  className="flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-semibold active:scale-[.97] transition-transform"
                  style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  <span className="text-2xl leading-none">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* More sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[300] flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)" }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="rounded-t-3xl px-5 pt-5"
            style={{
              background: "var(--card)",
              borderTop: "1px solid var(--border)",
              paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border)" }} />
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted2)" }}>
                All Sections
              </span>
              <button onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--card2)", color: "var(--muted2)" }}>
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {moreNav.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors active:scale-95"
                    style={{
                      background: isActive ? "var(--accent)" : "var(--card2)",
                      color: isActive ? "#fff" : "var(--muted)",
                      border: isActive ? "none" : "1px solid var(--border)",
                    }}>
                    <item.Icon size={22} />
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
