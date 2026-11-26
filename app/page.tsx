import { ArrowRight, CalendarClock, Check, Globe, Link2, Mail, Share2, Sparkles, Video } from "lucide-react";
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
  const steps = [
    { key: "availability", icon: CalendarClock },
    { key: "share", icon: Share2 },
    { key: "receive", icon: Mail },
  ] as const;
  const highlights = ["noLogin", "calendar", "timeZone"] as const;

  return (
    <div className="relative isolate flex flex-1 flex-col overflow-x-clip">
      <Backdrop />
      <SiteHeader width="max-w-[100rem]">
        <ButtonLink href="/login" variant="ghost" size="sm">
          {l.signIn}
        </ButtonLink>
      </SiteHeader>

      <main
        id="main"
        className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-20 px-4 pb-16 sm:gap-28 sm:px-6 lg:px-10 2xl:gap-36"
      >
        {/* Hero */}
        <section className="grid items-center gap-12 pt-6 sm:pt-12 lg:min-h-[min(72dvh,760px)] lg:grid-cols-[1.05fr_1fr] lg:gap-12 2xl:gap-20">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-caption font-medium text-ink-secondary shadow-card backdrop-blur">
              <Sparkles aria-hidden="true" className="size-3.5 text-brand" />
              {l.badge}
            </span>
            <h1 className="max-w-xl font-display text-[2.25rem] leading-[2.6rem] font-bold tracking-normal text-ink sm:text-[3.25rem] sm:leading-[3.6rem] xl:max-w-2xl xl:text-[4rem] xl:leading-[4.4rem] 2xl:text-[4.75rem] 2xl:leading-[5.1rem]">
              {l.titleLead}{" "}
              <span className="bg-linear-to-r from-brand to-brand-glow bg-clip-text text-transparent">
                {l.titleHighlight}
              </span>
            </h1>
            <p className="max-w-lg text-[1.0625rem] leading-7 text-ink-secondary xl:max-w-xl xl:text-[1.1875rem] xl:leading-8">
              {l.subtitle}
            </p>
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
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-label text-ink-muted">
              {highlights.map((key) => (
                <li key={key} className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="size-4 text-success-ink" strokeWidth={2.25} />
                  {l.highlights[key]}
                </li>
              ))}
            </ul>
          </div>
          <BookingPreview />
        </section>

        {/* Features */}
        <section aria-labelledby="features" className="flex flex-col gap-6">
          <h2 id="features" className="text-caption font-semibold tracking-wider text-brand uppercase">
            {l.featuresHeading}
          </h2>
          <ul className="grid gap-4 md:grid-cols-3 lg:gap-6">
            {features.map(({ key, icon: Icon }) => (
              <li
                key={key}
                className="group flex flex-col gap-3 rounded-card border border-border bg-surface p-6 shadow-card transition-[transform,border-color] duration-(--duration-base) ease-out-soft hover:-translate-y-0.5 hover:border-border-input"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-control bg-brand-soft text-brand-soft-ink">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="font-display text-heading text-ink">{l.features[key].title}</h3>
                <p className="text-label text-ink-muted">{l.features[key].body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Steps */}
        <section aria-labelledby="steps" className="flex flex-col gap-6">
          <h2 id="steps" className="text-caption font-semibold tracking-wider text-brand uppercase">
            {l.stepsHeading}
          </h2>
          <ol className="grid gap-6 md:grid-cols-3 md:gap-4 lg:gap-8">
            {steps.map(({ key, icon: Icon }, i) => (
              <li key={key} className="relative flex gap-4 md:flex-col">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface font-display text-label font-bold text-ink shadow-card">
                    {i + 1}
                  </span>
                  {i < steps.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="hidden h-px flex-1 bg-linear-to-r from-border to-transparent md:block"
                    />
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="inline-flex items-center gap-2 font-display text-heading text-ink">
                    <Icon aria-hidden="true" className="size-4 text-brand" strokeWidth={2} />
                    {l.steps[key].title}
                  </h3>
                  <p className="text-label text-ink-muted">{l.steps[key].body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Call to action */}
        <section className="on-dark relative overflow-hidden rounded-card border border-sidebar-border bg-sidebar px-6 py-10 text-white shadow-pop sm:px-10 sm:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-brand/50 blur-3xl"
          />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex max-w-lg flex-col gap-2">
              <h2 className="font-display text-title text-white">{l.cta.title}</h2>
              <p className="text-body text-sidebar-ink">{l.cta.body}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex h-control-lg items-center justify-center gap-2 rounded-control bg-accent px-6 text-label font-semibold text-on-accent transition-[transform,filter] duration-(--duration-fast) hover:brightness-95 active:scale-[0.98]"
              >
                {l.signUp}
                <ArrowRight aria-hidden="true" className="size-[18px]" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-divider">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap justify-between gap-4 px-4 py-6 text-caption text-ink-muted sm:px-6 lg:px-10">
          <span>{t.common.madeWith}</span>
          <Link href="/privacy" className="underline-offset-2 hover:text-ink hover:underline">
            {l.privacy}
          </Link>
        </div>
      </footer>
    </div>
  );
}

/** Soft brand glow and a faded grid behind the hero. Decorative. */
function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]">
      <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl dark:bg-brand/12" />
      <div
        className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)] opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-divider) 1px, transparent 1px), linear-gradient(to bottom, var(--color-divider) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

/** Static mock of the booking page, so visitors see the product before clicking. */
function BookingPreview() {
  const p = getMessages().landing.preview;
  const weekdays = p.weekdays.split(",");
  // December 2026 starts on a Tuesday.
  const offset = 2;
  const available = new Set([3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18]);
  const selected = 9;
  const times = ["09:00", "09:30", "10:30", "14:00"];

  return (
    <figure
      aria-label={p.label}
      className="relative mx-auto w-full max-w-[520px] lg:mr-0 lg:max-w-[560px] 2xl:max-w-[640px]"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10 rounded-[28px] bg-linear-to-br from-brand/25 via-transparent to-brand-glow/20 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-card border border-border bg-surface shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-divider px-5 py-4">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-soft font-display text-label font-bold text-brand-soft-ink">
            MA
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-ink-muted">{p.host}</span>
            <span className="truncate font-display text-heading text-ink">{p.event}</span>
          </div>
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full bg-neutral-soft px-2.5 py-1 text-caption text-neutral-ink sm:inline-flex">
            <Video className="size-3.5" />
            {p.meta}
          </span>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_132px]">
          <div className="flex flex-col gap-3">
            <span className="text-label font-semibold text-ink">{p.month} 2026</span>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-ink-muted">
              {weekdays.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: offset }, (_, i) => (
                <span key={`e${i}`} />
              ))}
              {Array.from({ length: 21 }, (_, i) => i + 1).map((day) => (
                <span
                  key={day}
                  className={
                    day === selected
                      ? "flex aspect-square items-center justify-center rounded-[9px] bg-brand text-[12px] font-semibold text-on-brand"
                      : available.has(day)
                        ? "flex aspect-square items-center justify-center rounded-[9px] bg-brand-soft text-[12px] font-semibold text-brand-soft-ink"
                        : "flex aspect-square items-center justify-center text-[12px] text-ink-disabled"
                  }
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caption font-medium text-ink-muted">{p.slots}</span>
            {times.map((time, i) =>
              i === 1 ? (
                <div key={time} className="grid grid-cols-2 gap-1">
                  <span className="flex h-9 items-center justify-center rounded-[10px] bg-ink-secondary text-caption font-semibold text-surface">
                    {time}
                  </span>
                  <span className="flex h-9 items-center justify-center rounded-[10px] bg-brand text-[11px] font-semibold text-on-brand">
                    {p.confirm}
                  </span>
                </div>
              ) : (
                <span
                  key={time}
                  className="flex h-9 items-center justify-center rounded-[10px] border border-border text-caption font-semibold text-brand"
                >
                  {time}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}
