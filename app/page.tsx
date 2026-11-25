import { ArrowRight, CalendarClock, Globe, Link2 } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

const DEMO_USERNAME = "marina-demo";

/** Product entry: what it does, the demo and how to start (DESIGN.md 1: calm, one highlight). */
export default function HomePage() {
  const t = getMessages();
  const l = t.landing;
  const features = [
    { key: "availability", icon: CalendarClock },
    { key: "timeZone", icon: Globe },
    { key: "manage", icon: Link2 },
  ] as const;

  return (
    <>
      <SiteHeader width="max-w-[960px]">
        <ButtonLink href="/login" variant="ghost" size="sm">
          {l.signIn}
        </ButtonLink>
      </SiteHeader>
      <main
        id="main"
        className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-10 px-4 pt-6 pb-12 sm:px-6 sm:pt-12"
      >
        <section className="flex flex-col items-start gap-5">
          <h1 className="max-w-2xl font-display text-[2rem] leading-[2.4rem] font-bold tracking-[-0.01em] text-ink sm:text-[2.75rem] sm:leading-[3.1rem]">
            {l.title}
          </h1>
          <p className="max-w-xl text-body text-ink-secondary">{l.subtitle}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              href={`/${DEMO_USERNAME}`}
              size="lg"
              icon={<ArrowRight aria-hidden="true" className="size-[18px]" />}
            >
              {l.seeDemo}
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              {l.tryDashboard}
            </ButtonLink>
          </div>
          <Link
            href="/signup"
            className="text-label font-semibold text-brand underline-offset-2 hover:underline"
          >
            {l.signUp}
          </Link>
        </section>

        <section aria-labelledby="features" className="flex flex-col gap-4">
          <h2 id="features" className="text-caption font-semibold tracking-wide text-ink-muted uppercase">
            {l.featuresHeading}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {features.map(({ key, icon: Icon }) => (
              <li
                key={key}
                className="flex flex-col gap-2 rounded-card-sm border border-border bg-surface p-5 shadow-card"
              >
                <Icon aria-hidden="true" className="size-5 text-brand" strokeWidth={1.75} />
                <h3 className="font-display text-heading text-ink">{l.features[key].title}</h3>
                <p className="text-label text-ink-muted">{l.features[key].body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="mx-auto flex w-full max-w-[960px] justify-between gap-4 px-4 pb-8 text-caption text-ink-muted sm:px-6">
        <span>{t.common.madeWith}</span>
        <Link href="/privacy" className="underline-offset-2 hover:text-ink hover:underline">
          {l.privacy}
        </Link>
      </footer>
    </>
  );
}
