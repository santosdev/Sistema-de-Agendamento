import { ArrowRight, CalendarX2, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { describeLocation, LocationIcon } from "@/components/booking/location";
import { SiteHeader } from "@/components/site-header";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { getPublicEvents, getPublicHost } from "@/lib/booking/queries";
import { EVENT_COLORS } from "@/lib/design/tokens";
import { formatDuration } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";

const AGENCY_USERNAME = "techresolute";

export async function generateMetadata({ params }: PageProps<"/[username]">): Promise<Metadata> {
  const { username } = await params;
  const host = await getPublicHost(username);
  if (!host) return {};
  return { title: host.displayName, description: host.welcomeMessage ?? undefined };
}

/** RN: /[username] shows the public profile and active events (DESIGN.md 10.1). */
export default async function HostPage({ params }: PageProps<"/[username]">) {
  const { username } = await params;
  const host = await getPublicHost(username);
  if (!host) notFound();

  const events = await getPublicEvents(host.id);
  const t = getMessages();

  return (
    <>
      <SiteHeader width="max-w-[720px]" />
      <main id="main" className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-4 pb-12 sm:px-6">
        <section className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface p-6 text-center shadow-card sm:p-8">
          <Avatar name={host.displayName} src={host.avatarUrl} size={72} />
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-display text-ink">{host.displayName}</h1>
            {host.welcomeMessage ? (
              <p className="mx-auto max-w-prose text-body text-ink-muted">{host.welcomeMessage}</p>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="events-heading" className="flex flex-col gap-3">
          <h2
            id="events-heading"
            className="px-1 text-caption font-medium tracking-wide text-ink-muted uppercase"
          >
            {t.host.eventsHeading}
          </h2>

          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface px-6 py-10 text-center">
              <CalendarX2 aria-hidden="true" className="size-6 text-ink-muted" />
              <p className="font-display text-heading text-ink">{t.host.noEvents}</p>
              <p className="text-label text-ink-muted">
                {fill(t.host.noEventsBody, { name: host.displayName })}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {events.map((event) => {
                const location = describeLocation(event.locationType, event.phoneMode, event.address, {
                  booked: false,
                });
                return (
                  <li key={event.id}>
                    <Link
                      href={`/${host.username}/${event.slug}`}
                      className="group relative flex items-center gap-4 overflow-hidden rounded-card-sm border border-border bg-surface p-5 pt-6 shadow-card transition-[border-color,transform] duration-(--duration-base) ease-out-soft hover:border-border-input active:scale-[0.995]"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 h-[3px]"
                        style={{ backgroundColor: EVENT_COLORS[event.color] }}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                        <h3 className="font-display text-heading text-ink">{event.title}</h3>
                        <div className="flex flex-wrap gap-2">
                          <Chip icon={<Clock />}>{formatDuration(event.durationMinutes)}</Chip>
                          <Chip icon={<LocationIcon type={event.locationType} />}>{location.label}</Chip>
                        </div>
                        {event.description ? (
                          <p className="line-clamp-2 text-label text-ink-muted">{event.description}</p>
                        ) : null}
                      </div>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-5 shrink-0 text-ink-muted transition-transform duration-(--duration-base) group-hover:translate-x-0.5 group-hover:text-brand"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {host.username !== AGENCY_USERNAME ? (
          <p className="pt-4 text-center text-caption text-ink-muted">
            <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
              {t.common.madeWith}
            </Link>
          </p>
        ) : null}
      </main>
    </>
  );
}
