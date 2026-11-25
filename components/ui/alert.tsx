import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "error" | "success" | "info";

const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  error: {
    box: "border-danger/20 bg-danger-soft text-danger",
    icon: <CircleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />,
  },
  success: {
    box: "border-success-ink/15 bg-success-soft text-success-ink",
    icon: <CircleCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />,
  },
  info: {
    box: "border-border bg-surface-soft text-ink-secondary",
    icon: <Info aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />,
  },
};

/** Inline alert (DESIGN.md 7.12). Errors are announced immediately. */
export function Alert({
  tone = "error",
  children,
  action,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-control border px-4 py-3 text-label",
        tones[tone].box,
        className,
      )}
    >
      {tones[tone].icon}
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}
