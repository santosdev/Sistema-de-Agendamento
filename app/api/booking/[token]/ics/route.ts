import { getBookingByToken } from "@/lib/booking/queries";
import { publicEnv } from "@/lib/env/public";
import { fill, getMessages } from "@/lib/i18n";
import { buildIcs } from "@/lib/ics";

/** GET /api/booking/[token]/ics: "Adicionar ao calendário" (RN-56). */
export async function GET(_request: Request, ctx: RouteContext<"/api/booking/[token]/ics">) {
  const { token } = await ctx.params;
  const booking = await getBookingByToken(token);
  if (!booking) return new Response("Not found", { status: 404 });

  const t = getMessages();
  const manageUrl = `${publicEnv().NEXT_PUBLIC_APP_URL}/booking/${token}`;
  const location =
    booking.locationType === "phone" && booking.phoneMode === "host_calls"
      ? t.location.hostCalls
      : (booking.locationValue ?? t.location[booking.locationType]);

  const ics = buildIcs({
    uid: `${booking.id}@agenda.techresolute`,
    sequence: booking.icsSequence,
    start: new Date(booking.startAt),
    end: new Date(booking.endAt),
    summary: `${booking.eventTitle} · ${booking.host.displayName}`,
    description: `${fill(t.manage.with, { name: booking.host.displayName })}\n\n${t.booking.done.manage}: ${manageUrl}`,
    location,
    url: manageUrl,
    status: booking.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reuniao.ics"',
      "Cache-Control": "no-store",
    },
  });
}
