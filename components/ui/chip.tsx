import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Chip({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-caption font-medium text-brand-soft-ink",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

type Status = "confirmed" | "rescheduled" | "cancelled" | "past";

const statusStyles: Record<Status, string> = {
  confirmed: "bg-success-soft text-success-ink",
  rescheduled: "bg-warning-soft text-warning-ink",
  cancelled: "bg-neutral-soft text-neutral-ink",
  past: "bg-neutral-soft text-neutral-ink",
};

/** DESIGN.md 7.4 */
export function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-full px-3 text-caption font-medium",
        statusStyles[status],
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
