import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

const DEMO_USERNAME = "marina-demo";

// Temporary home. Replaced by the agency landing + demo entry in later stages.
export default function HomePage() {
  const t = getMessages();

  return (
    <>
      <SiteHeader width="max-w-[720px]">
        <ButtonLink href="/login" variant="ghost" size="sm">
          {t.auth.signIn}
        </ButtonLink>
      </SiteHeader>
      <main id="main" className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 py-12 sm:px-6">
        <section className="flex flex-col items-start gap-4 rounded-card border border-border bg-surface p-5 shadow-card sm:p-7">
          <h1 className="font-display text-title text-ink">{t.home.title}</h1>
          <p className="text-ink-muted">{t.home.subtitle}</p>
          <ButtonLink
            href={`/${DEMO_USERNAME}`}
            variant="secondary"
            icon={<ArrowRight aria-hidden="true" className="size-4" />}
          >
            {t.home.demoLink}
          </ButtonLink>
        </section>
      </main>
    </>
  );
}
