import "server-only";
import type { LocationType, PhoneMode, Question } from "@/lib/booking/types";
import { getCurrentHost } from "@/lib/auth/session";
import type { EventColor } from "@/lib/design/tokens";
import { todayIn } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { EventTypeRow } from "./schemas";

export type MeetingsTab = "upcoming" | "past" | "cancelled";

export type HostMeeting = {
  id: string;
  status: "confirmed" | "rescheduled" | "cancelled";
  startAt: string;
  endAt: string;
  previousStartAt: string | null;
  eventTitle: string;
  eventSlug: string | null;
  eventColor: EventColor;
  locationType: LocationType;
  locationValue: string | null;
  phoneMode: PhoneMode | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestTimeZone: string;
  answers: { label: string; value: string | string[] }[];
  cancelReason: string | null;
  cancelledBy: "guest" | "host" | null;
};

const LIMIT = 200;

/** Meetings of the signed-in host (RLS: own bookings only). */
export async function getMeetings(tab: MeetingsTab): Promise<HostMeeting[]> {
  const host = await getCurrentHost();
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("bookings")
    .select(
      "id, status, start_at, end_at, previous_start_at, event_title, location_type, location_value, phone_mode, guest_name, guest_email, guest_phone, guest_time_zone, answers, cancel_reason, cancelled_by, event_types(slug, color)",
    )
    .eq("host_id", host.id)
    .limit(LIMIT);

  if (tab === "cancelled") query = query.eq("status", "cancelled").order("start_at", { ascending: false });
  else if (tab === "past")
    query = query.neq("status", "cancelled").lt("end_at", now).order("start_at", { ascending: false });
  else query = query.neq("status", "cancelled").gte("end_at", now).order("start_at");

  const { data, error } = await query;
  if (error) throw error;

  return data.map((b) => ({
    id: b.id,
    status: b.status,
    startAt: b.start_at,
    endAt: b.end_at,
    previousStartAt: b.previous_start_at,
    eventTitle: b.event_title,
    eventSlug: b.event_types?.slug ?? null,
    eventColor: b.event_types?.color ?? "violet",
    locationType: b.location_type,
    locationValue: b.location_value,
    phoneMode: b.phone_mode,
    guestName: b.guest_name,
    guestEmail: b.guest_email,
    guestPhone: b.guest_phone,
    guestTimeZone: b.guest_time_zone,
    answers: Array.isArray(b.answers) ? (b.answers as HostMeeting["answers"]) : [],
    cancelReason: b.cancel_reason,
    cancelledBy: b.cancelled_by,
  }));
}

export type HostEventType = EventTypeRow & { id: string; isSeed: boolean };

const EVENT_COLUMNS =
  "id, title, slug, description, duration_minutes, slot_interval_minutes, location_type, location_value, phone_mode, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_ahead, daily_limit, color, is_active, questions, is_seed";

type EventRowWithMeta = Omit<HostEventType, "isSeed" | "questions"> & {
  is_seed: boolean;
  questions: unknown;
};

const toHostEvent = ({ is_seed, questions, ...row }: EventRowWithMeta): HostEventType => ({
  ...row,
  questions: (Array.isArray(questions) ? questions : []) as Question[],
  isSeed: is_seed,
});

/** Event types of the signed-in host, archived ones excluded (RN-19). */
export async function getEventTypes(): Promise<HostEventType[]> {
  const host = await getCurrentHost();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_types")
    .select(EVENT_COLUMNS)
    .eq("host_id", host.id)
    .is("archived_at", null)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data as EventRowWithMeta[]).map(toHostEvent);
}

export async function getEventType(id: string): Promise<HostEventType | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const host = await getCurrentHost();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_types")
    .select(EVENT_COLUMNS)
    .eq("host_id", host.id)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? toHostEvent(data as EventRowWithMeta) : null;
}

export type HostOverride = { date: string; intervals: { start: string; end: string }[] };

/** Weekly rules and upcoming overrides (grouped by date) of the signed-in host. */
export async function getAvailability() {
  const host = await getCurrentHost();
  const supabase = await createClient();
  const [rules, overrides] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("weekday, start_time, end_time")
      .eq("host_id", host.id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("availability_overrides")
      .select("date, start_time, end_time")
      .eq("host_id", host.id)
      .gte("date", todayIn(host.timeZone))
      .order("date")
      .order("start_time"),
  ]);
  if (rules.error) throw rules.error;
  if (overrides.error) throw overrides.error;

  const hhmm = (t: string) => t.slice(0, 5);
  const byDate = new Map<string, HostOverride>();
  for (const o of overrides.data) {
    const entry = byDate.get(o.date) ?? { date: o.date, intervals: [] };
    if (o.start_time && o.end_time)
      entry.intervals.push({ start: hhmm(o.start_time), end: hhmm(o.end_time) });
    byDate.set(o.date, entry);
  }

  return {
    timeZone: host.timeZone,
    rules: rules.data.map((r) => ({ weekday: r.weekday, start: hhmm(r.start_time), end: hhmm(r.end_time) })),
    overrides: [...byDate.values()],
  };
}
