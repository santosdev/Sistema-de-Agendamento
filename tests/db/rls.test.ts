import { beforeAll, describe, expect, it } from "vitest";
import { anon, as, createTestDb, errorOf, nextUtc, service, user, type Db } from "./harness";
import { book, createEvent, setupHost } from "./fixtures";

let db: Db;
let publicHost: string;
let privateHost: string;
let activeEvent: string;
let inactiveEvent: string;
let archivedEvent: string;
let privateEvent: string;
let bookingId: string;

beforeAll(async () => {
  db = await createTestDb();
  publicHost = await setupHost(db);
  privateHost = await setupHost(db, { isPublic: false });
  activeEvent = await createEvent(db, publicHost, { title: "Ativo" });
  inactiveEvent = await createEvent(db, publicHost, { is_active: false });
  archivedEvent = await createEvent(db, publicHost, { archived_at: new Date().toISOString() });
  privateEvent = await createEvent(db, privateHost);
  ({ booking_id: bookingId } = await book(db, activeEvent, nextUtc(2, 10)));
  await db.query(
    "insert into public.bookings (host_id, event_type_id, start_at, end_at, event_title, location_type, guest_name, guest_email, guest_time_zone, manage_token_hash) values ($1, $2, now() + interval '3 days', now() + interval '3 days 30 minutes', 'x', 'zoom', 'Leo Dias', 'leo@example.com', 'UTC', extensions.digest('private', 'sha256'))",
    [privateHost, privateEvent],
  );
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe("anon (public visitor)", () => {
  it("reads only public profiles", async () => {
    const rows = await as(
      db,
      anon,
      async (tx) => (await tx.query<{ id: string }>("select id from public.profiles")).rows,
    );
    expect(ids(rows)).toContain(publicHost);
    expect(ids(rows)).not.toContain(privateHost);
  });

  it("reads only active, non archived events of public hosts", async () => {
    const rows = await as(
      db,
      anon,
      async (tx) => (await tx.query<{ id: string }>("select id from public.event_types")).rows,
    );
    expect(ids(rows)).toEqual([activeEvent]);
    expect(ids(rows)).not.toContain(inactiveEvent);
    expect(ids(rows)).not.toContain(archivedEvent);
    expect(ids(rows)).not.toContain(privateEvent);
  });

  it("reads availability of public hosts only", async () => {
    const rows = await as(
      db,
      anon,
      async (tx) =>
        (await tx.query<{ host_id: string }>("select distinct host_id from public.availability_rules")).rows,
    );
    expect(rows.map((r) => r.host_id)).toContain(publicHost);
    expect(rows.map((r) => r.host_id)).not.toContain(privateHost);
  });

  it("cannot read or write bookings at all", async () => {
    expect(await errorOf(as(db, anon, (tx) => tx.query("select * from public.bookings")))).toMatch(
      /permission denied/,
    );
    expect(
      await errorOf(as(db, anon, (tx) => tx.query("update public.bookings set guest_name = 'x'"))),
    ).toMatch(/permission denied/);
  });

  it("cannot write host data", async () => {
    expect(
      await errorOf(as(db, anon, (tx) => tx.query("update public.event_types set title = 'hack'"))),
    ).toMatch(/permission denied/);
    expect(
      await errorOf(
        as(db, anon, (tx) =>
          tx.query(
            "insert into public.availability_rules (host_id, weekday, start_time, end_time) values ($1, 0, '01:00', '02:00')",
            [publicHost],
          ),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("cannot call server-only functions", async () => {
    const calls = [
      ["select public.create_booking($1, now(), 'a', 'b', null, 'UTC', '{}')", [activeEvent]],
      ["select public.get_booking_by_token('x')", []],
      ["select public.cancel_booking_by_token('x')", []],
      ["select public.consume_rate_limit('x', 1, 1)", []],
      ["select public.seed_demo($1)", [publicHost]],
      ["select public.run_maintenance()", []],
      ["select public._assert_bookable(null, 'UTC', now(), 30, null, true)", []],
      ["select public.host_cancel_booking($1)", [bookingId]],
    ] as const;

    for (const [sql, params] of calls) {
      expect(await errorOf(as(db, anon, (tx) => tx.query(sql, [...params])))).toMatch(/permission denied/);
    }
  });

  it("reads busy ranges of public hosts, without guest data", async () => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();

    const rows = await as(db, anon, async (tx) => {
      const { rows } = await tx.query<Record<string, unknown>>(
        "select * from public.get_busy_ranges($1, $2, $3)",
        [publicHost, from, to],
      );
      return rows;
    });
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "blocked_from",
      "blocked_until",
      "end_at",
      "event_type_id",
      "start_at",
    ]);

    const hidden = await as(db, anon, async (tx) => {
      const { rows } = await tx.query("select * from public.get_busy_ranges($1, $2, $3)", [
        privateHost,
        from,
        to,
      ]);
      return rows;
    });
    expect(hidden).toEqual([]);
  });

  it("limits busy range queries to 100 days", async () => {
    const message = await errorOf(
      as(db, anon, (tx) =>
        tx.query("select * from public.get_busy_ranges($1, now(), now() + interval '101 days')", [
          publicHost,
        ]),
      ),
    );
    expect(message).toBe("invalid_input");
  });
});

describe("authenticated host", () => {
  it("sees its own private profile and its own bookings only", async () => {
    const profiles = await as(
      db,
      user(privateHost),
      async (tx) =>
        (await tx.query<{ id: string }>("select id from public.profiles where id = $1", [privateHost])).rows,
    );
    expect(profiles).toHaveLength(1);

    const own = await as(
      db,
      user(publicHost),
      async (tx) => (await tx.query<{ host_id: string }>("select host_id from public.bookings")).rows,
    );
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((b) => b.host_id === publicHost)).toBe(true);
  });

  it("sees its own inactive events", async () => {
    const rows = await as(
      db,
      user(publicHost),
      async (tx) =>
        (await tx.query<{ id: string }>("select id from public.event_types where host_id = $1", [publicHost]))
          .rows,
    );
    expect(ids(rows)).toEqual([activeEvent, archivedEvent, inactiveEvent].sort());
  });

  it("updates its own profile but not someone else's", async () => {
    await as(db, user(publicHost), (tx) =>
      tx.query("update public.profiles set display_name = 'Novo Nome' where id = $1", [publicHost]),
    );
    const result = await as(db, user(publicHost), (tx) =>
      tx.query("update public.profiles set display_name = 'Hack' where id = $1", [privateHost]),
    );
    expect(result.affectedRows).toBe(0);
  });

  it("cannot create events or availability for another host", async () => {
    const message = await errorOf(
      as(db, user(publicHost), (tx) =>
        tx.query(
          "insert into public.event_types (host_id, title, slug, location_type, location_value) values ($1, 'x', 'x', 'zoom', 'https://zoom.us/j/1')",
          [privateHost],
        ),
      ),
    );
    expect(message).toMatch(/row-level security/);

    const deleted = await as(db, user(publicHost), (tx) =>
      tx.query("delete from public.availability_rules where host_id = $1", [privateHost]),
    );
    expect(deleted.affectedRows).toBe(0);
  });

  it("creates and edits its own events", async () => {
    await as(db, user(publicHost), async (tx) => {
      await tx.query(
        "insert into public.event_types (host_id, title, slug, location_type, location_value) values ($1, 'Novo', 'novo', 'zoom', 'https://zoom.us/j/1')",
        [publicHost],
      );
      const { affectedRows } = await tx.query(
        "update public.event_types set title = 'Editado' where slug = 'novo'",
      );
      expect(affectedRows).toBe(1);
    });
  });

  it("cannot write bookings directly", async () => {
    expect(
      await errorOf(
        as(db, user(publicHost), (tx) => tx.query("update public.bookings set status = 'cancelled'")),
      ),
    ).toMatch(/permission denied/);
    expect(await errorOf(as(db, user(publicHost), (tx) => tx.query("delete from public.bookings")))).toMatch(
      /permission denied/,
    );
  });

  it("cannot mark its own rows as demo seed", async () => {
    // Profiles: column grant does not include is_seed at all.
    expect(
      await errorOf(
        as(db, user(publicHost), (tx) =>
          tx.query("update public.profiles set is_seed = true where id = $1", [publicHost]),
        ),
      ),
    ).toMatch(/permission denied/);

    // Other tables: the seed guard trigger blocks it.
    expect(
      await errorOf(
        as(db, user(publicHost), (tx) =>
          tx.query("update public.event_types set is_seed = true where host_id = $1", [publicHost]),
        ),
      ),
    ).toBe("demo_seed_protected");
  });

  it("cannot change its profile id", async () => {
    expect(
      await errorOf(
        as(db, user(publicHost), (tx) =>
          tx.query("update public.profiles set id = gen_random_uuid() where id = $1", [publicHost]),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("cannot read rate limit data", async () => {
    expect(
      await errorOf(as(db, user(publicHost), (tx) => tx.query("select * from public.rate_limit_hits"))),
    ).toMatch(/permission denied/);
  });
});

describe("service_role (server)", () => {
  it("reads and writes every app table, bypassing RLS", async () => {
    await as(db, service, async (tx) => {
      for (const table of [
        "profiles",
        "event_types",
        "availability_rules",
        "availability_overrides",
        "bookings",
        "rate_limit_hits",
      ]) {
        await tx.query(`select count(*) from public.${table}`);
      }
      const { rows } = await tx.query<{ n: number }>(
        "select count(*)::int as n from public.profiles where id = $1",
        [privateHost],
      );
      expect(rows[0].n).toBe(1);
      await tx.query("update public.bookings set guest_phone = null where host_id = $1", [publicHost]);
    });
  });
});

describe("storage avatars", () => {
  it("lets a host write only inside its own folder", async () => {
    await as(db, user(publicHost), (tx) =>
      tx.query("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [
        `${publicHost}/avatar.webp`,
      ]),
    );
    const message = await errorOf(
      as(db, user(publicHost), (tx) =>
        tx.query("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [
          `${privateHost}/avatar.webp`,
        ]),
      ),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("configures the bucket limits", async () => {
    const { rows } = await db.query(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'",
    );
    expect(rows[0]).toEqual({
      public: true,
      file_size_limit: 2097152,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    });
  });
});

describe("rate limit (RN-60)", () => {
  it("allows up to the limit per bucket inside the window", async () => {
    const hit = (bucket: string) =>
      as(db, service, async (tx) => {
        const { rows } = await tx.query<{ ok: boolean }>(
          "select public.consume_rate_limit($1, 5, 600) as ok",
          [bucket],
        );
        return rows[0].ok;
      });

    const results = [];
    for (let i = 0; i < 6; i++) results.push(await hit("ip:abc"));
    expect(results).toEqual([true, true, true, true, true, false]);
    expect(await hit("email:xyz")).toBe(true);
  });
});
