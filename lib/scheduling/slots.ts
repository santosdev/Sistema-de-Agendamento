/**
 * Slot generation (RN-27 to RN-35). Pure: no I/O, no clock, no machine time zone.
 *
 * Mirrors the database checks in public._assert_bookable and public._fits_availability,
 * so every slot offered here is accepted by create_booking (and vice versa). The
 * parity is verified by tests/db/slots-parity.test.ts.
 */
import {
  DAY_MS,
  MINUTE_MS,
  addDays,
  instantsAt,
  localDateOf,
  parseTimeOfDay,
  wallClockOf,
  wallClockOfDate,
  weekdayOf,
  type LocalDate,
} from "./time";

/** Weekly availability, wall clock in the host zone. weekday: 0 = Sunday. */
export type WeeklyRule = { weekday: number; startTime: string; endTime: string };

/** Per-date override. startTime and endTime null = day off. */
export type DateOverride = { date: LocalDate; startTime: string | null; endTime: string | null };

/** An active (not cancelled) booking of the host, from get_busy_ranges. */
export type BusyRange = {
  eventTypeId: string;
  start: Date;
  /** start minus its own buffer before. */
  blockedFrom: Date;
  /** end plus its own buffer after. */
  blockedUntil: Date;
};

export type SlotEvent = {
  id: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  dailyLimit: number | null;
};

export type GenerateSlotsInput = {
  event: SlotEvent;
  hostTimeZone: string;
  rules: WeeklyRule[];
  overrides: DateOverride[];
  /**
   * Active bookings of the host. Must cover [from, to) plus one day on each side,
   * so overlaps with buffers and the daily limit see every booking of the host day.
   * When rescheduling, leave the booking being moved out of this list.
   */
  busy: BusyRange[];
  now: Date;
  /** Only slots starting in [from, to) are returned. */
  from: Date;
  to: Date;
  /** Duration to use instead of the event's (rescheduling keeps the original, RN-43). */
  durationMinutes?: number;
  /** Hosts may ignore the minimum notice when rescheduling (RN-54). */
  enforceNotice?: boolean;
};

type Interval = { start: number; end: number }; // minutes since local midnight

function intervalsFor(date: LocalDate, rules: WeeklyRule[], overrides: DateOverride[]): Interval[] {
  const dayOverrides = overrides.filter((o) => o.date === date);
  // RN-25: any override for the date replaces the weekly rules; a day off yields nothing.
  const source =
    dayOverrides.length > 0
      ? dayOverrides.flatMap((o) => (o.startTime && o.endTime ? [{ s: o.startTime, e: o.endTime }] : []))
      : rules.filter((r) => r.weekday === weekdayOf(date)).map((r) => ({ s: r.startTime, e: r.endTime }));

  return source
    .map(({ s, e }) => ({ start: parseTimeOfDay(s), end: parseTimeOfDay(e) }))
    .filter((i) => i.start < i.end)
    .sort((a, b) => a.start - b.start);
}

function overlaps(aFrom: number, aUntil: number, bFrom: number, bUntil: number): boolean {
  return aFrom < bUntil && bFrom < aUntil;
}

/** Bookable start instants (UTC), sorted and unique. */
export function generateSlots(input: GenerateSlotsInput): Date[] {
  const { event, hostTimeZone: tz, rules, overrides, busy, now } = input;
  const duration = input.durationMinutes ?? event.durationMinutes;
  const step = event.slotIntervalMinutes;
  const enforceNotice = input.enforceNotice ?? true;

  const nowMs = now.getTime();
  const fromMs = Math.max(input.from.getTime(), nowMs);
  const toMs = input.to.getTime();
  const earliest = enforceNotice ? nowMs + event.minNoticeMinutes * MINUTE_MS : nowMs;
  const latest = nowMs + event.maxDaysAhead * DAY_MS;

  if (fromMs >= toMs || step <= 0 || duration <= 0) return [];

  const busyMs = busy.map((b) => ({
    eventTypeId: b.eventTypeId,
    hostDate: localDateOf(b.start, tz),
    from: b.blockedFrom.getTime(),
    until: b.blockedUntil.getTime(),
  }));

  const slots = new Set<number>();
  const lastDate = localDateOf(toMs, tz);

  for (let date = localDateOf(fromMs, tz); date <= lastDate; date = addDays(date, 1)) {
    // RN-32: daily limit counts bookings of this event type on the host local day.
    if (event.dailyLimit !== null) {
      const booked = busyMs.filter((b) => b.eventTypeId === event.id && b.hostDate === date).length;
      if (booked >= event.dailyLimit) continue;
    }

    const midnight = wallClockOfDate(date);

    for (const interval of intervalsFor(date, rules, overrides)) {
      const intervalEndWall = midnight + interval.end * MINUTE_MS;

      // RN-27: wall clock steps from the interval start (DST-safe, matches the database).
      for (let minute = interval.start; minute < interval.end; minute += step) {
        // RN-34: skipped wall clocks give no instant; repeated ones give two.
        for (const startInstant of instantsAt(midnight + minute * MINUTE_MS, tz)) {
          const start = startInstant.getTime();
          const end = start + duration * MINUTE_MS;

          // RN-28: must end inside the interval (compared on the wall clock).
          if (wallClockOf(end, tz) > intervalEndWall) continue;
          if (start < fromMs || start >= toMs) continue;
          if (start <= nowMs) continue; // never in the past
          if (start < earliest) continue; // RN-30 minimum notice
          if (start > latest) continue; // RN-31 booking window

          // RN-29: buffers of both sides.
          const blockedFrom = start - event.bufferBeforeMinutes * MINUTE_MS;
          const blockedUntil = end + event.bufferAfterMinutes * MINUTE_MS;
          if (busyMs.some((b) => overlaps(blockedFrom, blockedUntil, b.from, b.until))) continue;

          slots.add(start);
        }
      }
    }
  }

  return [...slots].sort((a, b) => a - b).map((ms) => new Date(ms));
}

export type DaySlots = { date: LocalDate; slots: Date[] };

/** RN-35: group slots by the guest's local day. */
export function groupSlotsByDay(slots: Date[], guestTimeZone: string): DaySlots[] {
  const days = new Map<LocalDate, Date[]>();
  for (const slot of slots) {
    const date = localDateOf(slot, guestTimeZone);
    const list = days.get(date);
    if (list) list.push(slot);
    else days.set(date, [slot]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, slots: list }));
}
