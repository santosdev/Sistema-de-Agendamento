import { Logo } from "@/components/brand/logo";
import { getMessages } from "@/lib/i18n";

// Temporary home. Replaced by the agency landing + demo entry in later stages.
export default function HomePage() {
  const t = getMessages();

  return (
    <>
      <header className="mx-auto flex w-full max-w-[1080px] items-center px-4 py-5 sm:px-6">
        <Logo variant="light" />
      </header>

      <main id="main" className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 py-12 sm:px-6">
        <section className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-7">
          <h1 className="font-display text-title text-ink">{t.home.title}</h1>
          <p className="mt-2 text-ink-muted">{t.home.subtitle}</p>
        </section>

        <div className="on-dark mt-6 flex items-center rounded-card bg-sidebar p-5 sm:p-7">
          <Logo variant="dark" />
        </div>
      </main>
    </>
  );
}
