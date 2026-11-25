import { Plus } from "lucide-react";
import { EventTypesList } from "@/components/dashboard/event-types-list";
import { PageShell } from "@/components/dashboard/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentHost } from "@/lib/auth/session";
import { getEventTypes } from "@/lib/dashboard/queries";
import { publicEnv } from "@/lib/env/public";
import { getMessages } from "@/lib/i18n";

export default async function EventTypesPage() {
  const t = getMessages().dashboard.events;
  const [host, events] = await Promise.all([getCurrentHost(), getEventTypes()]);

  return (
    <PageShell
      title={t.title}
      action={
        <ButtonLink href="/dashboard/events/new" icon={<Plus aria-hidden="true" className="size-[18px]" />}>
          {t.new}
        </ButtonLink>
      }
    >
      <EventTypesList events={events} baseUrl={`${publicEnv().NEXT_PUBLIC_APP_URL}/${host.username}`} />
    </PageShell>
  );
}
