"use client";

import { CloudOff } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

/** DESIGN.md 8: what happened, what to do, and a retry. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = getMessages();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center"
    >
      <CloudOff aria-hidden="true" className="size-6 text-ink-muted" />
      <h1 className="font-display text-title text-ink">{t.errorPage.title}</h1>
      <p className="text-body text-ink-muted">{t.errorPage.body}</p>
      <Button variant="secondary" onClick={reset}>
        {t.common.tryAgain}
      </Button>
    </main>
  );
}
