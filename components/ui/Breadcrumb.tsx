import Link from "next/link";

type Crumb = { label: string; href?: string };

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs mb-4 flex-wrap" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span style={{ color: "var(--border)" }}>/</span>}
          {c.href && i < crumbs.length - 1 ? (
            <Link href={c.href} className="transition-colors hover:underline" style={{ color: "var(--muted2)" }}>
              {c.label}
            </Link>
          ) : (
            <span className="font-semibold" style={{ color: i === crumbs.length - 1 ? "var(--foreground)" : "var(--muted2)" }}>
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
