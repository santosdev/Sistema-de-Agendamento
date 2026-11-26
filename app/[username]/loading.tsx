import { Skeleton } from "@/components/ui/skeleton";
import { getMessages } from "@/lib/i18n";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label={getMessages().common.loading} className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[75rem] px-4 py-5 sm:px-6 lg:px-10">
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface p-8">
          <Skeleton className="size-[72px] rounded-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-4 w-48" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card-sm border border-border bg-surface p-5">
            <Skeleton className="h-6 w-44" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
