"use client";

import { ArrowLeft } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createBookingAction } from "@/lib/booking/actions";
import type { CreatedBooking, PublicEvent, PublicHost } from "@/lib/booking/types";
import { DURATION, EASE } from "@/lib/design/tokens";
import { formatMonthName, formatTime, timeZoneName } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";
import { DAY_MS, localDateOf, type LocalDate } from "@/lib/scheduling/time";
import { Calendar, shiftMonth } from "./calendar";
import { Confirmation } from "./confirmation";
import { EventSummary } from "./event-summary";
import { GuestForm, type GuestFormOutput } from "./guest-form";
import { Progress, type Step } from "./progress";
import { SlotList } from "./slot-list";
import { TimeZonePicker } from "./time-zone-picker";
import { useGuestTimeZone } from "./use-guest-time-zone";
import { useMonthSlots, type YearMonth } from "./use-month-slots";

type Props = { host: PublicHost; event: PublicEvent; embed: boolean };

const FORM_ID = "guest-form";
const monthOf = (date: LocalDate): YearMonth => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
});
const sameMonth = (a: YearMonth, b: YearMonth) => a.year === b.year && a.month === b.month;

const stepMotion = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: DURATION.slow, ease: EASE.outSoft },
};

export function BookingFlow({ host, event, embed }: Props) {
  const t = getMessages();
  const [timeZone, setTimeZone] = useGuestTimeZone();
  const [now] = useState(() => new Date());

  const [step, setStep] = useState<Step>("pick");
  const [month, setMonth] = useState<YearMonth | null>(null);
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [zoneMessage, setZoneMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [booking, setBooking] = useState<CreatedBooking | null>(null);
  const autoAdvanced = useRef(false);
  const headingRef = useRef<HTMLDivElement>(null);

  const today = timeZone ? localDateOf(now, timeZone) : null;
  const minMonth = today ? monthOf(today) : null;
  const maxMonth = timeZone
    ? monthOf(localDateOf(now.getTime() + event.maxDaysAhead * DAY_MS, timeZone))
    : null;
  const currentMonth = month ?? minMonth;

  const { state, reload } = useMonthSlots({
    username: host.username,
    eventSlug: event.slug,
    timeZone,
    month: currentMonth ?? { year: 1970, month: 1 },
    // If the first month has no free time at all, move to the next month once.
    onLoaded: (loaded) => {
      if (autoAdvanced.current) return;
      autoAdvanced.current = true;
      if (loaded.length === 0 && currentMonth && maxMonth && !sameMonth(currentMonth, maxMonth)) {
        setMonth(shiftMonth(currentMonth, 1));
      }
    },
  });

  const days = useMemo(
    () => (state.status === "ready" ? new Map(state.days.map((d) => [d.date, d.slots])) : null),
    [state],
  );

  // Shown day: the guest's choice when it has slots, else the first free day of the month.
  const activeDate = days
    ? selectedDate && days.has(selectedDate)
      ? selectedDate
      : ([...days.keys()][0] ?? null)
    : null;

  // RN-75: inside the inline iframe, tell the parent page our height so it can grow without scrollbars.
  useEffect(() => {
    if (!embed || window.parent === window) return;
    const post = () =>
      window.parent.postMessage(
        { type: "techresolute:resize", height: document.documentElement.scrollHeight },
        "*",
      );
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    post();
    return () => observer.disconnect();
  }, [embed]);

  // Move focus to the new step heading (keyboard and screen reader users).
  // Waits for the exit animation (AnimatePresence mode="wait") before focusing.
  useEffect(() => {
    if (step === "pick") return;
    const timer = setTimeout(
      () => {
        headingRef.current?.querySelector<HTMLElement>("h1, h2")?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      DURATION.slow * 1000 + 40,
    );
    return () => clearTimeout(timer);
  }, [step]);

  function changeTimeZone(zone: string) {
    setTimeZone(zone);
    if (selectedSlot) setSelectedDate(localDateOf(new Date(selectedSlot), zone));
    setZoneMessage(fill(t.booking.timeZone.changed, { zone: timeZoneName(zone) }));
  }

  function changeMonth(next: YearMonth) {
    autoAdvanced.current = true;
    setMonth(next);
    setSelectedDate(null);
  }

  async function submit(values: GuestFormOutput) {
    if (!selectedSlot || !timeZone) return;
    setSubmitting(true);
    setServerError(null);
    // A network failure rejects the call; treat it like any other unknown error.
    const result = await createBookingAction({
      username: host.username,
      eventSlug: event.slug,
      startAt: selectedSlot,
      timeZone,
      guest: values,
    }).catch(() => ({ ok: false, error: "unknown" }) as const);
    setSubmitting(false);

    if (result.ok) {
      setBooking(result.booking);
      setStep("done");
      if (embed) {
        window.parent.postMessage(
          { type: "techresolute:booking-confirmed", startAt: result.booking.startAt },
          "*",
        );
      }
      return;
    }

    const message = t.booking.errors[result.error];
    if (["slot_taken", "slot_unavailable", "daily_limit_reached"].includes(result.error)) {
      // Back to the calendar with fresh availability.
      setNotice(message);
      setSelectedSlot(null);
      setStep("pick");
      reload();
    } else {
      setServerError(message);
    }
  }

  function bookAnother() {
    setBooking(null);
    setSelectedSlot(null);
    setNotice(null);
    setStep("pick");
    reload();
  }

  const selectedEnd = selectedSlot
    ? new Date(new Date(selectedSlot).getTime() + event.durationMinutes * 60_000).toISOString()
    : null;
  const daySlots = activeDate && days ? (days.get(activeDate) ?? []) : [];
  const emptyMonth = days !== null && days.size === 0 && currentMonth;
  const canGoNext = currentMonth && maxMonth && !sameMonth(currentMonth, maxMonth);

  const continueLabel =
    selectedSlot && timeZone
      ? fill(t.booking.slots.continueWith, { time: formatTime(selectedSlot, timeZone) })
      : t.booking.slots.chooseTime;

  return (
    <MotionConfig reducedMotion="user">
      {embed ? null : (
        <SiteHeader>
          <TimeZonePicker value={timeZone} onChange={changeTimeZone} />
        </SiteHeader>
      )}

      <main
        id="main"
        className="mx-auto flex w-full max-w-[82.5rem] flex-1 flex-col gap-4 px-4 pb-32 sm:px-6 sm:pb-12 lg:px-10"
      >
        {embed ? (
          <div className="flex justify-end pt-3">
            <TimeZonePicker value={timeZone} onChange={changeTimeZone} />
          </div>
        ) : step !== "done" ? (
          <Link
            href={`/${host.username}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-control text-label text-ink-muted hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {fill(t.booking.backToHost, { name: host.displayName })}
          </Link>
        ) : null}

        <Progress step={step} />
        <p className="sr-only" aria-live="polite">
          {zoneMessage}
        </p>

        <AnimatePresence mode="wait" initial={false}>
          {step === "done" && booking ? (
            <motion.section
              key="done"
              ref={headingRef}
              {...stepMotion}
              className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-8"
            >
              <Confirmation host={host} event={event} booking={booking} onBookAnother={bookAnother} />
            </motion.section>
          ) : (
            <motion.div
              key="card"
              {...stepMotion}
              className="grid overflow-hidden rounded-card border border-border bg-surface shadow-card lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]"
            >
              <aside className="border-b border-divider p-5 sm:p-7 lg:border-r lg:border-b-0">
                <EventSummary
                  host={host}
                  event={event}
                  compact={step === "details"}
                  selected={
                    step === "details" && selectedSlot && selectedEnd && timeZone
                      ? { start: selectedSlot, end: selectedEnd, timeZone }
                      : null
                  }
                  action={
                    step === "details" ? (
                      <Button variant="secondary" size="sm" onClick={() => setStep("pick")} className="w-fit">
                        {t.booking.form.change}
                      </Button>
                    ) : null
                  }
                />
              </aside>

              <div ref={headingRef} className="min-w-0 p-5 sm:p-7">
                <AnimatePresence mode="wait" initial={false}>
                  {step === "pick" ? (
                    <motion.div
                      key="pick"
                      {...stepMotion}
                      className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[minmax(0,1fr)_248px] xl:grid-cols-[minmax(0,1fr)_300px]"
                    >
                      <div className="flex flex-col gap-4">
                        {notice ? <Alert>{notice}</Alert> : null}
                        {currentMonth && minMonth && maxMonth && today ? (
                          <Calendar
                            month={currentMonth}
                            minMonth={minMonth}
                            maxMonth={maxMonth}
                            today={today}
                            availableDays={days ? new Set(days.keys()) : null}
                            selected={activeDate}
                            onSelect={setSelectedDate}
                            onMonthChange={changeMonth}
                          />
                        ) : (
                          <CalendarSkeleton />
                        )}
                        {emptyMonth ? (
                          <div className="flex flex-col items-start gap-3 rounded-card-sm bg-surface-soft p-4">
                            <p className="text-label text-ink-secondary">
                              {fill(t.booking.slots.emptyMonth, {
                                month: formatMonthName(currentMonth.year, currentMonth.month),
                              })}
                            </p>
                            {canGoNext ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => changeMonth(shiftMonth(currentMonth, 1))}
                              >
                                {t.booking.slots.nextMonth}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex min-w-0 flex-col gap-4 sm:border-l sm:border-divider sm:pl-6">
                        <div className="sm:max-h-[26rem] sm:overflow-y-auto sm:pr-1">
                          <SlotList
                            date={activeDate}
                            slots={daySlots}
                            timeZone={timeZone ?? "UTC"}
                            selected={selectedSlot}
                            status={state.status === "error" ? "error" : days ? "ready" : "loading"}
                            onSelect={(iso) => {
                              setSelectedSlot(iso);
                              setNotice(null);
                            }}
                            onRetry={reload}
                          />
                        </div>
                        <Button
                          size="lg"
                          disabled={!selectedSlot}
                          onClick={() => setStep("details")}
                          className="mt-auto w-full max-sm:hidden"
                        >
                          {continueLabel}
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="details" {...stepMotion} className="max-w-xl">
                      <GuestForm
                        event={event}
                        formId={FORM_ID}
                        submitting={submitting}
                        serverError={serverError}
                        onSubmit={submit}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile: primary action fixed at the bottom (DESIGN.md 10.4). */}
      {step !== "done" ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
          {step === "pick" ? (
            <Button size="lg" disabled={!selectedSlot} onClick={() => setStep("details")} className="w-full">
              {continueLabel}
            </Button>
          ) : (
            <Button type="submit" form={FORM_ID} size="lg" loading={submitting} className="w-full">
              {submitting ? t.booking.form.submitting : t.booking.form.submit}
            </Button>
          )}
        </div>
      ) : null}
    </MotionConfig>
  );
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="h-11 w-40 animate-pulse rounded-control bg-divider motion-reduce:animate-none" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => (
          <div
            key={i}
            className="aspect-square min-h-touch animate-pulse rounded-control bg-divider/60 motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
