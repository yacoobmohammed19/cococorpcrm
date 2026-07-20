"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon, LayoutDashboard, Target, Users, FileText, Package, Receipt, CalendarDays, TrendingDown, Megaphone, BookOpen, BarChart2, Settings, Sparkles, Building2, FlaskConical, TableProperties, Radar, History } from "lucide-react";

type NavItem = { href: string; label: string; Icon: LucideIcon; group: string };

const sideNav: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard",  Icon: LayoutDashboard, group: "Overview"   },
  { href: "/leads",       label: "Leads",       Icon: Target,          group: "CRM"        },
  { href: "/customers",   label: "Customers",   Icon: Users,           group: "CRM"        },
  { href: "/quotes",      label: "Quotes",      Icon: FileText,        group: "CRM"        },
  { href: "/products",    label: "Products",    Icon: Package,         group: "Catalog"    },
  { href: "/rd",          label: "R&D",         Icon: FlaskConical,    group: "Catalog"    },
  { href: "/invoices",    label: "Invoices",    Icon: Receipt,         group: "Finance"    },
  { href: "/billing",     label: "Billing",     Icon: CalendarDays,    group: "Finance"    },
  { href: "/costs",       label: "Costs",       Icon: TrendingDown,    group: "Finance"    },
  { href: "/marketing",   label: "Marketing",   Icon: Megaphone,       group: "Marketing"  },
  { href: "/timeline",    label: "Timeline",    Icon: History,            group: "Analytics"  },
  { href: "/accounting",  label: "Accounting",  Icon: BookOpen,           group: "Analytics"  },
  { href: "/performance", label: "Snapshots",   Icon: BarChart2,          group: "Analytics"  },
  { href: "/reports",     label: "Reports",     Icon: TableProperties,    group: "Analytics"  },
  { href: "/settings",             label: "Settings",     Icon: Settings,    group: "Config" },
  { href: "/settings/organisations", label: "Organisations", Icon: Building2, group: "Config" },
  { href: "/chat",                 label: "Coco AI",      Icon: Sparkles,    group: "Config" },
];

const controlTowerItem: NavItem = { href: "/admin", label: "Control Tower", Icon: Radar, group: "Platform" };

// Paths operators are allowed to access
const OPERATOR_ALLOWED = new Set(["/dashboard", "/leads", "/chat"]);

const groups = ["Overview", "CRM", "Catalog", "Finance", "Marketing", "Analytics", "Config", "Platform"];

export function SideNav({ collapsed = false, role, isSuperAdmin = false }: { collapsed?: boolean; role?: string | null; isSuperAdmin?: boolean }) {
  const pathname = usePathname();

  const baseNav = isSuperAdmin ? [...sideNav, controlTowerItem] : sideNav;
  const visibleNav = role === "operator"
    ? baseNav.filter(n => OPERATOR_ALLOWED.has(n.href))
    : baseNav;

  return (
    <nav
      className="flex-1 overflow-y-auto"
      style={{ padding: collapsed ? "0.5rem 0.375rem" : "0.75rem 0.5rem" }}
    >
      {groups.map((group, gi) => {
        const items = visibleNav.filter(n => n.group === group);
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
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover)"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {isActive && !collapsed && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: "var(--sidebar-indicator)", width: "3px", height: "18px" }}
                    />
                  )}
                  {isActive && collapsed && (
                    <span
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--sidebar-indicator)" }}
                    />
                  )}
                  <item.Icon
                    size={15}
                    className="shrink-0"
                    style={{
                      color: isActive ? "var(--sidebar-indicator)" : "var(--sidebar-fg)",
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

// 5 tabs: Home | Invoices | Coco AI (centre) | Clients | Leads
const botNav: { href: string; label: string; Icon: LucideIcon; centre?: boolean }[] = [
  { href: "/dashboard", label: "Home",     Icon: LayoutDashboard },
  { href: "/invoices",  label: "Invoices", Icon: Receipt          },
  { href: "/chat",      label: "Coco AI",  Icon: Sparkles, centre: true },
  { href: "/customers", label: "Clients",  Icon: Users            },
  { href: "/leads",     label: "Leads",    Icon: Target           },
];

const operatorBotNav: { href: string; label: string; Icon: LucideIcon; centre?: boolean }[] = [
  { href: "/dashboard", label: "Home",   Icon: LayoutDashboard },
  { href: "/chat",      label: "Coco AI", Icon: Sparkles, centre: true },
  { href: "/leads",     label: "Leads",  Icon: Target           },
];

export function BotNav({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const nav = role === "operator" ? operatorBotNav : botNav;

  return (
    <>
      {nav.map(item => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

        if (item.centre) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 relative"
            >
              <div
                className="w-12 h-9 rounded-2xl flex items-center justify-center transition-all"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, var(--accent), var(--purple-c))"
                    : "rgba(236,72,153,.12)",
                  boxShadow: isActive ? "0 2px 12px rgba(236,72,153,.4)" : undefined,
                }}
              >
                <item.Icon
                  size={18}
                  strokeWidth={2}
                  style={{ color: isActive ? "#fff" : "var(--accent)" }}
                />
              </div>
              <span
                className="text-[10px] font-bold tracking-wide leading-none"
                style={{ color: isActive ? "var(--accent)" : "var(--muted2)" }}
              >
                Coco AI
              </span>
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
              )}
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex-1 flex flex-col items-center justify-center gap-1 py-3 min-w-0"
            style={{ color: isActive ? "var(--accent)" : "var(--muted2)" }}
          >
            <item.Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
            <span className="text-[10px] font-semibold tracking-wide leading-none truncate max-w-full px-1">
              {item.label}
            </span>
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            )}
          </Link>
        );
      })}
    </>
  );
}
