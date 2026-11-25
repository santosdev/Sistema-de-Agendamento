import { notFound } from "next/navigation";
import { BackLink } from "@/components/dashboard/back-link";
import { EventForm } from "@/components/dashboard/event-form";
import { PageShell } from "@/components/dashboard/page-shell";
import { getCurrentHost } from "@/lib/auth/session";
import { getEventType } from "@/lib/dashboard/queries";
import { toEventFormValues } from "@/lib/dashboard/schemas";
import { publicEnv } from "@/lib/env/public";
import { getMessages } from "@/lib/i18n";

export default async function EditEventTypePage({ params }: PageProps<"/dashboard/events/[id]">) {
  const t = getMessages().dashboard.events;
  const { id } = await params;
  const [host, event] = await Promise.all([getCurrentHost(), getEventType(id)]);
  if (!event) notFound();

  return (
    <PageShell title={event.title} subtitle={<BackLink href="/dashboard/events" label={t.back} />}>
      <EventForm
        key={event.id}
        id={event.id}
        initial={toEventFormValues(event)}
        baseUrl={`${publicEnv().NEXT_PUBLIC_APP_URL}/${host.username}`}
      />
    </PageShell>
  );
}
