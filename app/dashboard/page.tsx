import { Suspense } from "react";
import { MeetingsList } from "@/components/dashboard/meetings-list";
import { MeetingsTabs } from "@/components/dashboard/meetings-tabs";
import { PageShell } from "@/components/dashboard/page-shell";
import { FlashToast } from "@/components/ui/flash-toast";
import { getCurrentHost } from "@/lib/auth/session";
import { getMeetingCounts, getMeetings, MEETINGS_TABS, type MeetingsTab } from "@/lib/dashboard/queries";
import { publicEnv } from "@/lib/env/public";
import { formatLongDate } from "@/lib/format";
import { getMessages } from "@/lib/i18n";

/** /dashboard: meetings by tab, grouped by day (DESIGN.md 7.9, 7.10, 10.7). */
export default async function MeetingsPage({ searchParams }: PageProps<"/dashboard">) {
  const t = getMessages().dashboard.meetings;
  const { tab: raw } = await searchParams;
  const tab = MEETINGS_TABS.includes(raw as MeetingsTab) ? (raw as MeetingsTab) : "upcoming";
  const [host, meetings, counts] = await Promise.all([
    getCurrentHost(),
    getMeetings(tab),
    getMeetingCounts(),
  ]);

  return (
    <PageShell title={t.title} subtitle={formatLongDate(new Date(), host.timeZone)}>
      <Suspense>
        <FlashToast param="password" value="updated" message={getMessages().dashboard.passwordUpdated} />
      </Suspense>
      <MeetingsTabs tabs={MEETINGS_TABS} active={tab} counts={counts} />
      <MeetingsList
        key={tab}
        tab={tab}
        meetings={meetings}
        hostTimeZone={host.timeZone}
        username={host.username}
        publicUrl={`${publicEnv().NEXT_PUBLIC_APP_URL}/${host.username}`}
      />
    </PageShell>
  );
}
