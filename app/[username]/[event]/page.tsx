import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";
import { getPublicEvent, getPublicHost } from "@/lib/booking/queries";

async function load(params: PageProps<"/[username]/[event]">["params"]) {
  const { username, event: slug } = await params;
  const host = await getPublicHost(username);
  const event = host ? await getPublicEvent(host.id, slug) : null;
  return host && event ? { host, event } : null;
}

export async function generateMetadata({ params }: PageProps<"/[username]/[event]">): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  return {
    title: `${data.event.title} · ${data.host.displayName}`,
    description: data.event.description ?? undefined,
  };
}

/** Booking page: calendar, times in the guest zone, form and confirmation. */
export default async function EventPage({ params, searchParams }: PageProps<"/[username]/[event]">) {
  const data = await load(params);
  if (!data) notFound();

  // RN-75: ?embed=1 renders without the site header, for the iframe embed.
  const { embed } = await searchParams;

  return <BookingFlow host={data.host} event={data.event} embed={embed === "1"} />;
}
