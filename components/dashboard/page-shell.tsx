import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard page frame: one h1, optional subtitle and action (DESIGN.md 10.7). */
export function PageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-title text-ink">{title}</h1>
          {subtitle ? <p className="text-label text-ink-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </main>
  );
}

/** Loading state shaped like a list of cards (DESIGN.md 8). */
export function PageSkeleton({ title }: { title: string }) {
  return (
    <PageShell title={title}>
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-11 w-72" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-card-sm" />
        ))}
      </div>
    </PageShell>
  );
}
