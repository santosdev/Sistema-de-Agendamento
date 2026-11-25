"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { formatDayLabel, formatMonthYear, weekdayNames } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { addDays, weekdayOf, type LocalDate } from "@/lib/scheduling/time";
import type { YearMonth } from "./use-month-slots";

type Props = {
  month: YearMonth;
  minMonth: YearMonth;
  maxMonth: YearMonth;
  today: LocalDate;
  /** Days with at least one free slot (guest calendar). null while loading. */
  availableDays: Set<LocalDate> | null;
  selected: LocalDate | null;
  onSelect: (date: LocalDate) => void;
  onMonthChange: (month: YearMonth) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const compareMonth = (a: YearMonth, b: YearMonth) => a.year * 12 + a.month - (b.year * 12 + b.month);
export const shiftMonth = ({ year, month }: YearMonth, delta: number): YearMonth => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};
const monthOf = (date: LocalDate): YearMonth => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
});

export function Calendar({
  month,
  minMonth,
  maxMonth,
  today,
  availableDays,
  selected,
  onSelect,
  onMonthChange,
}: Props) {
  const t = getMessages().booking.calendar;
  const weekdays = useMemo(() => weekdayNames(), []);
  const gridRef = useRef<HTMLDivElement>(null);

  const first = toDate(month.year, month.month, 1);
  const total = daysInMonth(month.year, month.month);
  const leading = weekdayOf(first); // weeks start on Sunday (RN-77)

  const inMonth = (date: LocalDate | null) => !!date && date.startsWith(first.slice(0, 8));
  const firstAvailable = useMemo(() => {
    if (!availableDays) return null;
    for (let d = 1; d <= total; d++) {
      const date = toDate(month.year, month.month, d);
      if (availableDays.has(date)) return date;
    }
    return null;
  }, [availableDays, month.year, month.month, total]);

  // Roving tabindex: one focusable day.
  const [focused, setFocused] = useState<LocalDate>(first);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const tabbable = inMonth(focused) ? focused : inMonth(selected) ? selected! : (firstAvailable ?? first);

  useEffect(() => {
    if (!keyboardNav) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused, keyboardNav, month]);

  const canPrev = compareMonth(month, minMonth) > 0;
  const canNext = compareMonth(month, maxMonth) < 0;

  function move(date: LocalDate) {
    const target = monthOf(date);
    if (compareMonth(target, minMonth) < 0 || compareMonth(target, maxMonth) > 0) return;
    setKeyboardNav(true);
    setFocused(date);
    if (compareMonth(target, month) !== 0) onMonthChange(target);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: LocalDate) {
    const weekday = weekdayOf(date);
    const day = Number(date.slice(8, 10));
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(addDays(date, -1)),
      ArrowRight: () => move(addDays(date, 1)),
      ArrowUp: () => move(addDays(date, -7)),
      ArrowDown: () => move(addDays(date, 7)),
      Home: () => move(addDays(date, -weekday)),
      End: () => move(addDays(date, 6 - weekday)),
      PageUp: () => {
        const prev = shiftMonth(month, -1);
        move(toDate(prev.year, prev.month, Math.min(day, daysInMonth(prev.year, prev.month))));
      },
      PageDown: () => {
        const next = shiftMonth(month, 1);
        move(toDate(next.year, next.month, Math.min(day, daysInMonth(next.year, next.month))));
      },
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  const cells: (LocalDate | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: total }, (_, i) => toDate(month.year, month.month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const monthLabel = formatMonthYear(month.year, month.month);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="calendar-month" className="font-display text-heading text-ink" aria-live="polite">
          {monthLabel}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            disabled={!canPrev}
            aria-label={t.previousMonth}
            className="inline-flex size-touch items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-brand-soft hover:text-brand-soft-ink disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            disabled={!canNext}
            aria-label={t.nextMonth}
            className="inline-flex size-touch items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-brand-soft hover:text-brand-soft-ink disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      <div ref={gridRef} role="grid" aria-labelledby="calendar-month" className="flex flex-col gap-1">
        <div role="row" className="grid grid-cols-7 gap-1">
          {weekdays.map((w) => (
            <div
              key={w.long}
              role="columnheader"
              className="py-1 text-center text-caption font-medium text-ink-muted"
            >
              <abbr title={w.long} className="no-underline">
                {w.short}
              </abbr>
            </div>
          ))}
        </div>

        {weeks.map((week, i) => (
          <div key={i} role="row" className="grid grid-cols-7 gap-1">
            {week.map((date, j) => {
              if (!date) return <div key={`empty-${j}`} role="gridcell" aria-hidden="true" />;

              const loading = availableDays === null;
              const available = !!availableDays?.has(date);
              const isSelected = date === selected;
              const isToday = date === today;
              const label = [
                formatDayLabel(date),
                isToday ? t.today : null,
                loading ? null : available ? t.available : t.unavailable,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <div key={date} role="gridcell" aria-selected={isSelected || undefined}>
                  <button
                    type="button"
                    data-date={date}
                    tabIndex={date === tabbable ? 0 : -1}
                    aria-label={label}
                    aria-disabled={!available || undefined}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => {
                      setFocused(date);
                      setKeyboardNav(false);
                      if (available) onSelect(date);
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && !available) event.preventDefault();
                      onKeyDown(event, date);
                    }}
                    className={cn(
                      "relative flex aspect-square min-h-touch w-full items-center justify-center rounded-control text-label tabular-nums",
                      "transition-[background-color,color,transform,box-shadow] duration-(--duration-base) ease-out-soft",
                      loading && "text-ink-muted",
                      !loading && !available && "cursor-default text-ink-disabled",
                      available &&
                        !isSelected &&
                        "bg-brand-soft font-semibold text-brand-soft-ink hover:shadow-[inset_0_0_0_1px_var(--color-brand)]",
                      isSelected && "scale-100 bg-brand font-semibold text-white",
                    )}
                  >
                    {Number(date.slice(8, 10))}
                    {isToday ? (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1.5 size-1 rounded-full bg-current"
                      />
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {selected && inMonth(selected) ? `${formatDayLabel(selected)}, ${t.selected}` : ""}
      </p>
    </div>
  );
}
