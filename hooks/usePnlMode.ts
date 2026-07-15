"use client";

import { useSyncExternalStore } from "react";

/**
 * App-wide "P&L mode" lens over cost figures.
 *
 *   "pnl"   → exclude costs flagged `include_in_pnl = false` (owner draws, zakat,
 *             personal, etc.). Shows true *business* profitability. (default)
 *   "total" → include every cost. Shows the real cash-out view.
 *
 * Backed by localStorage and shared across every page via a module-level store
 * (same useSyncExternalStore approach as ThemeToggle — SSR-safe, no provider).
 * The control is rendered per-page (see PnlModeToggle) but the value is global,
 * so flipping it anywhere updates everywhere and persists across reloads.
 */
export type PnlMode = "pnl" | "total";

const KEY = "crm_pnl_mode";
const listeners = new Set<() => void>();

function read(): PnlMode {
  if (typeof window === "undefined") return "pnl";
  try {
    return localStorage.getItem(KEY) === "total" ? "total" : "pnl";
  } catch {
    return "pnl";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage); // cross-tab sync
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setPnlMode(mode: PnlMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
  listeners.forEach(l => l()); // same-tab sync
}

export function usePnlMode(): PnlMode {
  return useSyncExternalStore(subscribe, read, () => "pnl");
}

/** True when non-P&L costs should be counted (i.e. the "total" lens). */
export function includesAllCosts(mode: PnlMode): boolean {
  return mode === "total";
}
