import { en } from "./messages/en";
import { ptBR, type Messages } from "./messages/pt-BR";

export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

const messages: Record<Locale, Messages> = { "pt-BR": ptBR, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Returns the dictionary for a locale. For now the app always uses DEFAULT_LOCALE;
 * locale detection (cookie or Accept-Language) will plug in here later.
 */
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return messages[locale];
}

/** Week start for the calendar grid (RN-77). Sunday for pt-BR and en-US. */
export function weekStartsOn(_locale: Locale = DEFAULT_LOCALE): 0 | 1 {
  return 0;
}

/** Replaces {key} placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type { Messages };
