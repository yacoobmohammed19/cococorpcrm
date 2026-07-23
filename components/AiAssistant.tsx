"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

/** Header launcher for Coco AI — navigates to the full chat page. */
export function AiAssistant() {
  return (
    <Link
      href="/chat"
      aria-label="Ask Coco"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-transform active:scale-95"
      style={{
        background: "linear-gradient(135deg, var(--accent), var(--purple-c))",
        color: "#fff",
        boxShadow: "0 2px 10px rgba(236,72,153,.35)",
      }}>
      <Sparkles size={13} /> Ask Coco
    </Link>
  );
}
