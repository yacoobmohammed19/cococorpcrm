"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export type MSOption = { label: string; value: string; color?: string };

interface Props {
  label: string;
  options: MSOption[];
  value: string[];
  onChange: (v: string[]) => void;
  minWidth?: number;
}

export function MultiSelect({ label, options, value, onChange, minWidth = 148 }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  }

  const n = value.length;
  const triggerLabel = n === 0
    ? label
    : n === 1
    ? (options.find(o => o.value === value[0])?.label ?? label)
    : `${label} (${n})`;

  const active = n > 0;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border outline-none whitespace-nowrap transition-colors"
        style={{
          background: active ? "color-mix(in srgb, var(--accent) 10%, var(--card2))" : "var(--card2)",
          borderColor: active ? "var(--accent)" : "var(--border)",
          color: active ? "var(--accent)" : "var(--muted)",
        }}
      >
        <span>{triggerLabel}</span>
        <ChevronDown
          size={11}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 mt-1 z-50 rounded-lg shadow-2xl overflow-hidden"
          style={{
            background: "var(--card2)",
            border: "1px solid var(--border)",
            top: "100%",
            minWidth,
            boxShadow: "0 8px 32px rgba(0,0,0,.25)",
          }}
        >
          {n > 0 && (
            <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs w-full text-left hover:underline"
                style={{ color: "var(--muted2)" }}
              >
                Clear all
              </button>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {options.map(opt => {
              const checked = value.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none transition-colors hover:bg-[var(--card3)]"
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: checked ? "var(--accent)" : "var(--card3)",
                      border: `1.5px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {checked && <Check size={10} color="#fff" strokeWidth={3} />}
                  </div>
                  <span
                    className="text-xs"
                    style={{ color: opt.color && checked ? opt.color : "var(--foreground)" }}
                  >
                    {opt.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
