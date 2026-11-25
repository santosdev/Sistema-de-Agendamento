/**
 * Time zone primitives for scheduling, independent of the machine time zone.
 *
 * A "wall clock" value is the local date and time in a zone, encoded as the
 * milliseconds Date.UTC would return for those fields. It is never an instant;
 * it only exists to do calendar math on local time.
 *
 * Built on Intl (exact per instant). date-fns-tz getTimezoneOffset is not used
 * because it reads the Date as local fields and drifts by one hour at DST changes.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** "YYYY-MM-DD" calendar date. */
export type LocalDate = string;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Wall clock (see top comment) of an instant in a zone. */
export function wallClockOf(instant: Date | number, timeZone: string): number {
  const ms = typeof instant === "number" ? instant : instant.getTime();
  const parts = formatterFor(timeZone).formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall + (((ms % 1000) + 1000) % 1000);
}

/** UTC offset of a zone at an instant, in milliseconds (e.g. -3h for Sao Paulo). */
export function offsetAt(instant: Date | number, timeZone: string): number {
  const ms = typeof instant === "number" ? instant : instant.getTime();
  return wallClockOf(ms, timeZone) - ms;
}

/**
 * All instants that show a given wall clock in a zone, sorted.
 * - 0 instants: the wall clock does not exist (skipped by a DST jump).
 * - 2 instants: the wall clock happens twice (DST fall back).
 */
export function instantsAt(wallClock: number, timeZone: string): Date[] {
  const candidates = new Set<number>();
  for (const probe of [wallClock - DAY_MS, wallClock, wallClock + DAY_MS]) {
    const candidate = wallClock - offsetAt(probe, timeZone);
    if (wallClockOf(candidate, timeZone) === wallClock) candidates.add(candidate);
  }
  return [...candidates].sort((a, b) => a - b).map((ms) => new Date(ms));
}

/**
 * First instant at or after a wall clock. For a skipped wall clock (DST gap)
 * this is the moment the clocks jump. Used for day and month boundaries.
 */
export function startOfWallClock(wallClock: number, timeZone: string): Date {
  const exact = instantsAt(wallClock, timeZone);
  if (exact.length > 0) return exact[0];

  // Inside a gap: binary search (minute precision) for the first instant whose
  // wall clock is at or after the requested one, i.e. the moment of the jump.
  const a = wallClock - offsetAt(wallClock - DAY_MS, timeZone);
  const b = wallClock - offsetAt(wallClock + DAY_MS, timeZone);
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  while (hi - lo > MINUTE_MS) {
    const mid = Math.max(lo + MINUTE_MS, lo + Math.floor((hi - lo) / 2 / MINUTE_MS) * MINUTE_MS);
    if (mid >= hi) break;
    if (wallClockOf(mid, timeZone) >= wallClock) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}

export function localDateOf(instant: Date | number, timeZone: string): LocalDate {
  return new Date(wallClockOf(instant, timeZone)).toISOString().slice(0, 10);
}

/** Wall clock of 00:00 on a local date. */
export function wallClockOfDate(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return new Date(wallClockOfDate(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, same as Postgres extract(dow). */
export function weekdayOf(date: LocalDate): number {
  return new Date(wallClockOfDate(date)).getUTCDay();
}

/** "09:30", "09:30:00" or "24:00" to minutes since midnight. */
export function parseTimeOfDay(value: string): number {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error(`Invalid time of day: ${value}`);
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes > 24 * 60 || Number(match[2]) > 59) throw new Error(`Invalid time of day: ${value}`);
  return minutes;
}

/** Instants covering a local day: [start, end). Handles 23h and 25h days. */
export function dayBounds(date: LocalDate, timeZone: string): { start: Date; end: Date } {
  return {
    start: startOfWallClock(wallClockOfDate(date), timeZone),
    end: startOfWallClock(wallClockOfDate(addDays(date, 1)), timeZone),
  };
}

/** Instants covering a local month: [start, end). month is 1 to 12. */
export function monthBounds(year: number, month: number, timeZone: string): { start: Date; end: Date } {
  return {
    start: startOfWallClock(Date.UTC(year, month - 1, 1), timeZone),
    end: startOfWallClock(Date.UTC(year, month, 1), timeZone),
  };
}
