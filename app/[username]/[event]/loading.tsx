import { Skeleton } from "@/components/ui/skeleton";
import { getMessages } from "@/lib/i18n";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label={getMessages().common.loading} className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-4 py-5 sm:px-6">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6">
        <div className="grid overflow-hidden rounded-card border border-border bg-surface lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex flex-col gap-4 border-b border-divider p-7 lg:border-r lg:border-b-0">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="grid gap-8 p-7 sm:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[minmax(0,1fr)_248px]">
            <div className="flex flex-col gap-4">
              <Skeleton className="h-11 w-40" />
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }, (_, i) => (
                  <Skeleton key={i} className="aspect-square min-h-touch" />
                ))}
              </div>
            </div>
            <div className="hidden flex-col gap-2 sm:flex">
              <Skeleton className="mb-1 h-6 w-40" />
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-control" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
