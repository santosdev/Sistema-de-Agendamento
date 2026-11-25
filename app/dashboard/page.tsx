import Link from "next/link";
import { MeetingsList } from "@/components/dashboard/meetings-list";
import { PageShell } from "@/components/dashboard/page-shell";
import { getCurrentHost } from "@/lib/auth/session";
import { getMeetings, type MeetingsTab } from "@/lib/dashboard/queries";
import { publicEnv } from "@/lib/env/public";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/format";
import { getMessages } from "@/lib/i18n";

const TABS: MeetingsTab[] = ["upcoming", "past", "cancelled"];

/** /dashboard: meetings by tab, grouped by day (DESIGN.md 7.9, 7.10, 10.7). */
export default async function MeetingsPage({ searchParams }: PageProps<"/dashboard">) {
  const t = getMessages().dashboard.meetings;
  const { tab: raw } = await searchParams;
  const tab = TABS.includes(raw as MeetingsTab) ? (raw as MeetingsTab) : "upcoming";
  const [host, meetings] = await Promise.all([getCurrentHost(), getMeetings(tab)]);

  return (
    <PageShell title={t.title} subtitle={formatLongDate(new Date(), host.timeZone)}>
      <nav aria-label={t.title} className="border-b border-divider">
        <ul className="-mb-px flex gap-6">
          {TABS.map((key) => (
            <li key={key}>
              <Link
                href={key === "upcoming" ? "/dashboard" : `/dashboard?tab=${key}`}
                aria-current={key === tab ? "page" : undefined}
                className={cn(
                  "inline-flex h-touch items-center border-b-2 text-label transition-colors",
                  key === tab
                    ? "border-brand font-semibold text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {t.tabs[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
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
