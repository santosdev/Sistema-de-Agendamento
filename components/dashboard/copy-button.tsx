"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { getMessages } from "@/lib/i18n";

/** Copies a link and announces it (DESIGN.md 11: aria-live for "Link copiado"). */
export function CopyButton({
  value,
  tone = "light",
  label,
  className,
}: {
  value: string;
  tone?: "light" | "dark";
  label?: string;
  className?: string;
}) {
  const t = getMessages().dashboard;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link stays visible to copy by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "inline-flex h-touch items-center justify-center gap-2 rounded-control px-4 text-label font-semibold transition-colors",
        tone === "dark"
          ? "border border-sidebar-border text-white hover:bg-sidebar-active"
          : "border border-border bg-surface text-ink hover:bg-surface-soft",
        className,
      )}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      <span aria-live="polite">{copied ? t.copied : t.copyLink}</span>
    </button>
  );
}
