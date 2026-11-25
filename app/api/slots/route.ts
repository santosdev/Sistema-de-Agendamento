import { z } from "zod";
import { getBookingByToken, getPublicEvent, getPublicHost, getSlotInputs } from "@/lib/booking/queries";
import { generateSlots } from "@/lib/scheduling/slots";

const MAX_RANGE_MS = 62 * 86_400_000;

const querySchema = z.object({
  username: z.string().min(3).max(30),
  event: z.string().min(1).max(60),
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  /** Rescheduling: the booking being moved does not block itself, keeps its duration. */
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
});

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** GET /api/slots: free start times (UTC ISO) of a public event in [from, to). */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = querySchema.safeParse(params);
  if (!query.success) return json({ error: "invalid_input" }, 400);

  const from = new Date(query.data.from);
  const to = new Date(query.data.to);
  if (!(from < to) || to.getTime() - from.getTime() > MAX_RANGE_MS)
    return json({ error: "invalid_input" }, 400);

  const host = await getPublicHost(query.data.username);
  const event = host ? await getPublicEvent(host.id, query.data.event) : null;
  if (!host || !event) return json({ error: "event_not_found" }, 404);

  const inputs = await getSlotInputs(host.id, event.id, from, to);

  let durationMinutes: number | undefined;
  let busy = inputs.busy;

  if (query.data.token) {
    const booking = await getBookingByToken(query.data.token);
    if (!booking || booking.eventTypeId !== event.id || !booking.canModify) {
      return json({ error: "booking_not_found" }, 404);
    }
    const start = new Date(booking.startAt).getTime();
    busy = busy.filter((b) => !(b.eventTypeId === booking.eventTypeId && b.start.getTime() === start));
    durationMinutes = Math.round((new Date(booking.endAt).getTime() - start) / 60_000);
  }

  const slots = generateSlots({
    ...inputs,
    busy,
    durationMinutes,
    hostTimeZone: host.timeZone,
    now: new Date(),
    from,
    to,
  });

  return json({ slots: slots.map((s) => s.toISOString()) });
}
