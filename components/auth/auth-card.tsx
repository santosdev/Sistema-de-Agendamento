import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

/** Isolated form layout, 480px (DESIGN.md 4, larguras máximas). */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader width="max-w-[480px]" />
      <main id="main" className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-4 pb-12 sm:px-6">
        <section className="flex flex-col gap-6 rounded-card border border-border bg-surface p-5 shadow-card sm:p-7">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-title text-ink">{title}</h1>
            <p className="text-label text-ink-muted">{subtitle}</p>
          </div>
          {children}
        </section>
      </main>
    </>
  );
}
