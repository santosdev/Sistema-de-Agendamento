"use client";

import { CalendarDays, CalendarPlus, ExternalLink, Globe } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { describeLocation, LocationIcon } from "@/components/booking/location";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/chip";
import { cancelBookingAction, rescheduleBookingAction } from "@/lib/booking/actions";
import type { ManagedBooking } from "@/lib/booking/types";
import { DURATION, EASE, EVENT_COLORS } from "@/lib/design/tokens";
import { formatLongDate, formatTime, timeZoneName } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";
import { CancelDialog } from "./cancel-dialog";
import { ReschedulePanel } from "./reschedule-panel";

type Props = { token: string; booking: ManagedBooking; isPast: boolean };

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: DURATION.base, ease: EASE.outSoft },
};

export function ManageBooking({ token, booking, isPast }: Props) {
  const t = getMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState(booking.guestTimeZone);

  const host = booking.host;
  const status = booking.status === "cancelled" ? "cancelled" : isPast ? "past" : booking.status;
  const location = describeLocation(booking.locationType, booking.phoneMode, booking.locationValue, {
    booked: true,
  });
  const errorText = (code: string) =>
    (t.manage.errors as Record<string, string>)[code] ??
    (t.booking.errors as Record<string, string>)[code] ??
    t.booking.errors.unknown;

  function cancel(reason: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelBookingAction({ token, reason: reason || undefined });
      if (!result.ok) {
        setError(errorText(result.error));
        return;
      }
      setCancelOpen(false);
      setSuccess(t.manage.cancelDialog.done);
      router.refresh();
    });
  }

  function reschedule(startAt: string) {
    setError(null);
    startTransition(async () => {
      const result = await rescheduleBookingAction({ token, startAt });
      if (!result.ok) {
        setError(errorText(result.error));
        return;
      }
      setMode("view");
      setSuccess(t.manage.rescheduleFlow.done);
      router.refresh();
    });
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-4">
        {success ? <Alert tone="success">{success}</Alert> : null}

        <AnimatePresence mode="wait" initial={false}>
          {mode === "reschedule" ? (
            <motion.div
              key="reschedule"
              {...fade}
              className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-7"
            >
              <ReschedulePanel
                token={token}
                username={host.username}
                eventSlug={booking.eventSlug}
                timeZone={timeZone}
                onTimeZoneChange={setTimeZone}
                pending={pending}
                error={error}
                onConfirm={reschedule}
                onCancel={() => {
                  setMode("view");
                  setError(null);
                }}
              />
            </motion.div>
          ) : (
            <motion.article
              key="view"
              {...fade}
              aria-labelledby="booking-title"
              className="flex flex-col gap-6 rounded-card border border-border bg-surface p-5 shadow-card sm:p-7"
            >
              <header className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={host.displayName} src={host.avatarUrl} size={40} />
                    <p className="text-label text-ink-muted">
                      {fill(t.manage.with, { name: host.displayName })}
                    </p>
                  </div>
                  <StatusBadge status={status} label={t.manage.status[status]} />
                </div>
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-5 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: EVENT_COLORS[booking.eventColor] }}
                  />
                  <h1 id="booking-title" className="font-display text-title text-ink">
                    {booking.eventTitle}
                  </h1>
                </div>
              </header>

              <ul className="flex flex-col gap-3 text-label text-ink-secondary">
                <li className="flex items-start gap-2.5">
                  <CalendarDays aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-ink-muted" />
                  <span
                    className={
                      booking.status === "cancelled" ? "text-ink-muted line-through" : "font-medium text-ink"
                    }
                  >
                    {formatLongDate(booking.startAt, timeZone)}
                    <span className="block tabular-nums">
                      {fill(t.common.timeRange, {
                        start: formatTime(booking.startAt, timeZone),
                        end: formatTime(booking.endAt, timeZone),
                      })}
                    </span>
                  </span>
                </li>
                <li className="flex items-center gap-2.5 text-caption text-ink-muted">
                  <Globe aria-hidden="true" className="size-4 shrink-0" />
                  {timeZoneName(timeZone)}
                </li>
                {booking.previousStartAt && booking.status === "rescheduled" ? (
                  <li className="pl-7 text-caption text-ink-muted">
                    {fill(t.manage.previousTime, {
                      time: `${formatLongDate(booking.previousStartAt, timeZone)}, ${formatTime(booking.previousStartAt, timeZone)}`,
                    })}
                  </li>
                ) : null}
                {booking.status !== "cancelled" ? (
                  <li className="flex items-start gap-2.5">
                    <LocationIcon
                      type={booking.locationType}
                      className="mt-0.5 size-[18px] shrink-0 text-ink-muted"
                    />
                    <span className="min-w-0">
                      {location.label}
                      {location.href ? (
                        <a
                          href={location.href}
                          target={location.href.startsWith("http") ? "_blank" : undefined}
                          rel="noreferrer"
                          className="mt-0.5 flex items-center gap-1 font-medium break-all text-brand underline-offset-2 hover:underline"
                        >
                          {location.href.startsWith("http") ? t.booking.done.joinLink : location.detail}
                          <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                        </a>
                      ) : location.detail ? (
                        <span className="block text-caption text-ink-muted">{location.detail}</span>
                      ) : null}
                    </span>
                  </li>
                ) : null}
              </ul>

              {booking.status === "cancelled" ? (
                <div className="flex flex-col gap-3 rounded-card-sm bg-surface-soft p-4 text-label text-ink-secondary">
                  <p>
                    {booking.cancelledBy === "host"
                      ? fill(t.manage.cancelledBy.host, { name: host.displayName })
                      : t.manage.cancelledBy.guest}
                  </p>
                  {booking.cancelReason ? (
                    <p className="text-ink-muted">
                      {fill(t.manage.reason, { reason: booking.cancelReason })}
                    </p>
                  ) : null}
                  <ButtonLink
                    href={`/${host.username}/${booking.eventSlug}`}
                    variant="secondary"
                    size="sm"
                    className="w-fit"
                  >
                    {t.manage.bookAgain}
                  </ButtonLink>
                </div>
              ) : isPast ? null : booking.canModify ? (
                <div className="flex flex-col gap-2 border-t border-divider pt-5 sm:flex-row">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSuccess(null);
                      setError(null);
                      setMode("reschedule");
                    }}
                  >
                    {t.manage.reschedule}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setSuccess(null);
                      setError(null);
                      setCancelOpen(true);
                    }}
                  >
                    {t.manage.cancel}
                  </Button>
                  <a
                    href={`/api/booking/${token}/ics`}
                    download="reuniao.ics"
                    className={buttonClasses({ variant: "ghost", className: "sm:ml-auto" })}
                  >
                    <CalendarPlus aria-hidden="true" className="size-[18px]" />
                    {t.booking.done.addToCalendar}
                  </a>
                </div>
              ) : (
                <Alert tone="info">{fill(t.manage.deadlinePassed, { name: host.displayName })}</Alert>
              )}

              {error && !cancelOpen ? <Alert>{error}</Alert> : null}
            </motion.article>
          )}
        </AnimatePresence>
      </div>

      <CancelDialog
        open={cancelOpen}
        hostName={host.displayName}
        pending={pending}
        error={cancelOpen ? error : null}
        onConfirm={cancel}
        onClose={() => {
          setCancelOpen(false);
          setError(null);
        }}
      />
    </MotionConfig>
  );
}
