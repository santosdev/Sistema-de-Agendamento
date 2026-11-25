import { z } from "zod";
import { normalizePhone } from "@/lib/booking/schemas";
import type { LocationType, PhoneMode, Question, QuestionType } from "@/lib/booking/types";
import { EVENT_COLOR_NAMES, type EventColor } from "@/lib/design/tokens";
import { fill, type Messages } from "@/lib/i18n";

/** Same rules as the database checks (supabase/migrations/*_schema.sql). */
export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$/;
export const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
export const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60] as const;
export const LOCATION_TYPES: LocationType[] = ["google_meet", "zoom", "phone", "in_person", "custom_link"];
export const QUESTION_TYPES: QuestionType[] = ["short_text", "long_text", "single_choice", "multi_choice"];
const E164 = /^\+[1-9][0-9]{7,14}$/;
const HTTPS = /^https:\/\/\S+$/;

/** "Call de Diagnóstico!" -> "call-de-diagnostico" */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export function newQuestionId(): string {
  return `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Form values: numbers stay as typed strings until validated. */
export type EventFormValues = {
  title: string;
  slug: string;
  description: string;
  durationMinutes: string;
  slotIntervalMinutes: string;
  locationType: LocationType;
  link: string;
  address: string;
  phoneMode: PhoneMode;
  hostPhone: string;
  bufferBeforeMinutes: string;
  bufferAfterMinutes: string;
  minNoticeHours: string;
  maxDaysAhead: string;
  dailyLimit: string;
  color: EventColor;
  isActive: boolean;
  questions: { id: string; type: QuestionType; label: string; required: boolean; optionsText: string }[];
};

export const DEFAULT_EVENT_VALUES: EventFormValues = {
  title: "",
  slug: "",
  description: "",
  durationMinutes: "30",
  slotIntervalMinutes: "30",
  locationType: "google_meet",
  link: "",
  address: "",
  phoneMode: "host_calls",
  hostPhone: "",
  bufferBeforeMinutes: "0",
  bufferAfterMinutes: "0",
  minNoticeHours: "4",
  maxDaysAhead: "60",
  dailyLimit: "",
  color: "violet",
  isActive: true,
  questions: [],
};

/** Row written to public.event_types. */
export type EventTypeRow = {
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  slot_interval_minutes: number;
  location_type: LocationType;
  location_value: string | null;
  phone_mode: PhoneMode | null;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  daily_limit: number | null;
  color: EventColor;
  is_active: boolean;
  questions: Question[];
};

type EventMessages = Messages["dashboard"]["events"]["errors"];

export function eventTypeSchema(t: EventMessages) {
  const int = (min: number, max: number) => {
    const message = fill(t.number, { min, max });
    return z
      .string()
      .trim()
      .regex(/^\d+$/, message)
      .transform(Number)
      .pipe(z.number().int().min(min, message).max(max, message));
  };

  const question = z
    .object({
      id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
      type: z.enum(QUESTION_TYPES as [QuestionType, ...QuestionType[]]),
      label: z.string().trim().min(1, t.required).max(200),
      required: z.boolean(),
      optionsText: z.string(),
    })
    .transform((q, ctx): Question => {
      const base = { id: q.id, type: q.type, label: q.label, required: q.required };
      if (q.type !== "single_choice" && q.type !== "multi_choice") return base;
      const options = [
        ...new Set(
          q.optionsText
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean),
        ),
      ];
      if (options.length < 2 || options.length > 10 || options.some((o) => o.length > 100)) {
        ctx.addIssue({ code: "custom", message: t.options, path: ["optionsText"] });
      }
      return { ...base, options };
    });

  return z
    .object({
      title: z.string().trim().min(1, t.required).max(80),
      slug: z.string().trim().regex(SLUG_RE, t.slug),
      description: z.string().max(1000),
      durationMinutes: int(5, 480),
      slotIntervalMinutes: z.enum(SLOT_INTERVALS.map(String) as [string, ...string[]]).transform(Number),
      locationType: z.enum(LOCATION_TYPES as [LocationType, ...LocationType[]]),
      link: z.string().trim(),
      address: z.string().trim(),
      phoneMode: z.enum(["host_calls", "guest_calls"]),
      hostPhone: z.string(),
      bufferBeforeMinutes: int(0, 120),
      bufferAfterMinutes: int(0, 120),
      minNoticeHours: int(0, 720),
      maxDaysAhead: int(1, 365),
      dailyLimit: z.union([z.literal("").transform(() => null), int(1, 50)]),
      color: z.enum(EVENT_COLOR_NAMES as [EventColor, ...EventColor[]]),
      isActive: z.boolean(),
      questions: z.array(question).max(10),
    })
    .superRefine((v, ctx) => {
      const online =
        v.locationType === "google_meet" || v.locationType === "zoom" || v.locationType === "custom_link";
      if (online && (!HTTPS.test(v.link) || v.link.length > 500)) {
        ctx.addIssue({ code: "custom", message: t.url, path: ["link"] });
      }
      if (v.locationType === "in_person" && (v.address.length < 1 || v.address.length > 300)) {
        ctx.addIssue({ code: "custom", message: t.required, path: ["address"] });
      }
      if (
        v.locationType === "phone" &&
        v.phoneMode === "guest_calls" &&
        !E164.test(normalizePhone(v.hostPhone))
      ) {
        ctx.addIssue({ code: "custom", message: t.phone, path: ["hostPhone"] });
      }
    })
    .transform((v): EventTypeRow => ({
      title: v.title,
      slug: v.slug,
      description: v.description.trim() || null,
      duration_minutes: v.durationMinutes,
      slot_interval_minutes: v.slotIntervalMinutes,
      location_type: v.locationType,
      location_value:
        v.locationType === "in_person"
          ? v.address
          : v.locationType === "phone"
            ? v.phoneMode === "guest_calls"
              ? normalizePhone(v.hostPhone)
              : null
            : v.link,
      phone_mode: v.locationType === "phone" ? v.phoneMode : null,
      buffer_before_minutes: v.bufferBeforeMinutes,
      buffer_after_minutes: v.bufferAfterMinutes,
      min_notice_minutes: v.minNoticeHours * 60,
      max_days_ahead: v.maxDaysAhead,
      daily_limit: v.dailyLimit,
      color: v.color,
      is_active: v.isActive,
      questions: v.questions,
    }));
}

/** Database row back into form values (edit page). */
export function toEventFormValues(row: EventTypeRow): EventFormValues {
  return {
    title: row.title,
    slug: row.slug,
    description: row.description ?? "",
    durationMinutes: String(row.duration_minutes),
    slotIntervalMinutes: String(row.slot_interval_minutes),
    locationType: row.location_type,
    link:
      row.location_type === "in_person" || row.location_type === "phone" ? "" : (row.location_value ?? ""),
    address: row.location_type === "in_person" ? (row.location_value ?? "") : "",
    phoneMode: row.phone_mode ?? "host_calls",
    hostPhone: row.location_type === "phone" ? (row.location_value ?? "") : "",
    bufferBeforeMinutes: String(row.buffer_before_minutes),
    bufferAfterMinutes: String(row.buffer_after_minutes),
    minNoticeHours: String(Math.round(row.min_notice_minutes / 60)),
    maxDaysAhead: String(row.max_days_ahead),
    dailyLimit: row.daily_limit === null ? "" : String(row.daily_limit),
    color: row.color,
    isActive: row.is_active,
    questions: row.questions.map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label,
      required: q.required,
      optionsText: (q.options ?? []).join("\n"),
    })),
  };
}

/** Weekly hours: "HH:MM" pairs per weekday (0 = Sunday). */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export type WeeklyInterval = { weekday: number; start: string; end: string };

/** Index of the first weekday with a bad or overlapping interval, or null. */
export function findWeeklyProblem(
  rules: WeeklyInterval[],
): { weekday: number; kind: "order" | "overlap" } | null {
  for (let day = 0; day < 7; day++) {
    const list = rules.filter((r) => r.weekday === day).sort((a, b) => a.start.localeCompare(b.start));
    for (const [i, r] of list.entries()) {
      if (!TIME_RE.test(r.start) || !TIME_RE.test(r.end) || r.start >= r.end)
        return { weekday: day, kind: "order" };
      if (i > 0 && r.start < list[i - 1].end) return { weekday: day, kind: "overlap" };
    }
  }
  return null;
}
