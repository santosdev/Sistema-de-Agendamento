"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { fill, getMessages } from "@/lib/i18n";
import { THEME_KEY } from "./theme-script";

type Mode = "system" | "light" | "dark";

const ORDER: Mode[] = ["system", "light", "dark"];
const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;
const EVENT = "themechange";
const query = () => window.matchMedia("(prefers-color-scheme: dark)");

function read(): Mode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && query().matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Cycles system, light and dark. Renders a stable placeholder on the server. */
export function ThemeToggle({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const t = getMessages().common.theme;
  const mode = useSyncExternalStore<Mode | null>(subscribe, read, () => null);

  // Follow the OS while in system mode, and keep other tabs in sync.
  useEffect(() => {
    if (mode === null) return;
    apply(mode);
    if (mode !== "system") return;
    const mq = query();
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const next = useCallback(() => {
    const current = read();
    const value = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    try {
      if (value === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch {
      // Private mode: still switch for this page view.
    }
    apply(value);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const Icon = mode ? ICONS[mode] : null;
  const label = mode ? fill(t.label, { mode: t[mode] }) : t.title;

  return (
    <button
      type="button"
      onClick={next}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-touch shrink-0 items-center justify-center rounded-control transition-colors duration-(--duration-fast)",
        tone === "dark"
          ? "text-sidebar-ink hover:bg-sidebar-active hover:text-white"
          : "text-ink-secondary hover:bg-brand-soft hover:text-brand-soft-ink",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} /> : <span className="size-5" />}
    </button>
  );
}
