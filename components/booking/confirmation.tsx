import { CalendarPlus, CircleCheck, ExternalLink, Globe } from "lucide-react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import type { CreatedBooking, PublicEvent, PublicHost } from "@/lib/booking/types";
import { formatLongDate, formatTime, timeZoneName } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";
import { describeLocation, LocationIcon } from "./location";

type Props = {
  host: Pick<PublicHost, "displayName">;
  event: PublicEvent;
  booking: CreatedBooking;
  onBookAnother: () => void;
};

/** DESIGN.md 10.5 */
export function Confirmation({ host, event, booking, onBookAnother }: Props) {
  const t = getMessages();
  const tz = booking.guestTimeZone;
  const location = describeLocation(
    event.locationType,
    event.phoneMode,
    booking.locationValue ?? event.address,
    {
      booked: true,
    },
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-4 text-center sm:py-8">
      <CircleCheck aria-hidden="true" className="size-12 text-success-ink" strokeWidth={1.5} />
      <div className="flex flex-col gap-2">
        <h1
          className="font-display text-title text-ink focus:outline-none"
          tabIndex={-1}
          id="confirmation-title"
        >
          {t.booking.done.title}
        </h1>
        <p className="text-body text-ink-muted">{t.booking.done.body}</p>
      </div>

      <dl className="w-full rounded-card-sm border border-border bg-surface-soft p-5 text-left text-label">
        <div className="flex flex-col gap-0.5 pb-3">
          <dt className="sr-only">{t.booking.done.eventLabel}</dt>
          <dd className="font-display text-heading text-ink">{event.title}</dd>
          <dd className="text-ink-muted">{fill(t.manage.with, { name: host.displayName })}</dd>
        </div>
        <div className="flex flex-col gap-0.5 border-t border-divider py-3">
          <dt className="sr-only">{t.booking.done.dateLabel}</dt>
          <dd className="font-medium text-ink">{formatLongDate(booking.startAt, tz)}</dd>
          <dd className="text-ink-secondary tabular-nums">
            {fill(t.common.timeRange, {
              start: formatTime(booking.startAt, tz),
              end: formatTime(booking.endAt, tz),
            })}
          </dd>
          <dd className="flex items-center gap-1.5 text-caption text-ink-muted">
            <Globe aria-hidden="true" className="size-3.5" />
            {timeZoneName(tz)}
          </dd>
        </div>
        <div className="flex items-start gap-2 border-t border-divider pt-3">
          <dt className="sr-only">{t.booking.done.locationLabel}</dt>
          <LocationIcon type={event.locationType} className="mt-0.5 size-[18px] shrink-0 text-ink-muted" />
          <dd className="min-w-0 text-ink-secondary">
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
          </dd>
        </div>
      </dl>

      <div className="flex w-full flex-col gap-2">
        <a
          href={`/api/booking/${booking.token}/ics`}
          download="reuniao.ics"
          className={buttonClasses({ size: "lg", className: "w-full" })}
        >
          <CalendarPlus aria-hidden="true" className="size-[18px]" />
          {t.booking.done.addToCalendar}
        </a>
        <Button variant="ghost" onClick={onBookAnother} className="w-full">
          {t.booking.done.bookAnother}
        </Button>
      </div>

      <Link
        href={`/booking/${booking.token}`}
        className="text-label font-medium text-brand underline-offset-2 hover:underline"
      >
        {t.booking.done.manage}
      </Link>
    </div>
  );
}
