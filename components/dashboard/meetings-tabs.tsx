"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { MeetingsTab } from "@/lib/dashboard/queries";
import { getMessages } from "@/lib/i18n";

/** Meetings tabs with counters; the underline slides to the active tab. */
export function MeetingsTabs({
  tabs,
  active,
  counts,
}: {
  tabs: MeetingsTab[];
  active: MeetingsTab;
  counts: Record<MeetingsTab, number>;
}) {
  const t = getMessages().dashboard.meetings;
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label={t.title} className="border-b border-divider">
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((key) => {
          const current = key === active;
          return (
            <li key={key} className="relative">
              <Link
                href={key === "upcoming" ? "/dashboard" : `/dashboard?tab=${key}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-touch items-center gap-2 text-label whitespace-nowrap transition-colors",
                  current ? "font-semibold text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {t.tabs[key]}
                <span
                  className={cn(
                    "min-w-6 rounded-full px-1.5 py-0.5 text-center text-caption font-semibold tabular-nums",
                    current ? "bg-brand-soft text-brand-soft-ink" : "bg-surface-soft text-ink-muted",
                  )}
                >
                  {counts[key]}
                </span>
              </Link>
              {current ? (
                <motion.span
                  layoutId="meetings-tab-underline"
                  aria-hidden="true"
                  transition={
                    reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }
                  }
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
