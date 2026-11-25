import { beforeAll, describe, expect, it } from "vitest";
import { addMinutes, errorOf, nextUtc, type Db, createTestDb } from "./harness";
import { book, createEvent, setupHost } from "./fixtures";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

describe("create_booking", () => {
  it("creates a booking and returns a random 43 char token, storing only its hash (RN-45/46)", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host);
    const start = nextUtc(3, 14);

    const created = await book(db, event, start, { email: "  Ana@Example.COM " });

    expect(created.manage_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.start_at.toISOString()).toBe(start.toISOString());
    expect(created.end_at.toISOString()).toBe(addMinutes(start, 30).toISOString());

    const { rows } = await db.query<{
      matches: boolean;
      has_plain: boolean;
      guest_email: string;
      status: string;
    }>(
      `select manage_token_hash = extensions.digest($2, 'sha256') as matches,
              position($2 in row_to_json(b)::text) > 0 as has_plain,
              guest_email, status
       from public.bookings b where id = $1`,
      [created.booking_id, created.manage_token],
    );
    expect(rows[0]).toEqual({
      matches: true,
      has_plain: false,
      guest_email: "ana@example.com",
      status: "confirmed",
    });
  });

  it("generates different tokens for every booking", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host);
    const a = await book(db, event, nextUtc(1, 10));
    const b = await book(db, event, nextUtc(1, 11));
    expect(a.manage_token).not.toBe(b.manage_token);
  });

  it("copies event data into the booking (RN-43)", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host, {
      title: "Diagnóstico",
      buffer_before_minutes: 10,
      buffer_after_minutes: 5,
    });
    const created = await book(db, event, nextUtc(2, 15));

    await db.query("update public.event_types set title = 'Outro', buffer_after_minutes = 60 where id = $1", [
      event,
    ]);

    const { rows } = await db.query<Record<string, unknown>>(
      "select event_title, buffer_before_minutes, buffer_after_minutes, location_type from public.bookings where id = $1",
      [created.booking_id],
    );
    expect(rows[0]).toEqual({
      event_title: "Diagnóstico",
      buffer_before_minutes: 10,
      buffer_after_minutes: 5,
      location_type: "google_meet",
    });
  });
});

describe("conflict constraint (RN-41)", () => {
  it("rejects an overlapping booking for the same host", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host, { duration_minutes: 60 });
    const start = nextUtc(4, 10);
    await book(db, event, start);

    expect(await errorOf(book(db, event, addMinutes(start, 30)))).toBe("slot_taken");
    expect(await errorOf(book(db, event, start))).toBe("slot_taken");
  });

  it("applies the conflict across different event types of the same host (RN-33)", async () => {
    const host = await setupHost(db);
    const a = await createEvent(db, host);
    const b = await createEvent(db, host);
    const start = nextUtc(4, 13);
    await book(db, a, start);
    expect(await errorOf(book(db, b, start))).toBe("slot_taken");
  });

  it("allows the same time for different hosts", async () => {
    const start = nextUtc(4, 16);
    const e1 = await createEvent(db, await setupHost(db));
    const e2 = await createEvent(db, await setupHost(db));
    await book(db, e1, start);
    await book(db, e2, start);
  });

  it("allows back to back bookings without buffers", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host);
    const start = nextUtc(5, 9);
    await book(db, event, start);
    await book(db, event, addMinutes(start, 30));
  });

  it("considers buffers on both bookings (RN-29)", async () => {
    const host = await setupHost(db);
    const plain = await createEvent(db, host, { slot_interval_minutes: 15 });
    const buffered = await createEvent(db, host, {
      slot_interval_minutes: 15,
      buffer_before_minutes: 15,
      buffer_after_minutes: 15,
    });
    const start = nextUtc(5, 14);
    await book(db, buffered, start); // blocks 13:45 to 14:45

    expect(await errorOf(book(db, plain, addMinutes(start, 30)))).toBe("slot_taken"); // 14:30
    expect(await errorOf(book(db, plain, addMinutes(start, -30)))).toBe("slot_taken"); // 13:30 to 14:00
    await book(db, plain, addMinutes(start, 45)); // 14:45
    await book(db, plain, addMinutes(start, -45)); // 13:15 to 13:45
  });

  it("ignores cancelled bookings", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host);
    const start = nextUtc(6, 10);
    const first = await book(db, event, start);

    await db.query(
      "update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'guest' where id = $1",
      [first.booking_id],
    );
    await book(db, event, start);
  });

  it("is enforced on direct inserts too, not only through the function", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host);
    const start = nextUtc(6, 15);
    await book(db, event, start);

    const message = await errorOf(
      db.query(
        `insert into public.bookings (host_id, event_type_id, start_at, end_at, event_title, location_type,
           guest_name, guest_email, guest_time_zone, manage_token_hash)
         values ($1, $2, $3, $4, 'x', 'zoom', 'Bob Silva', 'bob@example.com', 'UTC',
           extensions.digest('x', 'sha256'))`,
        [host, event, addMinutes(start, 10).toISOString(), addMinutes(start, 20).toISOString()],
      ),
    );
    expect(message).toMatch(/bookings_no_overlap/);
  });
});

describe("slot rules (RN-27 to RN-32)", () => {
  it("rejects past slots", async () => {
    const event = await createEvent(db, await setupHost(db), { min_notice_minutes: 0 });
    const past = new Date(Date.now() - 60 * 60_000);
    past.setUTCMinutes(0, 0, 0);
    expect(await errorOf(book(db, event, past))).toBe("slot_in_past");
  });

  it("respects the minimum notice", async () => {
    const event = await createEvent(db, await setupHost(db), { min_notice_minutes: 48 * 60 });
    const soon = new Date(Date.now() + 24 * 60 * 60_000);
    soon.setUTCMinutes(0, 0, 0);
    expect(await errorOf(book(db, event, soon))).toBe("outside_notice");
  });

  it("respects the maximum window", async () => {
    const event = await createEvent(db, await setupHost(db), { max_days_ahead: 7 });
    const far = new Date(Date.now() + 10 * 24 * 60 * 60_000);
    far.setUTCHours(10, 0, 0, 0);
    expect(await errorOf(book(db, event, far))).toBe("outside_booking_window");
  });

  it("rejects slots outside the weekly availability", async () => {
    const host = await setupHost(db, { allDay: false }); // Mon to Fri 09:00-18:00 UTC
    const event = await createEvent(db, host);
    expect(await errorOf(book(db, event, nextUtc(6, 10)))).toBe("outside_availability"); // Saturday
    expect(await errorOf(book(db, event, nextUtc(1, 8)))).toBe("outside_availability"); // before 09:00
    expect(await errorOf(book(db, event, nextUtc(1, 17, 45)))).toBe("outside_availability"); // ends 18:15
    await book(db, event, nextUtc(1, 17, 30)); // ends exactly at 18:00
  });

  it("rejects slots not aligned to the slot interval", async () => {
    const host = await setupHost(db, { allDay: false });
    const event = await createEvent(db, host, { slot_interval_minutes: 30 });
    expect(await errorOf(book(db, event, nextUtc(2, 10, 15)))).toBe("outside_availability");
  });

  it("rejects seconds in the start time", async () => {
    const event = await createEvent(db, await setupHost(db));
    const start = nextUtc(2, 10);
    start.setUTCSeconds(30);
    expect(await errorOf(book(db, event, start))).toBe("invalid_input");
  });

  it("uses date overrides: day off blocks, special hours replace the weekly rules", async () => {
    const host = await setupHost(db, { allDay: false });
    const event = await createEvent(db, host);
    const tuesday = nextUtc(2, 10);
    const thursday = nextUtc(4, 10);
    const day = (d: Date) => d.toISOString().slice(0, 10);

    await db.query("insert into public.availability_overrides (host_id, date) values ($1, $2)", [
      host,
      day(tuesday),
    ]);
    await db.query(
      "insert into public.availability_overrides (host_id, date, start_time, end_time) values ($1, $2, '19:00', '21:00')",
      [host, day(thursday)],
    );

    expect(await errorOf(book(db, event, tuesday))).toBe("outside_availability");
    expect(await errorOf(book(db, event, thursday))).toBe("outside_availability"); // 10:00 not in 19-21
    await book(db, event, nextUtc(4, 19, 30));
  });

  it("enforces the daily limit per event type, in the host day (RN-32)", async () => {
    const host = await setupHost(db);
    const limited = await createEvent(db, host, { daily_limit: 2 });
    const other = await createEvent(db, host);
    const day = nextUtc(3, 9);

    await book(db, limited, day);
    await book(db, limited, addMinutes(day, 60));
    expect(await errorOf(book(db, limited, addMinutes(day, 120)))).toBe("daily_limit_reached");

    await book(db, other, addMinutes(day, 120)); // other event types are not counted
    await book(db, limited, addMinutes(day, 24 * 60)); // next day is fine
  });

  it("counts the daily limit by the host local day, not UTC", async () => {
    const host = await setupHost(db, { timeZone: "America/Sao_Paulo" });
    const event = await createEvent(db, host, { daily_limit: 1 });
    // 23:00 UTC = 20:00 in Sao Paulo; 02:00 UTC next day = 23:00 the same local day.
    const evening = nextUtc(3, 23);
    await book(db, event, evening);
    expect(await errorOf(book(db, event, addMinutes(evening, 180)))).toBe("daily_limit_reached");
  });
});

describe("time zones and DST (RN-34)", () => {
  it("keeps the host wall clock across a DST change", async () => {
    const host = await setupHost(db, { timeZone: "America/New_York", allDay: false });
    // Weekly rules Mon to Fri 09:00-18:00 New York time. DST starts 2027-03-14.
    const event = await createEvent(db, host);

    // Monday 2027-03-08 (EST, UTC-5): 09:00 local = 14:00 UTC
    await book(db, event, new Date("2027-03-08T14:00:00Z"));
    expect(await errorOf(book(db, event, new Date("2027-03-08T13:00:00Z")))).toBe("outside_availability");

    // Monday 2027-03-15 (EDT, UTC-4): 09:00 local = 13:00 UTC
    await book(db, event, new Date("2027-03-15T13:00:00Z"));
  });

  it("handles the skipped hour on the DST start day", async () => {
    const host = await setupHost(db, { timeZone: "America/New_York", allDay: false });
    await db.query(
      "insert into public.availability_overrides (host_id, date, start_time, end_time) values ($1, '2027-03-14', '01:00', '05:00')",
      [host],
    );
    const event = await createEvent(db, host);
    // 01:30 EST = 06:30 UTC; ends 07:00 UTC = 03:00 EDT (02:00 to 03:00 does not exist).
    await book(db, event, new Date("2027-03-14T06:30:00Z"));
    // 03:00 EDT = 07:00 UTC, aligned on the wall clock (2h after 01:00).
    await book(db, event, new Date("2027-03-14T07:00:00Z"));
  });

  it("accepts a guest in any valid zone, rejects invalid zones", async () => {
    const event = await createEvent(db, await setupHost(db));
    await book(db, event, nextUtc(2, 12), { timeZone: "Asia/Tokyo" });
    expect(await errorOf(book(db, event, nextUtc(2, 13), { timeZone: "GMT-3" }))).toBe("invalid_guest");
  });
});

describe("guest data and answers", () => {
  it.each([
    [{ name: "A" }, "name too short"],
    [{ email: "not-an-email" }, "invalid email"],
    [{ phone: "11999998888" }, "phone without country code"],
  ])("rejects %j (%s)", async (guest, _reason) => {
    const event = await createEvent(db, await setupHost(db));
    expect(await errorOf(book(db, event, nextUtc(3, 10), guest))).toBe("invalid_guest");
  });

  it("requires the guest phone when the host calls (RN-12)", async () => {
    const event = await createEvent(db, await setupHost(db), {
      location_type: "phone",
      phone_mode: "host_calls",
      location_value: null,
    });
    expect(await errorOf(book(db, event, nextUtc(3, 11)))).toBe("invalid_guest");
    await book(db, event, nextUtc(3, 11), { phone: "+5511988887777" });
  });

  it("validates answers and stores a snapshot with labels (RN-17)", async () => {
    const event = await createEvent(db, await setupHost(db), {
      questions: [
        { id: "goal", type: "long_text", label: "Objetivo", required: true },
        { id: "size", type: "single_choice", label: "Tamanho", required: false, options: ["P", "M"] },
        { id: "topics", type: "multi_choice", label: "Temas", required: false, options: ["A", "B", "C"] },
      ],
    });

    expect(await errorOf(book(db, event, nextUtc(4, 10), { answers: {} }))).toBe("invalid_answers");
    expect(await errorOf(book(db, event, nextUtc(4, 10), { answers: { goal: "   " } }))).toBe(
      "invalid_answers",
    );
    expect(await errorOf(book(db, event, nextUtc(4, 10), { answers: { goal: "x", size: "G" } }))).toBe(
      "invalid_answers",
    );
    expect(
      await errorOf(book(db, event, nextUtc(4, 10), { answers: { goal: "x", topics: ["A", "Z"] } })),
    ).toBe("invalid_answers");
    expect(await errorOf(book(db, event, nextUtc(4, 10), { answers: { goal: "x", extra: "y" } }))).toBe(
      "invalid_answers",
    );

    const created = await book(db, event, nextUtc(4, 10), {
      answers: { goal: "  Crescer  ", size: "M", topics: ["A", "C"] },
    });
    const { rows } = await db.query<{ answers: unknown }>(
      "select answers from public.bookings where id = $1",
      [created.booking_id],
    );
    expect(rows[0].answers).toEqual([
      { question_id: "goal", label: "Objetivo", type: "long_text", value: "Crescer" },
      { question_id: "size", label: "Tamanho", type: "single_choice", value: "M" },
      { question_id: "topics", label: "Temas", type: "multi_choice", value: ["A", "C"] },
    ]);
  });

  it("does not book inactive, archived or private events", async () => {
    const host = await setupHost(db);
    const inactive = await createEvent(db, host, { is_active: false });
    const archived = await createEvent(db, host, { archived_at: new Date().toISOString() });
    const privateHost = await setupHost(db, { isPublic: false });
    const hidden = await createEvent(db, privateHost);

    for (const event of [inactive, archived, hidden]) {
      expect(await errorOf(book(db, event, nextUtc(5, 10)))).toBe("event_not_found");
    }
  });
});
