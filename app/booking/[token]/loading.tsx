import { Skeleton } from "@/components/ui/skeleton";
import { getMessages } from "@/lib/i18n";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label={getMessages().common.loading} className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[720px] px-4 py-5 sm:px-6">
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mx-auto w-full max-w-[720px] px-4 sm:px-6">
        <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-7">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-12 w-72 max-w-full" />
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2 border-t border-divider pt-5">
            <Skeleton className="h-control w-32" />
            <Skeleton className="h-control w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
