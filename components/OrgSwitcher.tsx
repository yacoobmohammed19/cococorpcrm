"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Settings, LogOut, Building2, Check, Radar } from "lucide-react";
import { SubmitButton } from "@/components/Spinner";

type Org = { org_id: string; name: string };

export function UserProfileMenu({ orgs, activeOrgId, userEmail, userName, isSuperAdmin = false, setActiveOrganization, signout }: {
  orgs: Org[];
  activeOrgId: string;
  userEmail: string;
  userName: string;
  isSuperAdmin?: boolean;
  setActiveOrganization: (fd: FormData) => Promise<void>;
  signout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const activeOrg = orgs.find(o => o.org_id === activeOrgId) ?? orgs[0];
  const initial = (userName || userEmail).slice(0, 1).toUpperCase();

  // Close the menu when navigation completes (e.g. after switching org or
  // signing out) using the render-phase "adjust state on change" pattern —
  // NOT an effect (that trips the set-state-in-effect rule), and NOT the submit
  // button's onClick (that unmounts the <form> mid-click and cancels the action).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors hover:bg-[var(--card3)]"
        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
      >
        {/* Avatar */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
          style={{ background: "linear-gradient(135deg,#EC4899,#DB2777)", color: "#fff" }}
        >
          {initial}
        </div>
        {/* Org name */}
        <span className="font-semibold text-xs truncate max-w-[140px] hidden sm:block" style={{ color: "var(--foreground)" }}>
          {activeOrg?.name ?? ""}
        </span>
        <ChevronDown
          size={13}
          style={{ color: "var(--muted2)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s", flexShrink: 0 }}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl shadow-xl overflow-hidden"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
          >
            {/* User info */}
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                  style={{ background: "linear-gradient(135deg,#EC4899,#DB2777)", color: "#fff", boxShadow: "0 0 10px rgba(236,72,153,0.3)" }}
                >
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{userName || "User"}</p>
                  <p className="text-xs truncate" style={{ color: "var(--muted2)" }}>{userEmail}</p>
                </div>
              </div>
            </div>

            {/* Org switcher section */}
            {orgs.length > 0 && (
              <div className="border-b" style={{ borderColor: "var(--border)" }}>
                <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>
                  Organisation
                </p>
                {orgs.map(o => {
                  const isActive = o.org_id === activeOrgId;
                  return isActive ? (
                    <div key={o.org_id} className="flex items-center gap-2.5 px-3 py-2 text-xs"
                      style={{ color: "var(--accent)", background: "rgba(236,72,153,0.06)" }}>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                        style={{ background: "rgba(236,72,153,0.2)", color: "var(--accent)" }}>
                        {o.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="flex-1 font-semibold truncate">{o.name}</span>
                      <Check size={12} />
                    </div>
                  ) : (
                    <form key={o.org_id} action={setActiveOrganization}>
                      <input type="hidden" name="org_id" value={o.org_id} />
                      <SubmitButton
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[var(--card3)]"
                        style={{ color: "var(--foreground)" }}>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                          style={{ background: "var(--card3)", color: "var(--muted2)" }}>
                          {o.name.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="flex-1 text-left truncate">{o.name}</span>
                      </SubmitButton>
                    </form>
                  );
                })}
                <Link href="/settings/organisations" onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-[var(--card3)]"
                  style={{ color: "var(--muted2)" }}>
                  <Building2 size={12} />
                  Manage organisations
                </Link>
              </div>
            )}

            {/* Actions */}
            <div className="py-1">
              {isSuperAdmin && (
                <Link href="/admin" onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold transition-colors hover:bg-[var(--card3)]"
                  style={{ color: "var(--accent)" }}>
                  <Radar size={14} style={{ color: "var(--accent)" }} />
                  Control Tower
                </Link>
              )}
              <Link href="/settings" onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--card3)]"
                style={{ color: "var(--foreground)" }}>
                <Settings size={14} style={{ color: "var(--muted2)" }} />
                Settings
              </Link>
              <form action={signout}>
                <SubmitButton
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--card3)]"
                  style={{ color: "var(--foreground)" }}>
                  <LogOut size={14} style={{ color: "var(--muted2)" }} />
                  Sign out
                </SubmitButton>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
