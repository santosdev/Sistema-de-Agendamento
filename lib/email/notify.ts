import "server-only";
import { publicEnv } from "@/lib/env/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBookingEmails, type BookingEmailData, type NoticeKind } from "./booking-emails";
import { sendEmail } from "./send";

/**
 * Sends the e-mails for a booking change. Runs after the response (next/server `after`)
 * and never throws: e-mail problems are logged and never undo the booking (RN-58).
 */
export async function notifyBooking(kind: NoticeKind, bookingId: string, token?: string): Promise<void> {
  try {
    const data = await loadBooking(bookingId, token);
    if (!data) return;
    await Promise.all(buildBookingEmails(kind, data).map(sendEmail));
  } catch (error) {
    console.error("notifyBooking failed", kind, bookingId, error);
  }
}

async function loadBooking(id: string, token?: string): Promise<BookingEmailData | null> {
  const db = createAdminClient();
  const appUrl = publicEnv().NEXT_PUBLIC_APP_URL;

  const { data: b, error } = await db
    .from("bookings")
    .select(
      "id, host_id, status, start_at, end_at, previous_start_at, ics_sequence, event_title, location_type, location_value, phone_mode, cancel_reason, guest_name, guest_email, guest_phone, guest_time_zone, event_types(slug)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!b) return null;

  const [{ data: host }, { data: user }] = await Promise.all([
    db.from("profiles").select("display_name, username, time_zone, is_seed").eq("id", b.host_id).single(),
    db.auth.admin.getUserById(b.host_id),
  ]);
  if (!host) return null;

  return {
    id: b.id,
    status: b.status,
    startAt: b.start_at,
    endAt: b.end_at,
    previousStartAt: b.previous_start_at,
    icsSequence: b.ics_sequence,
    eventTitle: b.event_title,
    eventUrl: b.event_types?.slug
      ? `${appUrl}/${host.username}/${b.event_types.slug}`
      : `${appUrl}/${host.username}`,
    locationType: b.location_type,
    locationValue: b.location_value,
    phoneMode: b.phone_mode,
    cancelReason: b.cancel_reason,
    guest: { name: b.guest_name, email: b.guest_email, phone: b.guest_phone, timeZone: b.guest_time_zone },
    host: {
      name: host.display_name,
      email: user?.user?.email ?? null,
      timeZone: host.time_zone,
      isDemo: host.is_seed,
    },
    manageUrl: token ? `${appUrl}/booking/${token}` : null,
    dashboardUrl: `${appUrl}/dashboard`,
  };
}
