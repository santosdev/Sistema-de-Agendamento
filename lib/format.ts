/**
 * Display formatting (DESIGN.md section 12). Always explicit locale and time zone,
 * so server and client render the same text.
 */
import { DEFAULT_LOCALE, fill, getMessages, type Locale } from "@/lib/i18n";
import { localDateOf, wallClockOfDate, type LocalDate } from "@/lib/scheduling/time";

const cache = new Map<string, Intl.DateTimeFormat>();

function dtf(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** "14:30" */
export function formatTime(
  instant: Date | string,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return dtf(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(instant),
  );
}

/** "Quarta-feira, 3 de dezembro de 2026" */
export function formatLongDate(
  instant: Date | string,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return capitalize(
    dtf(locale, { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
      new Date(instant),
    ),
  );
}

/** "Quarta-feira, 3 de dezembro" for a calendar date (no time zone math). */
export function formatDayHeading(date: LocalDate, locale: Locale = DEFAULT_LOCALE): string {
  return capitalize(
    dtf(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
      wallClockOfDate(date),
    ),
  );
}

/** "quarta-feira, 3 de dezembro" for aria-labels. */
export function formatDayLabel(date: LocalDate, locale: Locale = DEFAULT_LOCALE): string {
  return dtf(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    wallClockOfDate(date),
  );
}

/** "Dezembro de 2026" */
export function formatMonthYear(year: number, month: number, locale: Locale = DEFAULT_LOCALE): string {
  return capitalize(
    dtf(locale, { timeZone: "UTC", month: "long", year: "numeric" }).format(Date.UTC(year, month - 1, 1)),
  );
}

/** "dezembro" */
export function formatMonthName(year: number, month: number, locale: Locale = DEFAULT_LOCALE): string {
  return dtf(locale, { timeZone: "UTC", month: "long" }).format(Date.UTC(year, month - 1, 1));
}

/** Weekday headers starting on Sunday: [{ short: "D", long: "domingo" }, ...]. */
export function weekdayNames(locale: Locale = DEFAULT_LOCALE): { short: string; long: string }[] {
  // 2027-01-03 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const day = Date.UTC(2027, 0, 3 + i);
    return {
      short: dtf(locale, { timeZone: "UTC", weekday: "narrow" }).format(day).toLocaleUpperCase(),
      long: dtf(locale, { timeZone: "UTC", weekday: "long" }).format(day),
    };
  });
}

/** "Horário de Brasília" (falls back to the city name). */
export function timeZoneName(timeZone: string, locale: Locale = DEFAULT_LOCALE): string {
  try {
    const part = dtf(locale, { timeZone, timeZoneName: "longGeneric" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    // "Horário Padrão de Brasília" reads better as "Horário de Brasília" (DESIGN.md 12).
    if (part && !/^GMT/.test(part)) return part.replace(/ Padrão(?= d)/, "");
  } catch {
    // Invalid zone: fall through.
  }
  return timeZoneCity(timeZone);
}

/** "São Paulo" from "America/Sao_Paulo". */
export function timeZoneCity(timeZone: string): string {
  const city = timeZone.split("/").at(-1) ?? timeZone;
  return city.replace(/_/g, " ");
}

/** "GMT-3", "GMT+5:30" */
export function timeZoneOffsetLabel(
  timeZone: string,
  at: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const part = dtf(locale, { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return part ?? "GMT";
}

/** "30 min", "1 h", "1 h 30 min" */
export function formatDuration(minutes: number, locale: Locale = DEFAULT_LOCALE): string {
  const t = getMessages(locale).common;
  if (minutes < 60) return fill(t.minutes, { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? fill(t.hours, { h }) : fill(t.hoursMinutes, { h, m });
}

/** Today's calendar date in a zone. */
export function todayIn(timeZone: string, now: Date = new Date()): LocalDate {
  return localDateOf(now, timeZone);
}
