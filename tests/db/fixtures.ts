import { as, createUser, service, type Db } from "./harness";

let counter = 0;

type HostOptions = {
  timeZone?: string;
  isPublic?: boolean;
  /** Replace the default Mon-Fri 09-18 with 00:00-24:00 every day. */
  allDay?: boolean;
};

export async function setupHost(
  db: Db,
  { timeZone = "UTC", isPublic = true, allDay = true }: HostOptions = {},
) {
  counter += 1;
  const id = await createUser(db, `host${counter}@example.com`, { name: `Host ${counter}` });
  await db.query("update public.profiles set time_zone = $2, is_public = $3 where id = $1", [
    id,
    timeZone,
    isPublic,
  ]);

  if (allDay) {
    await db.query("delete from public.availability_rules where host_id = $1", [id]);
    await db.query(
      `insert into public.availability_rules (host_id, weekday, start_time, end_time)
       select $1, d, time '00:00', time '24:00' from generate_series(0, 6) d`,
      [id],
    );
  }
  return id;
}

export type EventInput = Partial<{
  title: string;
  slug: string;
  duration_minutes: number;
  slot_interval_minutes: number;
  location_type: string;
  location_value: string | null;
  phone_mode: string | null;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  daily_limit: number | null;
  questions: unknown[];
  is_active: boolean;
  archived_at: string | null;
}>;

export async function createEvent(db: Db, hostId: string, input: EventInput = {}) {
  counter += 1;
  const values: Record<string, unknown> = {
    host_id: hostId,
    title: "Reunião",
    slug: `evento-${counter}`,
    duration_minutes: 30,
    slot_interval_minutes: 30,
    location_type: "google_meet",
    location_value: "https://meet.google.com/abc-defg-hij",
    min_notice_minutes: 60,
    max_days_ahead: 365,
    ...input,
  };
  if (values.questions) values.questions = JSON.stringify(values.questions);

  const cols = Object.keys(values);
  const params = cols.map((_, i) => `$${i + 1}`);
  const { rows } = await db.query<{ id: string }>(
    `insert into public.event_types (${cols.join(", ")}) values (${params.join(", ")}) returning id`,
    Object.values(values),
  );
  return rows[0].id;
}

export type GuestInput = Partial<{
  name: string;
  email: string;
  phone: string | null;
  timeZone: string;
  answers: Record<string, unknown>;
}>;

export type CreatedBooking = { booking_id: string; manage_token: string; start_at: Date; end_at: Date };

export async function book(db: Db, eventId: string, start: Date, guest: GuestInput = {}) {
  return as(db, service, async (tx) => {
    const { rows } = await tx.query<CreatedBooking>(
      "select * from public.create_booking($1, $2, $3, $4, $5, $6, $7)",
      [
        eventId,
        start.toISOString(),
        guest.name ?? "Ana Souza",
        guest.email ?? "ana@example.com",
        guest.phone ?? null,
        guest.timeZone ?? "America/Sao_Paulo",
        JSON.stringify(guest.answers ?? {}),
      ],
    );
    return rows[0];
  });
}
