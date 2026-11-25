import { beforeAll, describe, expect, it } from "vitest";
import { addMinutes, as, createTestDb, errorOf, nextUtc, service, user, type Db } from "./harness";
import { book, createEvent, setupHost } from "./fixtures";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

const getByToken = (token: string) =>
  as(db, service, async (tx) => {
    const { rows } = await tx.query<Record<string, unknown>>(
      "select * from public.get_booking_by_token($1)",
      [token],
    );
    return rows;
  });

const cancelByToken = (token: string, reason: string | null = null) =>
  as(db, service, async (tx) => {
    const { rows } = await tx.query<{ booking_id: string; ics_sequence: number }>(
      "select * from public.cancel_booking_by_token($1, $2)",
      [token, reason],
    );
    return rows[0];
  });

const rescheduleByToken = (token: string, start: Date) =>
  as(db, service, async (tx) => {
    const { rows } = await tx.query<{
      previous_start_at: Date;
      start_at: Date;
      end_at: Date;
      ics_sequence: number;
    }>("select * from public.reschedule_booking_by_token($1, $2)", [token, start.toISOString()]);
    return rows[0];
  });

/** Inserts a booking directly (bypassing the notice rule) and returns its token. */
async function insertBookingStartingIn(hostId: string, eventId: string, minutes: number) {
  const start = new Date(Date.now() + minutes * 60_000);
  start.setUTCSeconds(0, 0);
  const { rows } = await db.query<{ token: string }>(
    `with t as (select * from public._new_manage_token())
     insert into public.bookings (host_id, event_type_id, start_at, end_at, event_title, location_type,
       guest_name, guest_email, guest_time_zone, manage_token_hash)
     select $1, $2, $3, $4, 'x', 'zoom', 'Bia Lima', 'bia@example.com', 'UTC', t.token_hash from t
     returning (select token from t)`,
    [hostId, eventId, start.toISOString(), addMinutes(start, 30).toISOString()],
  );
  return rows[0].token;
}

describe("guest token flows (RN-47 to RN-55)", () => {
  it("reads a booking by token with host and event info", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host, { title: "Mentoria", min_notice_minutes: 120 });
    const start = nextUtc(2, 10);
    const created = await book(db, event, start);

    const [row] = await getByToken(created.manage_token);
    expect(row).toMatchObject({
      booking_id: created.booking_id,
      status: "confirmed",
      event_title: "Mentoria",
      host_id: host,
      can_modify: true,
      location_value: "https://meet.google.com/abc-defg-hij",
    });
    expect((row.modify_deadline as Date).toISOString()).toBe(addMinutes(start, -120).toISOString());
  });

  it("returns nothing for unknown or malformed tokens", async () => {
    expect(await getByToken("x".repeat(43))).toEqual([]);
    expect(await getByToken("short")).toEqual([]);
    expect(await getByToken("' or 1=1 --")).toEqual([]);
  });

  it("reschedules keeping the same row and token", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host, { duration_minutes: 60 });
    const start = nextUtc(3, 10);
    const created = await book(db, event, start);

    // Overlaps its own current slot: must not conflict with itself.
    const moved = await rescheduleByToken(created.manage_token, addMinutes(start, 30));
    expect(moved.previous_start_at.toISOString()).toBe(start.toISOString());
    expect(moved.end_at.toISOString()).toBe(addMinutes(start, 90).toISOString());
    expect(moved.ics_sequence).toBe(1);

    const [row] = await getByToken(created.manage_token);
    expect(row).toMatchObject({ status: "rescheduled", ics_sequence: 1 });

    const again = await rescheduleByToken(created.manage_token, addMinutes(start, 24 * 60));
    expect(again.ics_sequence).toBe(2);
  });

  it("keeps the original duration even if the event changed (RN-43)", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host, { duration_minutes: 30 });
    const start = nextUtc(3, 14);
    const created = await book(db, event, start);
    await db.query("update public.event_types set duration_minutes = 90 where id = $1", [event]);

    const moved = await rescheduleByToken(created.manage_token, addMinutes(start, 60));
    expect(moved.end_at.toISOString()).toBe(addMinutes(start, 90).toISOString());
  });

  it("does not reschedule onto another booking", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host);
    const a = await book(db, event, nextUtc(4, 10));
    await book(db, event, nextUtc(4, 11));
    expect(await errorOf(rescheduleByToken(a.manage_token, nextUtc(4, 11)))).toBe("slot_taken");
  });

  it("cancels once, then blocks further changes", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host);
    const start = nextUtc(5, 10);
    const created = await book(db, event, start);

    const cancelled = await cancelByToken(created.manage_token, "  Imprevisto  ");
    expect(cancelled.ics_sequence).toBe(1);

    const [row] = await getByToken(created.manage_token);
    expect(row).toMatchObject({
      status: "cancelled",
      cancelled_by: "guest",
      cancel_reason: "Imprevisto",
      can_modify: false,
      location_value: null,
    });

    expect(await errorOf(cancelByToken(created.manage_token))).toBe("booking_already_cancelled");
    expect(await errorOf(rescheduleByToken(created.manage_token, nextUtc(5, 12)))).toBe(
      "booking_already_cancelled",
    );

    // The freed slot can be booked again.
    await book(db, event, start);
  });

  it("blocks guest changes after the deadline (RN-48)", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host, { min_notice_minutes: 240 });
    const token = await insertBookingStartingIn(host, event, 60);

    expect(await errorOf(cancelByToken(token))).toBe("modification_deadline_passed");
    expect(await errorOf(rescheduleByToken(token, nextUtc(2, 10)))).toBe("modification_deadline_passed");
    const [row] = await getByToken(token);
    expect(row.can_modify).toBe(false);
  });

  it("rejects too long cancellation reasons", async () => {
    const event = await createEvent(db, await setupHost(db));
    const created = await book(db, event, nextUtc(6, 10));
    expect(await errorOf(cancelByToken(created.manage_token, "x".repeat(501)))).toBe("invalid_input");
  });
});

describe("host actions (RN-49, RN-54)", () => {
  const hostCancel = (hostId: string, bookingId: string) =>
    as(db, user(hostId), (tx) =>
      tx.query("select * from public.host_cancel_booking($1, $2)", [bookingId, "Agenda"]),
    );

  const hostReschedule = (hostId: string, bookingId: string, start: Date) =>
    as(db, user(hostId), (tx) =>
      tx.query("select * from public.host_reschedule_booking($1, $2)", [bookingId, start.toISOString()]),
    );

  it("lets the host cancel its own booking, even after the guest deadline", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host, { min_notice_minutes: 240 });
    const token = await insertBookingStartingIn(host, event, 60);
    const [row] = await getByToken(token);

    await hostCancel(host, row.booking_id as string);
    const [after] = await getByToken(token);
    expect(after).toMatchObject({ status: "cancelled", cancelled_by: "host", cancel_reason: "Agenda" });
  });

  it("does not let a host touch another host's booking", async () => {
    const owner = await setupHost(db);
    const intruder = await setupHost(db);
    const created = await book(db, await createEvent(db, owner), nextUtc(1, 12));

    expect(await errorOf(hostCancel(intruder, created.booking_id))).toBe("booking_not_found");
    expect(await errorOf(hostReschedule(intruder, created.booking_id, nextUtc(1, 13)))).toBe(
      "booking_not_found",
    );
  });

  it("lets the host reschedule inside the notice window, but not into the past or a conflict", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host, { min_notice_minutes: 48 * 60 });
    const other = await createEvent(db, host, { min_notice_minutes: 0 });
    const created = await book(db, event, nextUtc(2, 10, 0, 3));

    const soon = new Date(Date.now() + 3 * 60 * 60_000);
    soon.setUTCMinutes(0, 0, 0);
    await hostReschedule(host, created.booking_id, soon);

    const past = new Date(Date.now() - 2 * 60 * 60_000);
    past.setUTCMinutes(0, 0, 0);
    expect(await errorOf(hostReschedule(host, created.booking_id, past))).toBe("slot_in_past");

    const blocker = await book(db, other, addMinutes(soon, 24 * 60));
    expect(blocker.booking_id).toBeTruthy();
    expect(await errorOf(hostReschedule(host, created.booking_id, addMinutes(soon, 24 * 60)))).toBe(
      "slot_taken",
    );
  });

  it("requires a signed-in host", async () => {
    const created = await book(db, await createEvent(db, await setupHost(db)), nextUtc(3, 16));
    expect(
      await errorOf(
        db.transaction(async (tx) => {
          await tx.exec("set local role authenticated");
          await tx.query("select * from public.host_cancel_booking($1)", [created.booking_id]);
        }),
      ),
    ).toBe("not_authenticated");
  });
});
