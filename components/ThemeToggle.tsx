"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

// The dark class lives on <html>, mutated here and by the inline theme script.
// Subscribing to it (rather than mirroring into state via an effect) keeps the
// toggle in sync with the actual DOM and is SSR-safe via the server snapshot.
function subscribeDark(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
function getDarkSnapshot() {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const dark = useSyncExternalStore(subscribeDark, getDarkSnapshot, () => false);

  const toggle = () => {
    const next = !dark;
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors"
      style={{
        color: "var(--sidebar-fg)",
        justifyContent: collapsed ? "center" : undefined,
        padding: collapsed ? "0.625rem" : undefined,
      }}
    >
      {dark
        ? <Sun size={15} className="shrink-0" />
        : <Moon size={15} className="shrink-0" />}
      {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
