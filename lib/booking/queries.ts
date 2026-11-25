import "server-only";
import { cache } from "react";
import type { EventColor } from "@/lib/design/tokens";
import { publicEnv } from "@/lib/env/public";
import type { BusyRange, DateOverride, SlotEvent, WeeklyRule } from "@/lib/scheduling";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import type { LocationType, ManagedBooking, PhoneMode, PublicEvent, PublicHost, Question } from "./types";

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return `${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}

/** Public host by username, or null (unknown, private or invalid). Deduplicated per request. */
export const getPublicHost = cache(async (username: string): Promise<PublicHost | null> => {
  const normalized = username.toLowerCase();
  if (!USERNAME_RE.test(normalized)) return null;

  const { data, error } = await createPublicClient()
    .from("profiles")
    .select("id, username, display_name, avatar_path, time_zone, welcome_message")
    .eq("username", normalized)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: avatarUrl(data.avatar_path),
    timeZone: data.time_zone,
    welcomeMessage: data.welcome_message,
  };
});

const EVENT_COLUMNS =
  "id, slug, title, description, duration_minutes, max_days_ahead, location_type, location_value, phone_mode, color, questions";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  max_days_ahead: number;
  location_type: LocationType;
  location_value: string | null;
  phone_mode: PhoneMode | null;
  color: EventColor;
  questions: unknown;
};

function toPublicEvent(row: EventRow): PublicEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    durationMinutes: row.duration_minutes,
    maxDaysAhead: row.max_days_ahead,
    locationType: row.location_type,
    phoneMode: row.phone_mode,
    // RN-11: online links and the host phone are revealed only after booking.
    address: row.location_type === "in_person" ? row.location_value : null,
    color: row.color,
    questions: (Array.isArray(row.questions) ? row.questions : []) as Question[],
  };
}

/** Active events of a public host (RLS already hides inactive and archived ones). */
export const getPublicEvents = cache(async (hostId: string): Promise<PublicEvent[]> => {
  const { data, error } = await createPublicClient()
    .from("event_types")
    .select(EVENT_COLUMNS)
    .eq("host_id", hostId)
    .order("position")
    .order("created_at");

  if (error) throw error;
  return (data as EventRow[]).map(toPublicEvent);
});

export const getPublicEvent = cache(async (hostId: string, slug: string): Promise<PublicEvent | null> => {
  if (!SLUG_RE.test(slug)) return null;

  const { data, error } = await createPublicClient()
    .from("event_types")
    .select(EVENT_COLUMNS)
    .eq("host_id", hostId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data ? toPublicEvent(data as EventRow) : null;
});

/**
 * Everything the slot generator needs for one event.
 * `trusted`: the caller already verified the signed-in host owns this data (host reschedule).
 * It reads with the secret key, so private hosts and inactive events still work.
 */
export async function getSlotInputs(
  hostId: string,
  eventId: string,
  from: Date,
  to: Date,
  { trusted = false }: { trusted?: boolean } = {},
) {
  const db = trusted ? createAdminClient() : createPublicClient();
  const DAY = 86_400_000;
  const busyFrom = new Date(from.getTime() - DAY).toISOString();
  const busyTo = new Date(to.getTime() + DAY).toISOString();

  const [event, rules, overrides, busy] = await Promise.all([
    db
      .from("event_types")
      .select(
        "id, duration_minutes, slot_interval_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_ahead, daily_limit",
      )
      .eq("id", eventId)
      .eq("host_id", hostId)
      .single(),
    db.from("availability_rules").select("weekday, start_time, end_time").eq("host_id", hostId),
    db
      .from("availability_overrides")
      .select("date, start_time, end_time")
      .eq("host_id", hostId)
      .gte("date", new Date(from.getTime() - DAY).toISOString().slice(0, 10))
      .lte("date", new Date(to.getTime() + DAY).toISOString().slice(0, 10)),
    // One extra day on each side: buffers and the host-day daily limit.
    trusted
      ? db
          .from("bookings")
          .select("event_type_id, start_at, end_at, blocked_from, blocked_until")
          .eq("host_id", hostId)
          .neq("status", "cancelled")
          .lt("blocked_from", busyTo)
          .gt("blocked_until", busyFrom)
      : db.rpc("get_busy_ranges", { p_host_id: hostId, p_from: busyFrom, p_to: busyTo }),
  ]);

  for (const result of [event, rules, overrides, busy]) {
    if (result.error) throw result.error;
  }

  const e = event.data!;
  const slotEvent: SlotEvent = {
    id: e.id,
    durationMinutes: e.duration_minutes,
    slotIntervalMinutes: e.slot_interval_minutes,
    bufferBeforeMinutes: e.buffer_before_minutes,
    bufferAfterMinutes: e.buffer_after_minutes,
    minNoticeMinutes: e.min_notice_minutes,
    maxDaysAhead: e.max_days_ahead,
    dailyLimit: e.daily_limit,
  };

  const weeklyRules: WeeklyRule[] = rules.data!.map((r) => ({
    weekday: r.weekday,
    startTime: r.start_time,
    endTime: r.end_time,
  }));

  const dateOverrides: DateOverride[] = overrides.data!.map((o) => ({
    date: o.date,
    startTime: o.start_time,
    endTime: o.end_time,
  }));

  const busyRanges: BusyRange[] = busy.data!.map((b) => ({
    eventTypeId: b.event_type_id,
    start: new Date(b.start_at),
    blockedFrom: new Date(b.blocked_from),
    blockedUntil: new Date(b.blocked_until),
  }));

  return { event: slotEvent, rules: weeklyRules, overrides: dateOverrides, busy: busyRanges };
}

/** Booking for the guest management page. Server only (uses the secret key). */
export const getBookingByToken = cache(async (token: string): Promise<ManagedBooking | null> => {
  if (!TOKEN_RE.test(token)) return null;

  const { data, error } = await createAdminClient().rpc("get_booking_by_token", { p_token: token });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;

  return {
    id: row.booking_id,
    status: row.status,
    startAt: row.start_at,
    endAt: row.end_at,
    previousStartAt: row.previous_start_at ?? null,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestTimeZone: row.guest_time_zone,
    eventTypeId: row.event_type_id,
    eventSlug: row.event_slug,
    eventTitle: row.event_title,
    eventColor: row.event_color,
    locationType: row.location_type,
    locationValue: row.location_value ?? null,
    phoneMode: row.phone_mode ?? null,
    host: {
      id: row.host_id,
      username: row.host_username,
      displayName: row.host_display_name,
      avatarUrl: avatarUrl(row.host_avatar_path ?? null),
      timeZone: row.host_time_zone,
    },
    cancelReason: row.cancel_reason ?? null,
    cancelledBy: row.cancelled_by ?? null,
    icsSequence: row.ics_sequence,
    modifyDeadline: row.modify_deadline,
    canModify: row.can_modify,
  };
});
