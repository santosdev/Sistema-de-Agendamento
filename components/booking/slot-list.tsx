"use client";

import { motion, useReducedMotion } from "motion/react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { STAGGER, DURATION, EASE } from "@/lib/design/tokens";
import { formatDayHeading, formatTime } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import type { LocalDate } from "@/lib/scheduling/time";

type Props = {
  date: LocalDate | null;
  slots: Date[];
  timeZone: string;
  selected: string | null;
  status: "loading" | "error" | "ready";
  onSelect: (iso: string) => void;
  onRetry: () => void;
};

/** Column 3 of the booking card (DESIGN.md 7.6). */
export function SlotList({ date, slots, timeZone, selected, status, onSelect, onRetry }: Props) {
  const t = getMessages();
  const reduceMotion = useReducedMotion();

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label={t.common.loading}>
        <Skeleton className="mb-1 h-6 w-40" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-control" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <Alert
        action={
          <Button variant="ghost" size="sm" onClick={onRetry} className="-my-2 -mr-2">
            {t.common.tryAgain}
          </Button>
        }
      >
        {t.booking.slots.loadError}
      </Alert>
    );
  }

  if (!date) {
    return <p className="text-label text-ink-muted">{t.booking.slots.pickDay}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-heading text-ink">{formatDayHeading(date)}</h2>
      {slots.length === 0 ? (
        <p className="text-label text-ink-muted">{t.booking.slots.emptyDay}</p>
      ) : (
        <ul
          key={`${date}|${timeZone}`}
          aria-label={t.booking.slots.heading}
          className="grid grid-cols-3 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
        >
          {slots.map((slot, i) => {
            const iso = slot.toISOString();
            const isSelected = iso === selected;
            return (
              <motion.li
                key={iso}
                initial={reduceMotion || i >= STAGGER.maxItems ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.base, ease: EASE.outSoft, delay: i * STAGGER.step }}
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(iso)}
                  className={cn(
                    "h-control w-full rounded-control border text-label tabular-nums transition-[border-color,background-color,color] duration-(--duration-fast)",
                    isSelected
                      ? "border-brand bg-slot-selected font-semibold text-brand shadow-[inset_0_0_0_1px_var(--color-brand)]"
                      : "border-border bg-surface font-medium text-ink hover:border-brand",
                  )}
                >
                  {formatTime(slot, timeZone)}
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
