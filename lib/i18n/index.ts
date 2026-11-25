import { enUS, ptBR as ptBRDateLocale, type Locale as DateLocale } from "date-fns/locale";
import { en } from "./messages/en";
import { ptBR, type Messages } from "./messages/pt-BR";

export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

const messages: Record<Locale, Messages> = { "pt-BR": ptBR, en };

const dateLocales: Record<Locale, DateLocale> = { "pt-BR": ptBRDateLocale, en: enUS };

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

/** date-fns locale (week start, month and weekday names). */
export function getDateLocale(locale: Locale = DEFAULT_LOCALE): DateLocale {
  return dateLocales[locale];
}

export type { Messages };
