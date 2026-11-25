"use client";

import { CalendarX2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { describeLocation, LocationIcon } from "@/components/booking/location";
import { CancelDialog } from "@/components/manage/cancel-dialog";
import { ReschedulePanel } from "@/components/manage/reschedule-panel";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/chip";
import {
  hostCancelBookingAction,
  hostRescheduleBookingAction,
  type DashboardResult,
} from "@/lib/dashboard/actions";
import type { HostMeeting, MeetingsTab } from "@/lib/dashboard/queries";
import { EVENT_COLORS } from "@/lib/design/tokens";
import { formatDayHeading, formatDuration, formatTime, timeZoneName } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";
import { addDays, localDateOf } from "@/lib/scheduling/time";
import { CopyButton } from "./copy-button";
import { errorText } from "./error-text";

type Props = {
  tab: MeetingsTab;
  meetings: HostMeeting[];
  hostTimeZone: string;
  username: string;
  publicUrl: string;
};

export function MeetingsList({ tab, meetings, hostTimeZone, username, publicUrl }: Props) {
  const t = getMessages();
  const tm = t.dashboard.meetings;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<HostMeeting | null>(null);
  const [rescheduling, setRescheduling] = useState<HostMeeting | null>(null);
  const [rescheduleZone, setRescheduleZone] = useState(hostTimeZone);
  const [now] = useState(() => Date.now());

  function run(action: () => Promise<DashboardResult>, done: string, after: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action().catch((): DashboardResult => ({ ok: false, error: "unknown" }));
      if (!result.ok) {
        setError(errorText(result.error));
        return;
      }
      after();
      setSuccess(done);
    });
  }

  if (rescheduling) {
    return (
      <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-7">
        <ReschedulePanel
          bookingId={rescheduling.id}
          title={fill(tm.rescheduleTitle, { name: rescheduling.guestName })}
          username={username}
          eventSlug={rescheduling.eventSlug ?? ""}
          currentStartAt={rescheduling.startAt}
          timeZone={rescheduleZone}
          onTimeZoneChange={setRescheduleZone}
          pending={pending}
          error={error}
          onConfirm={(startAt) =>
            run(
              () => hostRescheduleBookingAction({ bookingId: rescheduling.id, startAt }),
              t.manage.rescheduleFlow.done,
              () => setRescheduling(null),
            )
          }
          onCancel={() => {
            setRescheduling(null);
            setError(null);
          }}
        />
      </div>
    );
  }

  const today = localDateOf(now, hostTimeZone);
  const groups = new Map<string, HostMeeting[]>();
  for (const m of meetings) {
    const day = localDateOf(new Date(m.startAt), hostTimeZone);
    groups.set(day, [...(groups.get(day) ?? []), m]);
  }

  return (
    <div className="flex flex-col gap-6">
      {success ? <Alert tone="success">{success}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      {meetings.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-6 shadow-card">
          <CalendarX2 aria-hidden="true" className="size-6 text-ink-muted" />
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-heading text-ink">{tm.empty[tab]}</h2>
            {tab === "upcoming" ? <p className="text-label text-ink-muted">{tm.emptyBody}</p> : null}
          </div>
          {tab === "upcoming" ? <CopyButton value={publicUrl} /> : null}
        </div>
      ) : (
        [...groups.entries()].map(([day, items]) => (
          <section key={day} aria-labelledby={`day-${day}`} className="flex flex-col gap-2">
            <h2
              id={`day-${day}`}
              className="text-caption font-semibold tracking-wide text-ink-muted uppercase"
            >
              {day === today ? tm.today : day === addDays(today, 1) ? tm.tomorrow : formatDayHeading(day)}
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((m) => (
                <MeetingItem
                  key={m.id}
                  meeting={m}
                  hostTimeZone={hostTimeZone}
                  now={now}
                  onCancel={() => {
                    setSuccess(null);
                    setError(null);
                    setCancelling(m);
                  }}
                  onReschedule={() => {
                    setSuccess(null);
                    setError(null);
                    setRescheduling(m);
                  }}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <CancelDialog
        open={cancelling !== null}
        hostName={cancelling?.guestName ?? ""}
        pending={pending}
        error={cancelling ? error : null}
        onClose={() => setCancelling(null)}
        onConfirm={(reason) =>
          cancelling &&
          run(
            () => hostCancelBookingAction({ bookingId: cancelling.id, reason: reason || undefined }),
            t.manage.cancelDialog.done,
            () => setCancelling(null),
          )
        }
      />
    </div>
  );
}

function MeetingItem({
  meeting: m,
  hostTimeZone,
  now,
  onCancel,
  onReschedule,
}: {
  meeting: HostMeeting;
  hostTimeZone: string;
  now: number;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const t = getMessages();
  const tm = t.dashboard.meetings;
  const [open, setOpen] = useState(false);
  const ended = new Date(m.endAt).getTime() < now;
  const started = new Date(m.startAt).getTime() <= now;
  const status = m.status === "cancelled" ? "cancelled" : ended ? "past" : m.status;
  const location = describeLocation(m.locationType, m.phoneMode, m.locationValue, { booked: true });
  const minutes = Math.round((new Date(m.endAt).getTime() - new Date(m.startAt).getTime()) / 60_000);
  const detailsId = `meeting-${m.id}`;

  return (
    <li className="rounded-card-sm border border-border bg-surface shadow-card">
      <div className="flex min-h-[72px] flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <div className="w-16 shrink-0">
          <p className="text-label font-semibold text-ink tabular-nums">
            {formatTime(m.startAt, hostTimeZone)}
          </p>
          <p className="text-caption text-ink-muted">{formatDuration(minutes)}</p>
        </div>
        <span
          aria-hidden="true"
          className="hidden h-10 w-[3px] shrink-0 rounded-full sm:block"
          style={{ backgroundColor: EVENT_COLORS[m.eventColor] }}
        />
        <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto">
          <p className="truncate text-body font-semibold text-ink">{m.guestName}</p>
          <p className="truncate text-caption text-ink-muted">
            {m.eventTitle} · {location.label}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <StatusBadge status={status} label={t.manage.status[status]} />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={fill(tm.actions, { name: m.guestName })}
            className="inline-flex size-touch items-center justify-center rounded-control text-ink-secondary hover:bg-brand-soft hover:text-brand-soft-ink"
          >
            {open ? (
              <ChevronUp aria-hidden="true" className="size-5" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id={detailsId}
          className="flex flex-col gap-4 border-t border-divider bg-surface-soft p-4 text-label"
        >
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
            <dt className="text-ink-muted">{tm.email}</dt>
            <dd className="break-all text-ink">
              <a href={`mailto:${m.guestEmail}`} className="text-brand underline-offset-2 hover:underline">
                {m.guestEmail}
              </a>
            </dd>
            {m.guestPhone ? (
              <>
                <dt className="text-ink-muted">{tm.phone}</dt>
                <dd className="text-ink tabular-nums">{m.guestPhone}</dd>
              </>
            ) : null}
            <dt className="text-ink-muted">{tm.guestTimeZone}</dt>
            <dd className="text-ink">
              {timeZoneName(m.guestTimeZone)} · {formatTime(m.startAt, m.guestTimeZone)}
            </dd>
            <dt className="text-ink-muted">{t.booking.done.locationLabel}</dt>
            <dd className="flex items-center gap-1.5 text-ink">
              <LocationIcon type={m.locationType} className="size-4 shrink-0 text-ink-muted" />
              {location.href ? (
                <a
                  href={location.href}
                  target={location.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 break-all text-brand underline-offset-2 hover:underline"
                >
                  {location.detail}
                  {location.href.startsWith("http") ? (
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  ) : null}
                </a>
              ) : (
                (location.detail ?? location.label)
              )}
            </dd>
            {m.answers.map((a, i) => (
              <div key={i} className="contents">
                <dt className="text-ink-muted">{a.label}</dt>
                <dd className="whitespace-pre-line text-ink">
                  {Array.isArray(a.value) ? a.value.join(", ") : a.value}
                </dd>
              </div>
            ))}
          </dl>

          {m.status === "cancelled" ? (
            <p className="text-ink-secondary">
              {m.cancelledBy === "host" ? tm.cancelledByHost : tm.cancelledByGuest}
              {m.cancelReason ? `. ${fill(tm.reason, { reason: m.cancelReason })}` : ""}
            </p>
          ) : !ended ? (
            <div className="flex flex-wrap gap-2">
              {!started ? (
                <Button variant="secondary" size="sm" onClick={onReschedule}>
                  {tm.reschedule}
                </Button>
              ) : null}
              <Button variant="danger" size="sm" onClick={onCancel}>
                {tm.cancel}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
