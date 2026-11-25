"use client";

import { useMemo, useState } from "react";
import { Calendar, shiftMonth } from "@/components/booking/calendar";
import { SlotList } from "@/components/booking/slot-list";
import { TimeZonePicker } from "@/components/booking/time-zone-picker";
import { useMonthSlots, type YearMonth } from "@/components/booking/use-month-slots";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatLongDate, formatTime } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";
import { localDateOf, type LocalDate } from "@/lib/scheduling/time";

type Props = {
  /** Guest flow: the manage token. Host flow: the booking id (signed in). */
  token?: string;
  bookingId?: string;
  /** Overrides the default heading (host flow names the guest). */
  title?: string;
  username: string;
  eventSlug: string;
  /** Current start of the booking, shown so the guest knows what is being replaced. */
  currentStartAt: string;
  timeZone: string;
  onTimeZoneChange: (zone: string) => void;
  pending: boolean;
  error: string | null;
  onConfirm: (startAt: string) => void;
  onCancel: () => void;
};

const monthOf = (date: LocalDate): YearMonth => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
});

/** Picks a new time for an existing booking (RN-52 to RN-55). */
export function ReschedulePanel(props: Props) {
  const { token, bookingId, username, eventSlug, currentStartAt, timeZone, pending, error } = props;
  const t = getMessages();
  const [now] = useState(() => new Date());
  const today = localDateOf(now, timeZone);
  const [month, setMonth] = useState<YearMonth>(monthOf(today));
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const { state, reload } = useMonthSlots({ username, eventSlug, timeZone, month, token, bookingId });
  // The booking does not block itself, so its current time comes back as free: hide it.
  const days = useMemo(() => {
    if (state.status !== "ready") return null;
    const current = new Date(currentStartAt).getTime();
    const entries = state.days
      .map((d) => [d.date, d.slots.filter((slot) => slot.getTime() !== current)] as const)
      .filter(([, slots]) => slots.length > 0);
    return new Map(entries);
  }, [state, currentStartAt]);

  // Shown day: the guest's choice when it has slots, else the first free day of the month.
  const activeDate = days
    ? selectedDate && days.has(selectedDate)
      ? selectedDate
      : ([...days.keys()][0] ?? null)
    : null;

  return (
    <section aria-labelledby="reschedule-title" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="reschedule-title"
            tabIndex={-1}
            className="font-display text-heading text-ink focus:outline-none"
          >
            {props.title ?? t.manage.rescheduleFlow.title}
          </h2>
          <p className="text-caption text-ink-muted">
            {fill(t.manage.rescheduleFlow.current, {
              time: `${formatLongDate(currentStartAt, timeZone)}, ${formatTime(currentStartAt, timeZone)}`,
            })}
          </p>
        </div>
        <TimeZonePicker value={timeZone} onChange={props.onTimeZoneChange} />
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_220px]">
        <Calendar
          month={month}
          minMonth={monthOf(today)}
          maxMonth={shiftMonth(monthOf(today), 12)}
          today={today}
          availableDays={days ? new Set(days.keys()) : null}
          selected={activeDate}
          onSelect={setSelectedDate}
          onMonthChange={(next) => {
            setMonth(next);
            setSelectedDate(null);
          }}
        />
        <div className="sm:max-h-[26rem] sm:overflow-y-auto sm:border-l sm:border-divider sm:pl-6">
          <SlotList
            date={activeDate}
            slots={activeDate && days ? (days.get(activeDate) ?? []) : []}
            timeZone={timeZone}
            selected={selectedSlot}
            status={state.status === "error" ? "error" : days ? "ready" : "loading"}
            onSelect={setSelectedSlot}
            onRetry={reload}
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={props.onCancel} disabled={pending}>
          {t.manage.rescheduleFlow.cancel}
        </Button>
        <Button
          size="lg"
          disabled={!selectedSlot}
          loading={pending}
          onClick={() => selectedSlot && props.onConfirm(selectedSlot)}
        >
          {pending
            ? t.manage.rescheduleFlow.confirming
            : selectedSlot
              ? fill(t.manage.rescheduleFlow.confirm, { time: formatTime(selectedSlot, timeZone) })
              : t.booking.slots.chooseTime}
        </Button>
      </div>
    </section>
  );
}
