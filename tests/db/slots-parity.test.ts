/**
 * Parity: the TypeScript slot generator must offer exactly the start times the
 * database accepts. For every candidate on a 5 minute grid, the database answers
 * "bookable?" (public._assert_bookable + the overlap constraint) and the result
 * must equal generateSlots for the same data.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { generateSlots, type BusyRange, type SlotEvent } from "@/lib/scheduling/slots";
import { createTestDb, type Db } from "./harness";
import { createEvent, setupHost } from "./fixtures";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
  // Database oracle for one candidate start.
  await db.exec(`
    create function public.test_is_bookable(p_event_id uuid, p_start timestamptz)
    returns boolean language plpgsql as $$
    declare
      e public.event_types;
      tz text;
      v_end timestamptz;
    begin
      select * into e from public.event_types where id = p_event_id;
      select time_zone into tz from public.profiles where id = e.host_id;
      perform public._assert_bookable(e, tz, p_start, e.duration_minutes, null, true);
      v_end := p_start + make_interval(mins => e.duration_minutes);
      return not exists (
        select 1 from public.bookings b
        where b.host_id = e.host_id and b.status <> 'cancelled'
          and tstzrange(b.blocked_from, b.blocked_until, '[)')
           && tstzrange(p_start - make_interval(mins => e.buffer_before_minutes),
                        v_end + make_interval(mins => e.buffer_after_minutes), '[)')
      );
    exception when others then
      return false;
    end $$;
  `);
});

type EventRow = {
  id: string;
  duration_minutes: number;
  slot_interval_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  daily_limit: number | null;
};

async function loadAndCompare(hostId: string, eventId: string, from: Date, to: Date) {
  const { rows: nowRows } = await db.query<{ now: Date }>("select now() as now");
  const now = nowRows[0].now;

  const {
    rows: [profile],
  } = await db.query<{ time_zone: string }>("select time_zone from public.profiles where id = $1", [hostId]);
  const {
    rows: [e],
  } = await db.query<EventRow>("select * from public.event_types where id = $1", [eventId]);
  const { rows: rules } = await db.query<{ weekday: number; start_time: string; end_time: string }>(
    "select weekday, start_time::text, end_time::text from public.availability_rules where host_id = $1",
    [hostId],
  );
  const { rows: overrides } = await db.query<{
    date: string;
    start_time: string | null;
    end_time: string | null;
  }>(
    "select date::text, start_time::text, end_time::text from public.availability_overrides where host_id = $1",
    [hostId],
  );
  const { rows: busyRows } = await db.query<{
    event_type_id: string;
    start_at: Date;
    blocked_from: Date;
    blocked_until: Date;
  }>("select * from public.get_busy_ranges($1, $2, $3)", [
    hostId,
    new Date(from.getTime() - 86_400_000).toISOString(),
    new Date(to.getTime() + 86_400_000).toISOString(),
  ]);

  const event: SlotEvent = {
    id: e.id,
    durationMinutes: e.duration_minutes,
    slotIntervalMinutes: e.slot_interval_minutes,
    bufferBeforeMinutes: e.buffer_before_minutes,
    bufferAfterMinutes: e.buffer_after_minutes,
    minNoticeMinutes: e.min_notice_minutes,
    maxDaysAhead: e.max_days_ahead,
    dailyLimit: e.daily_limit,
  };
  const busy: BusyRange[] = busyRows.map((b) => ({
    eventTypeId: b.event_type_id,
    start: b.start_at,
    blockedFrom: b.blocked_from,
    blockedUntil: b.blocked_until,
  }));

  const generated = generateSlots({
    event,
    hostTimeZone: profile.time_zone,
    rules: rules.map((r) => ({ weekday: r.weekday, startTime: r.start_time, endTime: r.end_time })),
    overrides: overrides.map((o) => ({ date: o.date, startTime: o.start_time, endTime: o.end_time })),
    busy,
    now,
    from,
    to,
  }).map((d) => d.toISOString());

  const { rows: accepted } = await db.query<{ s: Date }>(
    `select s from generate_series($2::timestamptz, $3::timestamptz - interval '1 minute', interval '5 minutes') s
     where public.test_is_bookable($1, s) order by s`,
    [eventId, from.toISOString(), to.toISOString()],
  );

  return { generated, accepted: accepted.map((r) => r.s.toISOString()) };
}

async function insertBooking(
  hostId: string,
  eventId: string,
  start: string,
  minutes: number,
  opts: { before?: number; after?: number; cancelled?: boolean } = {},
) {
  await db.query(
    `insert into public.bookings (host_id, event_type_id, start_at, end_at, buffer_before_minutes, buffer_after_minutes,
       event_title, location_type, guest_name, guest_email, guest_time_zone, manage_token_hash,
       status, cancelled_at, cancelled_by)
     values ($1, $2, $3::timestamptz, $3::timestamptz + make_interval(mins => $4), $5, $6,
       'x', 'zoom', 'Ana Lima', 'ana@example.com', 'UTC', extensions.digest(gen_random_uuid()::text, 'sha256'),
       $7::public.booking_status, case when $7 = 'cancelled' then now() end,
       case when $7 = 'cancelled' then 'guest'::public.booking_actor end)`,
    [
      hostId,
      eventId,
      start,
      minutes,
      opts.before ?? 0,
      opts.after ?? 0,
      opts.cancelled ? "cancelled" : "confirmed",
    ],
  );
}

describe("slot generator matches the database", () => {
  it("New York host across the March 2027 DST change, with overrides, bookings, buffers and a daily limit", async () => {
    const host = await setupHost(db, { timeZone: "America/New_York", allDay: false });
    await db.query("delete from public.availability_rules where host_id = $1", [host]);
    await db.query(
      `insert into public.availability_rules (host_id, weekday, start_time, end_time) values
         ($1, 1, '09:00', '12:00'), ($1, 1, '13:00', '17:00'),
         ($1, 2, '09:00', '12:00'), ($1, 3, '08:30', '17:45'),
         ($1, 4, '09:00', '17:00'), ($1, 5, '09:00', '12:00'),
         ($1, 6, '10:00', '12:00')`,
      [host],
    );
    await db.query(
      `insert into public.availability_overrides (host_id, date, start_time, end_time) values
         ($1, '2027-03-09', null, null),
         ($1, '2027-03-11', '18:00', '21:00'),
         ($1, '2027-03-14', '01:00', '05:00'),
         ($1, '2027-03-14', '22:00', '24:00')`,
      [host],
    );

    const event = await createEvent(db, host, {
      duration_minutes: 45,
      slot_interval_minutes: 15,
      buffer_before_minutes: 10,
      buffer_after_minutes: 20,
      min_notice_minutes: 0,
      max_days_ahead: 365,
      daily_limit: 3,
    });
    const other = await createEvent(db, host, { duration_minutes: 30 });

    // Busy: another event type with its own buffers, a cancelled booking, and
    // three bookings of the limited event on Wednesday (daily limit reached).
    await insertBooking(host, other, "2027-03-08T15:00:00Z", 30, { before: 15, after: 15 }); // Mon 10:00 EST
    await insertBooking(host, other, "2027-03-08T19:30:00Z", 30, { cancelled: true }); // Mon 14:30 EST
    await insertBooking(host, event, "2027-03-10T14:00:00Z", 45, { before: 10, after: 20 });
    await insertBooking(host, event, "2027-03-10T16:00:00Z", 45, { before: 10, after: 20 });
    await insertBooking(host, event, "2027-03-10T19:00:00Z", 45, { before: 10, after: 20 });
    await insertBooking(host, event, "2027-03-15T14:00:00Z", 45, { before: 10, after: 20 }); // Mon 10:00 EDT

    const { generated, accepted } = await loadAndCompare(
      host,
      event,
      new Date("2027-03-08T00:00:00Z"),
      new Date("2027-03-17T00:00:00Z"),
    );

    expect(generated.length).toBeGreaterThan(50);
    expect(generated).toEqual(accepted);
  });

  it("Sao Paulo host near now, with minimum notice and the booking window", async () => {
    const host = await setupHost(db, { timeZone: "America/Sao_Paulo", allDay: false });
    await db.query("delete from public.availability_rules where host_id = $1", [host]);
    await db.query(
      `insert into public.availability_rules (host_id, weekday, start_time, end_time)
       select $1, d, t.s, t.e from generate_series(0, 6) d
       cross join (values (time '00:00', time '06:00'), (time '07:00', time '24:00')) t(s, e)`,
      [host],
    );
    const event = await createEvent(db, host, {
      duration_minutes: 30,
      slot_interval_minutes: 20,
      min_notice_minutes: 300,
      max_days_ahead: 2,
    });

    const from = new Date(Date.now() - 3_600_000);
    from.setUTCMinutes(0, 0, 0);
    const to = new Date(from.getTime() + 4 * 86_400_000);

    const { generated, accepted } = await loadAndCompare(host, event, from, to);
    expect(generated.length).toBeGreaterThan(50);
    expect(generated).toEqual(accepted);
  });

  it("host in a zone with a midnight DST jump (Santiago, September 2027)", async () => {
    const host = await setupHost(db, { timeZone: "America/Santiago" });
    const event = await createEvent(db, host, {
      duration_minutes: 60,
      slot_interval_minutes: 30,
      min_notice_minutes: 0,
      max_days_ahead: 365,
    });

    const { generated, accepted } = await loadAndCompare(
      host,
      event,
      new Date("2027-09-04T00:00:00Z"),
      new Date("2027-09-07T00:00:00Z"),
    );
    expect(generated.length).toBeGreaterThan(100);
    expect(generated).toEqual(accepted);
  });
});
