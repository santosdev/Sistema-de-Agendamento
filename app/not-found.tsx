import { SearchX } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

export default function NotFound() {
  const t = getMessages();
  return (
    <>
      <SiteHeader width="max-w-[720px]" />
      <main
        id="main"
        className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-4 px-4 pb-24 text-center"
      >
        <SearchX aria-hidden="true" className="size-6 text-ink-muted" />
        <h1 className="font-display text-title text-ink">{t.notFound.title}</h1>
        <p className="text-body text-ink-muted">{t.notFound.body}</p>
        <ButtonLink href="/" variant="secondary">
          {t.notFound.home}
        </ButtonLink>
      </main>
    </>
  );
}
