import { z } from "zod";
import type { Messages } from "@/lib/i18n";
import type { PublicEvent, Question } from "./types";

/**
 * Normalizes a phone typed by a guest into E.164.
 * "(11) 91234-5678" -> "+5511912345678" (RN-20: +55 by default).
 */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") return "";
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (trimmed.startsWith("00")) return `+${digits.slice(2)}`;
  // Brazilian numbers without country code: 10 or 11 digits (with area code).
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

const E164 = /^\+[1-9][0-9]{7,14}$/;

function answerSchema(q: Question, t: Messages["booking"]["form"]) {
  if (q.type === "multi_choice") {
    const base = z.array(z.enum(q.options as [string, ...string[]]));
    return q.required ? base.min(1, t.required) : base.optional();
  }
  if (q.type === "single_choice") {
    const options = q.options as [string, ...string[]];
    return q.required
      ? z.enum(options, { error: t.required })
      : z.union([z.enum(options), z.literal("")]).optional();
  }
  const max = q.type === "short_text" ? 200 : 2000;
  const base = z.string().trim().max(max, t.tooLong);
  return q.required ? base.min(1, t.required) : base.optional();
}

/** Guest form schema for one event (client and server). */
export function guestFormSchema(
  event: Pick<PublicEvent, "questions" | "locationType" | "phoneMode">,
  t: Messages["booking"]["form"],
) {
  const phoneRequired = event.locationType === "phone" && event.phoneMode === "host_calls";

  return z.object({
    name: z.string().trim().min(2, t.nameTooShort).max(100, t.tooLong),
    email: z.string().trim().toLowerCase().pipe(z.email(t.invalidEmail)).pipe(z.string().max(254, t.tooLong)),
    phone: z
      .string()
      .transform(normalizePhone)
      .refine((v) => (v === "" ? !phoneRequired : E164.test(v)), {
        error: phoneRequired ? t.phoneRequired : t.invalidPhone,
      }),
    answers: z.object(Object.fromEntries(event.questions.map((q) => [q.id, answerSchema(q, t)]))),
    /** Honeypot (RN, 6.1): humans never see or fill it. */
    website: z.string().optional(),
  });
}

export type GuestFormValues = z.input<ReturnType<typeof guestFormSchema>>;

/** Fields that do not depend on the event, validated first on the server. */
export const createBookingRequestSchema = z.object({
  username: z.string().min(3).max(30),
  eventSlug: z.string().min(1).max(60),
  startAt: z.iso.datetime({ offset: true }),
  timeZone: z.string().min(1).max(64),
  guest: z.unknown(),
});

export const rescheduleRequestSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  startAt: z.iso.datetime({ offset: true }),
});

export const cancelRequestSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  reason: z.string().trim().max(500).optional(),
});
