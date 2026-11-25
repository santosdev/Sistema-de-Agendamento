import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUser, errorOf, type Db } from "./harness";
import { createEvent, setupHost } from "./fixtures";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

describe("new user trigger", () => {
  it("creates a profile with a valid username and default availability", async () => {
    const id = await createUser(db, "Joao.Silva+test@example.com", { name: "João Silva" });

    const { rows: profiles } = await db.query<{ username: string; display_name: string; time_zone: string }>(
      "select username, display_name, time_zone from public.profiles where id = $1",
      [id],
    );
    expect(profiles[0].username).toMatch(/^joao-silva-test-[0-9a-f]{5}$/);
    expect(profiles[0].display_name).toBe("João Silva");
    expect(profiles[0].time_zone).toBe("America/Sao_Paulo");

    const { rows: rules } = await db.query<{ weekday: number; start_time: string; end_time: string }>(
      "select weekday, start_time, end_time from public.availability_rules where host_id = $1 order by weekday",
      [id],
    );
    expect(rules.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(rules.every((r) => r.start_time === "09:00:00" && r.end_time === "18:00:00")).toBe(true);
  });

  it("uses the browser time zone from metadata when valid (RN-09)", async () => {
    const ok = await createUser(db, "lisboa@example.com", { time_zone: "Europe/Lisbon" });
    const bad = await createUser(db, "bad@example.com", { time_zone: "BRT" });
    const { rows } = await db.query<{ id: string; time_zone: string }>(
      "select id, time_zone from public.profiles where id in ($1, $2)",
      [ok, bad],
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.time_zone]));
    expect(byId[ok]).toBe("Europe/Lisbon");
    expect(byId[bad]).toBe("America/Sao_Paulo");
  });

  it("falls back to 'host' when the email local part is too short", async () => {
    const id = await createUser(db, "a@example.com");
    const { rows } = await db.query<{ username: string }>(
      "select username from public.profiles where id = $1",
      [id],
    );
    expect(rows[0].username).toMatch(/^host-[0-9a-f]{5}$/);
  });
});

describe("profile constraints", () => {
  it.each([
    ["dashboard", "reserved"],
    ["Maria", "uppercase"],
    ["ab", "too short"],
    ["-maria", "leading hyphen"],
    ["maria-", "trailing hyphen"],
    ["maria_silva", "underscore"],
    ["a".repeat(31), "too long"],
  ])("rejects username %s (%s)", async (username, _reason) => {
    const id = await setupHost(db);
    const message = await errorOf(
      db.query("update public.profiles set username = $2 where id = $1", [id, username]),
    );
    expect(message).toMatch(/profiles_username/);
  });

  it("enforces unique usernames", async () => {
    const a = await setupHost(db);
    const b = await setupHost(db);
    await db.query("update public.profiles set username = 'maria-silva' where id = $1", [a]);
    const message = await errorOf(
      db.query("update public.profiles set username = 'maria-silva' where id = $1", [b]),
    );
    expect(message).toMatch(/profiles_username_key/);
  });

  it("validates IANA time zones", async () => {
    const { rows } = await db.query<Record<string, boolean>>(`
      select
        public.is_valid_time_zone('America/Sao_Paulo') as sp,
        public.is_valid_time_zone('America/Argentina/Buenos_Aires') as ba,
        public.is_valid_time_zone('UTC') as utc,
        public.is_valid_time_zone('Mars/Olympus') as mars,
        public.is_valid_time_zone('BRT') as abbr,
        public.is_valid_time_zone('UTC+3') as posix
    `);
    expect(rows[0]).toEqual({ sp: true, ba: true, utc: true, mars: false, abbr: false, posix: false });
  });
});

describe("event type constraints", () => {
  it("accepts every valid location shape", async () => {
    const host = await setupHost(db);
    await createEvent(db, host, { location_type: "zoom", location_value: "https://zoom.us/j/1" });
    await createEvent(db, host, { location_type: "custom_link", location_value: "https://example.com/sala" });
    await createEvent(db, host, { location_type: "in_person", location_value: "Rua A, 10" });
    await createEvent(db, host, { location_type: "phone", phone_mode: "host_calls", location_value: null });
    await createEvent(db, host, {
      location_type: "phone",
      phone_mode: "guest_calls",
      location_value: "+5511999998888",
    });
  });

  it.each([
    [{ location_type: "google_meet", location_value: "http://meet.google.com/x" }, "non https link"],
    [{ location_type: "zoom", location_value: null }, "missing link"],
    [{ location_type: "in_person", location_value: "  " }, "blank address"],
    [{ location_type: "phone", location_value: null }, "phone without mode"],
    [{ location_type: "phone", phone_mode: "guest_calls", location_value: "11999998888" }, "phone not E.164"],
  ])("rejects invalid location %j (%s)", async (input, _reason) => {
    const host = await setupHost(db);
    expect(await errorOf(createEvent(db, host, input))).toMatch(/event_types_location/);
  });

  it.each([
    [{ duration_minutes: 4 }, /event_types_duration/],
    [{ slot_interval_minutes: 7 }, /event_types_slot_interval/],
    [{ buffer_after_minutes: 121 }, /event_types_buffers/],
    [{ daily_limit: 0 }, /event_types_daily_limit/],
    [{ slug: "Com Espaco" }, /event_types_slug_format/],
  ])("rejects %j", async (input, pattern) => {
    const host = await setupHost(db);
    expect(await errorOf(createEvent(db, host, input))).toMatch(pattern);
  });

  it("keeps slugs unique per host, but frees the slug when archived (RN-19)", async () => {
    const host = await setupHost(db);
    const first = await createEvent(db, host, { slug: "call" });
    expect(await errorOf(createEvent(db, host, { slug: "call" }))).toMatch(/event_types_host_slug_key/);

    await db.query("update public.event_types set archived_at = now() where id = $1", [first]);
    await createEvent(db, host, { slug: "call" });

    const other = await setupHost(db);
    await createEvent(db, other, { slug: "call" });
  });

  it("validates custom questions (RN-14 to RN-16)", async () => {
    const host = await setupHost(db);
    await createEvent(db, host, {
      questions: [
        { id: "company", type: "short_text", label: "Empresa", required: false },
        { id: "size", type: "single_choice", label: "Tamanho", required: true, options: ["P", "M", "G"] },
      ],
    });

    const invalid = [
      [{ id: "a", type: "rating", label: "X", required: true }],
      [{ id: "a", type: "short_text", label: "", required: true }],
      [{ id: "a", type: "single_choice", label: "X", required: true, options: ["só uma"] }],
      [{ id: "a", type: "single_choice", label: "X", required: true, options: ["a", "a"] }],
      [{ id: "a", type: "short_text", label: "X", required: "sim" }],
      [
        { id: "a", type: "short_text", label: "X", required: true },
        { id: "a", type: "long_text", label: "Y", required: true },
      ],
      Array.from({ length: 11 }, (_, i) => ({
        id: `q${i}`,
        type: "short_text",
        label: "X",
        required: false,
      })),
    ];

    for (const questions of invalid) {
      expect(await errorOf(createEvent(db, host, { questions }))).toMatch(/event_types_questions_valid/);
    }
  });
});

describe("availability constraints", () => {
  it("rejects overlapping weekly intervals on the same day (RN-21)", async () => {
    const host = await setupHost(db, { allDay: false });
    // Default rule Monday 09:00-18:00 exists.
    const message = await errorOf(
      db.query(
        "insert into public.availability_rules (host_id, weekday, start_time, end_time) values ($1, 1, '17:00', '19:00')",
        [host],
      ),
    );
    expect(message).toMatch(/availability_rules_no_overlap/);

    await db.query(
      "insert into public.availability_rules (host_id, weekday, start_time, end_time) values ($1, 1, '18:00', '20:00'), ($1, 6, '10:00', '12:00')",
      [host],
    );
  });

  it("a day off cannot coexist with special hours on the same date (RN-25)", async () => {
    const host = await setupHost(db);
    await db.query("insert into public.availability_overrides (host_id, date) values ($1, '2030-01-10')", [
      host,
    ]);
    const message = await errorOf(
      db.query(
        "insert into public.availability_overrides (host_id, date, start_time, end_time) values ($1, '2030-01-10', '10:00', '12:00')",
        [host],
      ),
    );
    expect(message).toMatch(/availability_overrides_no_overlap/);

    await db.query(
      "insert into public.availability_overrides (host_id, date, start_time, end_time) values ($1, '2030-01-11', '10:00', '12:00'), ($1, '2030-01-11', '14:00', '16:00')",
      [host],
    );
  });
});
