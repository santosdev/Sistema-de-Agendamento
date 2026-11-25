"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { notifyBooking } from "@/lib/email/notify";
import { z } from "zod";
import { dbErrorCode, toManageError, type ManageErrorCode } from "@/lib/booking/errors";
import { getMessages } from "@/lib/i18n";
import { addDays, isValidTimeZone } from "@/lib/scheduling/time";
import { createClient } from "@/lib/supabase/server";
import { eventTypeSchema, findWeeklyProblem, TIME_RE, USERNAME_RE } from "./schemas";

export type DashboardErrorCode =
  | ManageErrorCode
  | "not_authenticated"
  | "invalid_input"
  | "slug_taken"
  | "username_taken"
  | "username_reserved"
  | "override_conflict";

export type DashboardResult = { ok: true; id?: string } | { ok: false; error: DashboardErrorCode };

type PgError = { code?: string; message?: string; details?: string } | null;

/** Maps PostgREST errors to codes the dashboard explains. */
function toDashboardError(error: PgError, label: string): DashboardErrorCode {
  const code = dbErrorCode(error);
  if (code) return toManageError(code);
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  if (error?.code === "23505" && text.includes("event_types_host_slug_key")) return "slug_taken";
  if (error?.code === "23505" && text.includes("profiles_username_key")) return "username_taken";
  if (error?.code === "23514" && text.includes("profiles_username_not_reserved")) return "username_reserved";
  if (error?.code === "23P01" && text.includes("availability_overrides")) return "override_conflict";
  console.error(`${label} failed`, error);
  return "unknown";
}

/** Every action authorizes itself: the session is read again, never taken from the client. */
async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

const uuid = z.uuid();

// ---------------------------------------------------------------- meetings

/** RN-49, RN-50: the host cancels any time before the meeting ends. */
export async function hostCancelBookingAction(input: unknown): Promise<DashboardResult> {
  const parsed = z.object({ bookingId: uuid, reason: z.string().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.rpc("host_cancel_booking", {
    p_booking_id: parsed.data.bookingId,
    p_reason: parsed.data.reason ?? "",
  });
  if (error) return { ok: false, error: toDashboardError(error, "host_cancel_booking") };
  after(() => notifyBooking("host_cancelled", parsed.data.bookingId));
  refresh();
  return { ok: true };
}

/** RN-54: the host reschedules any time before the start, ignoring the minimum notice. */
export async function hostRescheduleBookingAction(input: unknown): Promise<DashboardResult> {
  const parsed = z.object({ bookingId: uuid, startAt: z.iso.datetime({ offset: true }) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.rpc("host_reschedule_booking", {
    p_booking_id: parsed.data.bookingId,
    p_new_start_at: parsed.data.startAt,
  });
  if (error) return { ok: false, error: toDashboardError(error, "host_reschedule_booking") };
  after(() => notifyBooking("host_rescheduled", parsed.data.bookingId));
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- event types

export async function saveEventTypeAction(input: unknown): Promise<DashboardResult> {
  const parsed = z.object({ id: uuid.optional(), values: z.unknown() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const row = eventTypeSchema(getMessages().dashboard.events.errors).safeParse(parsed.data.values);
  if (!row.success) return { ok: false, error: "invalid_input" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const { id } = parsed.data;
  const result = id
    ? await supabase
        .from("event_types")
        .update(row.data)
        .eq("id", id)
        .eq("host_id", userId)
        .select("id")
        .single()
    : await supabase
        .from("event_types")
        .insert({ ...row.data, host_id: userId })
        .select("id")
        .single();

  if (result.error) return { ok: false, error: toDashboardError(result.error, "save_event_type") };
  refresh();
  return { ok: true, id: result.data.id };
}

export async function setEventActiveAction(input: unknown): Promise<DashboardResult> {
  const parsed = z.object({ id: uuid, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("event_types")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.id)
    .eq("host_id", userId);
  if (error) return { ok: false, error: toDashboardError(error, "set_event_active") };
  refresh();
  return { ok: true };
}

/** RN-19: events are archived, never removed, so existing bookings stay valid. */
export async function archiveEventTypeAction(input: unknown): Promise<DashboardResult> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("event_types")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", parsed.data.id)
    .eq("host_id", userId);
  if (error) return { ok: false, error: toDashboardError(error, "archive_event_type") };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- availability

const weeklySchema = z
  .array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      start: z.string().regex(TIME_RE),
      end: z.string().regex(TIME_RE),
    }),
  )
  .max(70);

/** RN-20, RN-21: replaces the weekly hours. Validated first so the insert cannot fail halfway. */
export async function saveWeeklyHoursAction(input: unknown): Promise<DashboardResult> {
  const parsed = weeklySchema.safeParse(input);
  if (!parsed.success || findWeeklyProblem(parsed.data)) return { ok: false, error: "invalid_input" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const removed = await supabase.from("availability_rules").delete().eq("host_id", userId);
  if (removed.error) return { ok: false, error: toDashboardError(removed.error, "delete_rules") };

  if (parsed.data.length > 0) {
    const { error } = await supabase.from("availability_rules").insert(
      parsed.data.map((r) => ({
        host_id: userId,
        weekday: r.weekday,
        start_time: r.start,
        end_time: r.end,
      })),
    );
    if (error) return { ok: false, error: toDashboardError(error, "insert_rules") };
  }
  refresh();
  return { ok: true };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** RN-25, RN-26: one override per day of the range (day off or special hours). */
export async function addOverridesAction(input: unknown): Promise<DashboardResult> {
  const parsed = z
    .object({
      startDate: z.string().regex(DATE_RE),
      endDate: z.string().regex(DATE_RE),
      intervals: z
        .array(z.object({ start: z.string().regex(TIME_RE), end: z.string().regex(TIME_RE) }))
        .max(10),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { startDate, endDate, intervals } = parsed.data;
  const days: string[] = [];
  for (let d = startDate; d <= endDate && days.length <= 60; d = addDays(d, 1)) days.push(d);
  if (days.length === 0 || days.length > 60) return { ok: false, error: "invalid_input" };
  if (intervals.length && findWeeklyProblem(intervals.map((i) => ({ ...i, weekday: 0 })))) {
    return { ok: false, error: "invalid_input" };
  }
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };

  type OverrideRow = { host_id: string; date: string; start_time: string | null; end_time: string | null };
  const rows = days.flatMap((date): OverrideRow[] =>
    intervals.length
      ? intervals.map((i) => ({ host_id: userId, date, start_time: i.start, end_time: i.end }))
      : [{ host_id: userId, date, start_time: null, end_time: null }],
  );
  const { error } = await supabase.from("availability_overrides").insert(rows);
  if (error) return { ok: false, error: toDashboardError(error, "insert_overrides") };
  refresh();
  return { ok: true };
}

export async function deleteOverrideAction(input: unknown): Promise<DashboardResult> {
  const parsed = z.object({ date: z.string().regex(DATE_RE) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("availability_overrides")
    .delete()
    .eq("host_id", userId)
    .eq("date", parsed.data.date);
  if (error) return { ok: false, error: toDashboardError(error, "delete_override") };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- profile

const AVATAR_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/;

/** RN-03 to RN-09, RN-23. The username is stored in lowercase. */
export async function updateProfileAction(input: unknown): Promise<DashboardResult> {
  const parsed = z
    .object({
      displayName: z.string().trim().min(1).max(80),
      username: z.string().trim().toLowerCase().regex(USERNAME_RE),
      timeZone: z.string().refine(isValidTimeZone),
      welcomeMessage: z.string().trim().max(500),
      isPublic: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const v = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: v.displayName,
      username: v.username,
      time_zone: v.timeZone,
      welcome_message: v.welcomeMessage || null,
      is_public: v.isPublic,
    })
    .eq("id", userId);
  if (error) return { ok: false, error: toDashboardError(error, "update_profile") };
  refresh();
  return { ok: true };
}

/** RN-07: the file was uploaded by the browser to avatars/<user id>/; this links it (or clears it). */
export async function setAvatarAction(input: unknown): Promise<DashboardResult> {
  const parsed = z.object({ path: z.string().regex(AVATAR_PATH).nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "not_authenticated" };
  const { path } = parsed.data;
  if (path && !path.startsWith(`${userId}/`)) return { ok: false, error: "invalid_input" };

  const { data: current } = await supabase.from("profiles").select("avatar_path").eq("id", userId).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) return { ok: false, error: toDashboardError(error, "set_avatar") };

  // Best effort: the old file is no longer referenced.
  if (current?.avatar_path && current.avatar_path !== path) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }
  refresh();
  return { ok: true };
}
