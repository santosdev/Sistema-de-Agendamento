import { describeLocation } from "@/components/booking/location";
import type { LocationType, PhoneMode } from "@/lib/booking/types";
import { formatLongDate, formatTime, timeZoneName } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";
import { buildIcs } from "@/lib/ics";
import type { OutgoingEmail } from "./send";
import { renderEmail } from "./template";

/** Which change happened, and who did it (REQUISITOS 7). */
export type NoticeKind =
  "created" | "guest_cancelled" | "host_cancelled" | "guest_rescheduled" | "host_rescheduled";

export type BookingEmailData = {
  id: string;
  status: "confirmed" | "rescheduled" | "cancelled";
  startAt: string;
  endAt: string;
  previousStartAt: string | null;
  icsSequence: number;
  eventTitle: string;
  eventUrl: string | null;
  locationType: LocationType;
  locationValue: string | null;
  phoneMode: PhoneMode | null;
  cancelReason: string | null;
  guest: { name: string; email: string; phone: string | null; timeZone: string };
  host: { name: string; email: string | null; timeZone: string; isDemo: boolean };
  /** Only known right after the guest creates or changes the booking. */
  manageUrl: string | null;
  dashboardUrl: string;
};

/**
 * Builds the e-mails for one booking change (REQUISITOS 7, RN-56, RN-57, RN-71).
 * Times are shown in the recipient time zone. The demo host never gets e-mails.
 */
export function buildBookingEmails(kind: NoticeKind, b: BookingEmailData): OutgoingEmail[] {
  const t = getMessages();
  const e = t.email;
  const cancelled = kind === "guest_cancelled" || kind === "host_cancelled";

  const when = (iso: string, zone: string) => {
    const minutes = new Date(b.endAt).getTime() - new Date(b.startAt).getTime();
    return fill(e.when, {
      date: formatLongDate(iso, zone),
      start: formatTime(iso, zone),
      end: formatTime(new Date(new Date(iso).getTime() + minutes), zone),
      zone: timeZoneName(zone),
    });
  };

  const location = describeLocation(b.locationType, b.phoneMode, b.locationValue, { booked: true });
  const locationText = location.detail ? `${location.label}: ${location.detail}` : location.label;

  const ics = (forHost: boolean) => ({
    cancel: cancelled,
    content: buildIcs({
      uid: `${b.id}@agenda.techresolute`,
      sequence: b.icsSequence,
      start: new Date(b.startAt),
      end: new Date(b.endAt),
      summary: `${b.eventTitle} · ${forHost ? b.guest.name : b.host.name}`,
      description: forHost
        ? `${e.labels.guest}: ${b.guest.name} <${b.guest.email}>${b.guest.phone ? `\n${e.labels.phone}: ${b.guest.phone}` : ""}`
        : b.manageUrl
          ? `${e.manage}: ${b.manageUrl}`
          : undefined,
      location:
        b.locationType === "phone" && b.phoneMode === "host_calls" && !forHost
          ? t.location.hostCalls
          : (b.locationValue ?? location.label),
      url: forHost ? b.dashboardUrl : b.manageUrl,
      status: cancelled ? "CANCELLED" : "CONFIRMED",
    }),
  });

  const vars = { name: b.guest.name, host: b.host.name, guest: b.guest.name, event: b.eventTitle };
  const guestRows = (): [string, string][] => [
    [e.labels.event, b.eventTitle],
    [e.labels.when, when(b.startAt, b.guest.timeZone)],
    ...(b.previousStartAt && (kind === "guest_rescheduled" || kind === "host_rescheduled")
      ? ([[e.labels.previous, when(b.previousStartAt, b.guest.timeZone)]] as [string, string][])
      : []),
    ...(cancelled ? [] : ([[e.labels.location, locationText]] as [string, string][])),
    ...(cancelled && b.cancelReason ? ([[e.labels.reason, b.cancelReason]] as [string, string][]) : []),
  ];
  const hostRows = (): [string, string][] => [
    [e.labels.event, b.eventTitle],
    [e.labels.when, when(b.startAt, b.host.timeZone)],
    ...(b.previousStartAt && kind === "guest_rescheduled"
      ? ([[e.labels.previous, when(b.previousStartAt, b.host.timeZone)]] as [string, string][])
      : []),
    [e.labels.guest, b.guest.name],
    [e.labels.email, b.guest.email],
    ...(b.guest.phone ? ([[e.labels.phone, b.guest.phone]] as [string, string][]) : []),
    ...(cancelled && b.cancelReason ? ([[e.labels.reason, b.cancelReason]] as [string, string][]) : []),
  ];

  const guestEmail = (
    copy: { subject: string; title: string; intro: string },
    cta?: { label: string; url: string },
  ) => {
    const { html, text } = renderEmail({
      title: copy.title,
      intro: fill(copy.intro, vars),
      rows: guestRows(),
      cta,
      notes: [...(cancelled ? [] : [e.icsHint]), ...(cta?.url === b.manageUrl ? [e.manageHint] : [])],
      footer: e.footer,
    });
    return { to: b.guest.email, subject: fill(copy.subject, vars), html, text, ics: ics(false) };
  };

  const hostEmail = (copy: { subject: string; title: string; intro: string }): OutgoingEmail[] => {
    if (b.host.isDemo || !b.host.email) return [];
    const { html, text } = renderEmail({
      title: copy.title,
      intro: fill(copy.intro, vars),
      rows: hostRows(),
      cta: { label: e.openDashboard, url: b.dashboardUrl },
      footer: e.footer,
    });
    const subject = fill(copy.subject, {
      ...vars,
      date: `${formatLongDate(b.startAt, b.host.timeZone)} ${formatTime(b.startAt, b.host.timeZone)}`,
    });
    return [{ to: b.host.email, subject, html, text, ics: ics(true) }];
  };

  const manageCta = b.manageUrl ? { label: e.manage, url: b.manageUrl } : undefined;

  switch (kind) {
    case "created":
      return [guestEmail(e.guestCreated, manageCta), ...hostEmail(e.hostCreated)];
    case "guest_cancelled":
      return [guestEmail(e.guestCancelledGuest), ...hostEmail(e.guestCancelledHost)];
    case "host_cancelled":
      return [
        guestEmail(e.hostCancelledGuest, b.eventUrl ? { label: e.bookAgain, url: b.eventUrl } : undefined),
      ];
    case "guest_rescheduled":
      return [guestEmail(e.guestRescheduledGuest, manageCta), ...hostEmail(e.guestRescheduledHost)];
    case "host_rescheduled":
      return [guestEmail(e.hostRescheduledGuest)];
  }
}
