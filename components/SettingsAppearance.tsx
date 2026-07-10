"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";

const ACCENTS = [
  { label: "Emerald",  color: "#10B981", hover: "#059669" },
  { label: "Blue",     color: "#3B82F6", hover: "#2563EB" },
  { label: "Violet",   color: "#8B5CF6", hover: "#7C3AED" },
  { label: "Rose",     color: "#F43F5E", hover: "#E11D48" },
  { label: "Amber",    color: "#F59E0B", hover: "#D97706" },
  { label: "Cyan",     color: "#06B6D4", hover: "#0891B2" },
  { label: "Pink",     color: "#EC4899", hover: "#DB2777" },
  { label: "Slate",    color: "#64748B", hover: "#475569" },
];

const RADIUS_PRESETS = [
  {
    key: "sharp", label: "Sharp", preview: "4px",
    vars: { "--radius-sm": "2px", "--radius": "3px", "--radius-md": "4px", "--radius-lg": "6px", "--radius-xl": "8px", "--radius-2xl": "10px" },
  },
  {
    key: "rounded", label: "Rounded", preview: "8px",
    vars: { "--radius-sm": "4px", "--radius": "6px", "--radius-md": "8px", "--radius-lg": "10px", "--radius-xl": "12px", "--radius-2xl": "16px" },
  },
  {
    key: "pill", label: "Pill", preview: "16px",
    vars: { "--radius-sm": "8px", "--radius": "12px", "--radius-md": "14px", "--radius-lg": "16px", "--radius-xl": "20px", "--radius-2xl": "24px" },
  },
];

const DENSITIES = [
  { key: "compact",     label: "Compact",     desc: "Tighter padding, more content visible" },
  { key: "comfortable", label: "Comfortable", desc: "Default spacing — balanced" },
  { key: "spacious",    label: "Spacious",    desc: "Roomier layout, easier scanning" },
];

function applyAccent(color: string, hover: string) {
  const r = document.documentElement;
  r.style.setProperty("--accent", color);
  r.style.setProperty("--accent-hover", hover);
  r.style.setProperty("--accent-fg", "#ffffff");
  r.style.setProperty("--sidebar-indicator", color);
  r.style.setProperty("--accent-glow", color + "30");
  r.style.setProperty("--accent-subtle", color + "14");
  r.style.setProperty("--sidebar-active", color + "20");
  try { localStorage.setItem("crm_accent", JSON.stringify({ color, hover })); } catch { /* ignore */ }
}

function applyRadius(preset: typeof RADIUS_PRESETS[number]) {
  const r = document.documentElement;
  Object.entries(preset.vars).forEach(([k, v]) => r.style.setProperty(k, v));
  try { localStorage.setItem("crm_radius", JSON.stringify({ key: preset.key, vars: preset.vars })); } catch { /* ignore */ }
}

function applyDensity(key: string) {
  document.documentElement.setAttribute("data-density", key);
  try { localStorage.setItem("crm_density", key); } catch { /* ignore */ }
}

export function SettingsAppearance() {
  const [accentColor, setAccentColor] = useState("#EC4899");
  const [radiusKey, setRadiusKey] = useState("rounded");
  const [densityKey, setDensityKey] = useState("comfortable");
  const [glowEnabled, setGlowEnabled] = useState(true);

  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem("crm_accent") || "null");
      if (a?.color) setAccentColor(a.color);

      const rp = JSON.parse(localStorage.getItem("crm_radius") || "null");
      if (rp?.key) setRadiusKey(rp.key);

      const d = localStorage.getItem("crm_density");
      if (d) setDensityKey(d);

      const g = localStorage.getItem("crm_glow");
      if (g !== null) setGlowEnabled(g !== "false");
    } catch { /* ignore */ }
  }, []);

  function handleAccent(color: string, hover: string) {
    setAccentColor(color);
    applyAccent(color, hover);
    if (!glowEnabled) {
      document.documentElement.style.setProperty("--accent-glow", "transparent");
      document.documentElement.style.setProperty("--accent-subtle", "transparent");
    }
  }

  function handleRadius(preset: typeof RADIUS_PRESETS[number]) {
    setRadiusKey(preset.key);
    applyRadius(preset);
  }

  function handleDensity(key: string) {
    setDensityKey(key);
    applyDensity(key);
  }

  function handleGlow(enabled: boolean) {
    setGlowEnabled(enabled);
    const accent = ACCENTS.find(a => a.color === accentColor) || ACCENTS[0];
    if (enabled) {
      document.documentElement.style.setProperty("--accent-glow", accentColor + "30");
      document.documentElement.style.setProperty("--accent-subtle", accentColor + "14");
      document.documentElement.style.setProperty("--sidebar-active", accentColor + "20");
    } else {
      document.documentElement.style.setProperty("--accent-glow", "transparent");
      document.documentElement.style.setProperty("--accent-subtle", "transparent");
      document.documentElement.style.setProperty("--sidebar-active", "rgba(255,255,255,0.06)");
    }
    try { localStorage.setItem("crm_glow", String(enabled)); } catch { /* ignore */ }
    void accent;
  }

  const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)" };
  const lbl = { color: "var(--muted2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em" };

  return (
    <div className="space-y-6">

      {/* Accent Colour */}
      <div className="p-5 space-y-4" style={card}>
        <div>
          <p style={lbl}>Accent Colour</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Applied to buttons, active states, and highlights across the app</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map(a => {
            const active = accentColor === a.color;
            return (
              <button
                key={a.label}
                onClick={() => handleAccent(a.color, a.hover)}
                title={a.label}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: a.color,
                    boxShadow: active ? `0 0 0 3px var(--background), 0 0 0 5px ${a.color}` : undefined,
                    transform: active ? "scale(1.1)" : undefined,
                  }}
                >
                  {active && <Check size={16} color="#fff" strokeWidth={3} />}
                </div>
                <span className="text-[10px] font-medium" style={{ color: active ? "var(--foreground)" : "var(--muted2)" }}>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Border Radius */}
      <div className="p-5 space-y-4" style={card}>
        <div>
          <p style={lbl}>Corner Radius</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Controls how rounded cards, buttons, and inputs appear</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {RADIUS_PRESETS.map(p => {
            const active = radiusKey === p.key;
            return (
              <button
                key={p.key}
                onClick={() => handleRadius(p)}
                className="flex flex-col items-center gap-3 p-4 border-2 transition-all"
                style={{
                  borderRadius: 12,
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--accent-subtle)" : "var(--card2)",
                }}
              >
                {/* Preview box */}
                <div
                  className="w-12 h-8 border-2"
                  style={{
                    borderRadius: p.preview,
                    borderColor: active ? "var(--accent)" : "var(--border2)",
                    background: active ? "var(--accent-glow)" : "var(--card3)",
                  }}
                />
                <span className="text-xs font-semibold" style={{ color: active ? "var(--accent)" : "var(--muted)" }}>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Density */}
      <div className="p-5 space-y-4" style={card}>
        <div>
          <p style={lbl}>Interface Density</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Controls padding and spacing throughout the interface</p>
        </div>
        <div className="space-y-2">
          {DENSITIES.map(d => {
            const active = densityKey === d.key;
            return (
              <button
                key={d.key}
                onClick={() => handleDensity(d.key)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--accent-subtle)" : "var(--card2)",
                }}
              >
                <div
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: active ? "var(--accent)" : "var(--border2)" }}
                >
                  {active && <div className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: active ? "var(--accent)" : "var(--foreground)" }}>{d.label}</p>
                  <p className="text-xs" style={{ color: "var(--muted2)" }}>{d.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Glow Effects */}
      <div className="p-5" style={card}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p style={lbl}>Glow & Bloom Effects</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Subtle glow behind active nav items, buttons, and KPI cards</p>
          </div>
          <button
            onClick={() => handleGlow(!glowEnabled)}
            className="relative flex-shrink-0 rounded-full transition-all"
            style={{ width: 44, height: 24, background: glowEnabled ? "var(--accent)" : "var(--border)", boxShadow: glowEnabled ? "0 0 10px var(--accent-glow)" : undefined }}
          >
            <span
              className="absolute top-1 rounded-full transition-all"
              style={{ width: 16, height: 16, background: "#fff", left: glowEnabled ? 24 : 4, boxShadow: "0 1px 3px rgba(0,0,0,.3)" }}
            />
          </button>
        </div>
      </div>

      {/* Reset */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            handleAccent("#EC4899", "#DB2777");
            handleRadius(RADIUS_PRESETS[1]);
            handleDensity("comfortable");
            handleGlow(true);
          }}
          className="text-xs px-4 py-2 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--muted2)" }}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
