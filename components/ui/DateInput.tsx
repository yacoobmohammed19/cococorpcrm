"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import * as Popover from "@radix-ui/react-popover";
import { format, parseISO, isValid } from "date-fns";

type Props = {
  value: string;          // ISO date string "YYYY-MM-DD"
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;          // for hidden input compatibility with FormData
};

export function DateInput({ value, onChange, placeholder = "Pick a date", disabled, name }: Props) {
  const [open, setOpen] = useState(false);

  const parsed = value && isValid(parseISO(value)) ? parseISO(value) : undefined;

  const handleSelect = (day: Date | undefined) => {
    if (!day) return;
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="w-full flex items-center gap-2 px-3 py-2 rounded border text-sm text-left transition-colors"
            style={{
              background: "var(--background)",
              borderColor: open ? "var(--accent)" : "var(--border)",
              color: parsed ? "var(--foreground)" : "var(--muted2)",
              outline: "none",
            }}>
            <span className="text-base leading-none" style={{ color: "var(--muted2)" }}>📅</span>
            <span className="flex-1">{parsed ? format(parsed, "dd MMM yyyy") : placeholder}</span>
            {value && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); onChange(""); }}
                className="text-xs px-1 rounded hover:opacity-70"
                style={{ color: "var(--muted2)" }}>✕</span>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 rounded-xl shadow-2xl p-2"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
            onOpenAutoFocus={e => e.preventDefault()}>
            <DayPicker
              mode="single"
              selected={parsed}
              onSelect={handleSelect}
              defaultMonth={parsed}
              showOutsideDays
              styles={{
                root: { fontFamily: "inherit", color: "var(--foreground)" },
              }}
              classNames={{
                root: "p-1",
                months: "flex flex-col",
                month: "",
                month_caption: "flex items-center justify-between px-2 py-1 mb-1",
                caption_label: "text-sm font-semibold",
                nav: "flex items-center gap-1",
                button_previous: "w-7 h-7 rounded flex items-center justify-center text-sm hover:opacity-70",
                button_next: "w-7 h-7 rounded flex items-center justify-center text-sm hover:opacity-70",
                month_grid: "w-full",
                weekdays: "flex mb-1",
                weekday: "w-8 text-center text-xs font-semibold py-1",
                weeks: "",
                week: "flex",
                day: "w-8 h-8 flex items-center justify-center text-xs rounded-lg cursor-pointer transition-colors hover:opacity-80",
                day_button: "w-full h-full flex items-center justify-center",
                selected: "font-bold",
                today: "font-semibold",
                outside: "opacity-30",
                disabled: "opacity-20 cursor-not-allowed",
              }}
              modifiersStyles={{
                selected: { background: "var(--accent)", color: "#fff", borderRadius: "8px" },
                today: { color: "var(--accent)" },
              }}
            />
            <Popover.Arrow style={{ fill: "var(--border)" }} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
