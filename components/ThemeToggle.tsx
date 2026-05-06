"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
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
