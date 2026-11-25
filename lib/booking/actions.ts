"use server";

import { after } from "next/server";
import { notifyBooking } from "@/lib/email/notify";
import { getMessages } from "@/lib/i18n";
import { isValidTimeZone } from "@/lib/scheduling/time";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dbErrorCode,
  toBookingError,
  toManageError,
  type BookingErrorCode,
  type ManageErrorCode,
} from "./errors";
import { getPublicEvent, getPublicHost } from "./queries";
import { clientIp, consumeRateLimit, rateLimitBucket } from "./rate-limit";
import {
  cancelRequestSchema,
  createBookingRequestSchema,
  guestFormSchema,
  rescheduleRequestSchema,
} from "./schemas";
import type { CreatedBooking } from "./types";

export type CreateBookingResult =
  { ok: true; booking: CreatedBooking } | { ok: false; error: BookingErrorCode };
export type ManageResult = { ok: true } | { ok: false; error: ManageErrorCode };

const UNEXPECTED = { ok: false, error: "unknown" } as const;

/**
 * Unexpected failures (invalid env, network, Supabase down) are logged and returned as
 * "unknown", so the guest sees an error message instead of a button stuck in loading.
 */
async function safely<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`${label} failed`, error);
    return fallback;
  }
}

export async function createBookingAction(input: unknown): Promise<CreateBookingResult> {
  return safely("createBookingAction", () => createBooking(input), UNEXPECTED);
}

export async function cancelBookingAction(input: unknown): Promise<ManageResult> {
  return safely("cancelBookingAction", () => cancelBooking(input), UNEXPECTED);
}

export async function rescheduleBookingAction(input: unknown): Promise<ManageResult> {
  return safely("rescheduleBookingAction", () => rescheduleBooking(input), UNEXPECTED);
}

/**
 * Guest booking (RN-39 to RN-43, RN-59, RN-60).
 * Validates with Zod, applies the honeypot and the rate limit, then calls the
 * database function, which validates everything again.
 */
async function createBooking(input: unknown): Promise<CreateBookingResult> {
  const request = createBookingRequestSchema.safeParse(input);
  if (!request.success) return { ok: false, error: "invalid_guest" };
  const { username, eventSlug, startAt, timeZone } = request.data;

  const host = await getPublicHost(username);
  const event = host ? await getPublicEvent(host.id, eventSlug) : null;
  if (!host || !event) return { ok: false, error: "event_not_found" };

  const guest = guestFormSchema(event, getMessages().booking.form).safeParse(request.data.guest);
  if (!guest.success) {
    const answersFailed = guest.error.issues.some((issue) => issue.path[0] === "answers");
    return { ok: false, error: answersFailed ? "invalid_answers" : "invalid_guest" };
  }

  // Honeypot: bots fill every field. Refuse without saying why.
  if (guest.data.website) return { ok: false, error: "unknown" };

  if (!isValidTimeZone(timeZone)) return { ok: false, error: "invalid_guest" };

  const allowed = await consumeRateLimit([
    rateLimitBucket("book:ip", await clientIp()),
    rateLimitBucket("book:email", guest.data.email),
  ]);
  if (!allowed) return { ok: false, error: "rate_limited" };

  // Drop empty optional answers; the database rejects unknown or invalid ones.
  const answers = Object.fromEntries(
    Object.entries(guest.data.answers).filter(
      ([, value]) => value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0),
    ),
  );

  const db = createAdminClient();
  const { data, error } = await db.rpc("create_booking", {
    p_event_type_id: event.id,
    p_start_at: startAt,
    p_guest_name: guest.data.name,
    p_guest_email: guest.data.email,
    p_guest_phone: guest.data.phone,
    p_guest_time_zone: timeZone,
    p_answers: answers,
  });

  if (error || !data?.[0]) {
    const code = dbErrorCode(error);
    if (!code) console.error("create_booking failed", error);
    return { ok: false, error: toBookingError(code) };
  }

  const created = data[0];
  after(() => notifyBooking("created", created.booking_id, created.manage_token));
  const { data: booking } = await db
    .from("bookings")
    .select("location_value")
    .eq("id", created.booking_id)
    .single();

  return {
    ok: true,
    booking: {
      token: created.manage_token,
      startAt: created.start_at,
      endAt: created.end_at,
      guestEmail: guest.data.email,
      guestTimeZone: timeZone,
      locationValue: booking?.location_value ?? null,
    },
  };
}

async function manageAllowed(): Promise<boolean> {
  return consumeRateLimit([rateLimitBucket("manage:ip", await clientIp())]);
}

/** Guest cancellation through the manage link (RN-48, RN-50). */
async function cancelBooking(input: unknown): Promise<ManageResult> {
  const request = cancelRequestSchema.safeParse(input);
  if (!request.success) return { ok: false, error: "booking_not_found" };
  if (!(await manageAllowed())) return { ok: false, error: "rate_limited" };

  const { data, error } = await createAdminClient().rpc("cancel_booking_by_token", {
    p_token: request.data.token,
    p_reason: request.data.reason ?? "",
  });

  if (error) {
    const code = dbErrorCode(error);
    if (!code) console.error("cancel_booking_by_token failed", error);
    return { ok: false, error: toManageError(code) };
  }
  const bookingId = data?.[0]?.booking_id;
  if (bookingId) after(() => notifyBooking("guest_cancelled", bookingId, request.data.token));
  return { ok: true };
}

/** Guest reschedule through the manage link (RN-52 to RN-55). */
async function rescheduleBooking(input: unknown): Promise<ManageResult> {
  const request = rescheduleRequestSchema.safeParse(input);
  if (!request.success) return { ok: false, error: "booking_not_found" };
  if (!(await manageAllowed())) return { ok: false, error: "rate_limited" };

  const { data, error } = await createAdminClient().rpc("reschedule_booking_by_token", {
    p_token: request.data.token,
    p_new_start_at: request.data.startAt,
  });

  if (error) {
    const code = dbErrorCode(error);
    if (!code) console.error("reschedule_booking_by_token failed", error);
    return { ok: false, error: toManageError(code) };
  }
  const bookingId = data?.[0]?.booking_id;
  if (bookingId) after(() => notifyBooking("guest_rescheduled", bookingId, request.data.token));
  return { ok: true };
}
