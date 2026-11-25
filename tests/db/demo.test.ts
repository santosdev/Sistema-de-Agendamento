import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createUser, errorOf, nextUtc, service, user, type Db } from "./harness";
import { book, createEvent, setupHost } from "./fixtures";

let db: Db;
let demo: string;

const seed = () => as(db, service, (tx) => tx.query("select public.seed_demo($1)", [demo]));

const count = async (table: string, where = "true") => {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from public.${table} where host_id = $1 and ${where}`,
    [demo],
  );
  return rows[0].n;
};

beforeAll(async () => {
  db = await createTestDb();
  demo = await createUser(db, "demo@example.com");
  await seed();
});

describe("seed_demo (RN-66)", () => {
  it("builds the demo profile, events, availability and bookings", async () => {
    const { rows } = await db.query(
      "select username, display_name, is_public, is_seed from public.profiles where id = $1",
      [demo],
    );
    expect(rows[0]).toEqual({
      username: "marina-demo",
      display_name: "Marina Alves",
      is_public: true,
      is_seed: true,
    });

    expect(await count("event_types")).toBe(4);
    expect(await count("event_types", "not is_active")).toBe(1);
    expect(await count("availability_rules")).toBe(10);
    expect(await count("availability_overrides")).toBe(2);
    expect(await count("bookings")).toBe(13);
    expect(await count("bookings", "status = 'cancelled'")).toBe(2);
    expect(await count("bookings", "status = 'rescheduled'")).toBe(2);
    expect(await count("bookings", "start_at > now()")).toBe(7);
    expect(await count("bookings", "not is_seed")).toBe(0);
  });

  it("is idempotent and removes what visitors created (RN-69, RN-72)", async () => {
    await as(db, user(demo), (tx) =>
      tx.query(
        "insert into public.event_types (host_id, title, slug, location_type, location_value) values ($1, 'Visitante', 'visitante', 'zoom', 'https://zoom.us/j/9')",
        [demo],
      ),
    );
    const { rows } = await db.query<{ id: string }>(
      "select id from public.event_types where host_id = $1 and slug = 'conversa-inicial'",
      [demo],
    );
    // Wednesday 14:00 in Sao Paulo, 20+ days ahead (clear of the seeded overrides).
    await book(db, rows[0].id, nextUtc(3, 17, 0, 20), {
      name: "Visitante Teste",
      answers: { goal: "Testar o demo" },
    });

    expect(await count("event_types")).toBe(5);
    expect(await count("bookings")).toBe(14);

    await seed();

    expect(await count("event_types")).toBe(4);
    expect(await count("bookings")).toBe(13);
    expect(await count("event_types", "slug = 'visitante'")).toBe(0);
  });
});

describe("seed protection (RN-68, RN-70)", () => {
  it("blocks changes to base rows, even by the demo host", async () => {
    const attempts = [
      "update public.event_types set title = 'Mudou' where host_id = $1",
      "delete from public.event_types where host_id = $1 and slug = 'ligacao-rapida'",
      "update public.profiles set display_name = 'Outro' where id = $1",
      "delete from public.availability_rules where host_id = $1",
      "delete from public.availability_overrides where host_id = $1",
    ];
    for (const sql of attempts) {
      expect(await errorOf(as(db, user(demo), (tx) => tx.query(sql, [demo])))).toBe("demo_seed_protected");
    }
  });

  it("blocks host cancel and reschedule of base bookings", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select id from public.bookings where host_id = $1 and status = 'confirmed' and start_at > now() limit 1",
      [demo],
    );
    expect(
      await errorOf(
        as(db, user(demo), (tx) => tx.query("select * from public.host_cancel_booking($1)", [rows[0].id])),
      ),
    ).toBe("demo_seed_protected");
  });

  it("lets the demo host work with rows it created", async () => {
    await as(db, user(demo), async (tx) => {
      await tx.query(
        "insert into public.availability_overrides (host_id, date) values ($1, current_date + 300)",
        [demo],
      );
      const { affectedRows } = await tx.query(
        "delete from public.availability_overrides where host_id = $1 and date = current_date + 300",
        [demo],
      );
      expect(affectedRows).toBe(1);
    });
  });

  it("does not let visitors flag rows as seed", async () => {
    const other = await setupHost(db);
    expect(
      await errorOf(
        createEvent(db, other, { title: "x" }).then(() =>
          as(db, user(other), (tx) =>
            tx.query("update public.event_types set is_seed = true where host_id = $1", [other]),
          ),
        ),
      ),
    ).toBe("demo_seed_protected");
  });
});

describe("run_maintenance (RN-65)", () => {
  it("anonymizes guests of meetings older than 12 months and keeps the booking", async () => {
    const host = await setupHost(db);
    const event = await createEvent(db, host);
    const { rows } = await db.query<{ id: string }>(
      `insert into public.bookings (host_id, event_type_id, start_at, end_at, event_title, location_type,
         guest_name, guest_email, guest_phone, guest_time_zone, answers, manage_token_hash)
       values ($1, $2, now() - interval '13 months', now() - interval '13 months' + interval '30 minutes',
         'x', 'zoom', 'Rita Alves', 'rita@example.com', '+5511911112222', 'UTC',
         '[{"question_id":"a","label":"A","type":"short_text","value":"segredo"}]', extensions.digest('old', 'sha256'))
       returning id`,
      [host, event],
    );

    const result = await as(db, service, (tx) =>
      tx.query<{ n: number }>("select public.run_maintenance() as n"),
    );
    expect(result.rows[0].n).toBe(1);

    const { rows: after } = await db.query(
      "select guest_name, guest_phone, answers, anonymized_at is not null as done from public.bookings where id = $1",
      [rows[0].id],
    );
    expect(after[0]).toEqual({
      guest_name: "Convidado removido",
      guest_phone: null,
      answers: [],
      done: true,
    });

    const again = await as(db, service, (tx) =>
      tx.query<{ n: number }>("select public.run_maintenance() as n"),
    );
    expect(again.rows[0].n).toBe(0);
  });
});
