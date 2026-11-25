import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { fill, getMessages } from "@/lib/i18n";

const t = getMessages().privacy;
/** Bump when the text changes. */
const UPDATED = "2026-11-25";

export const metadata: Metadata = { title: t.title };

/** RN-64: privacy notice linked from the booking form. */
export default function PrivacyPage() {
  const sections = Object.values(t.sections);
  const [y, m, d] = UPDATED.split("-");
  return (
    <>
      <SiteHeader width="max-w-[720px]" />
      <main id="main" className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-4 pb-12 sm:px-6">
        <article className="flex flex-col gap-6 rounded-card border border-border bg-surface p-5 shadow-card sm:p-8">
          <header className="flex flex-col gap-2">
            <h1 className="font-display text-title text-ink">{t.title}</h1>
            <p className="text-caption text-ink-muted">{fill(t.updated, { date: `${d}/${m}/${y}` })}</p>
            <p className="text-body text-ink-secondary">{t.intro}</p>
          </header>
          {sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-1.5">
              <h2 className="font-display text-heading text-ink">{s.title}</h2>
              <p className="text-body text-ink-secondary">{s.body}</p>
            </section>
          ))}
        </article>
      </main>
    </>
  );
}
