import { BackLink } from "@/components/dashboard/back-link";
import { EventForm } from "@/components/dashboard/event-form";
import { PageShell } from "@/components/dashboard/page-shell";
import { getCurrentHost } from "@/lib/auth/session";
import { DEFAULT_EVENT_VALUES } from "@/lib/dashboard/schemas";
import { publicEnv } from "@/lib/env/public";
import { getMessages } from "@/lib/i18n";

export default async function NewEventTypePage() {
  const t = getMessages().dashboard.events;
  const host = await getCurrentHost();
  return (
    <PageShell title={t.new} subtitle={<BackLink href="/dashboard/events" label={t.back} />}>
      <EventForm
        initial={DEFAULT_EVENT_VALUES}
        baseUrl={`${publicEnv().NEXT_PUBLIC_APP_URL}/${host.username}`}
      />
    </PageShell>
  );
}
