"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, Users, type LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", Icon: LayoutGrid },
  { href: "/admin/organisations", label: "Organisations", Icon: Building2 },
  { href: "/admin/users", label: "Users", Icon: Users },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
      {TABS.map(({ href, label, Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors"
            style={{
              color: active ? "#fff" : "rgba(245,244,242,0.6)",
              borderBottom: `2px solid ${active ? "var(--pink)" : "transparent"}`,
            }}
          >
            <Icon size={15} style={{ color: active ? "var(--pink)" : "rgba(245,244,242,0.55)" }} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
