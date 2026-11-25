import { cn } from "@/lib/cn";
import { fill, getMessages } from "@/lib/i18n";

const STEPS = ["pick", "details", "done"] as const;
export type Step = (typeof STEPS)[number];

/** DESIGN.md 7.8: three segments, mobile only. */
export function Progress({ step }: { step: Step }) {
  const t = getMessages().booking;
  const index = STEPS.indexOf(step) + 1;

  return (
    <div className="flex flex-col gap-2 sm:hidden">
      <p className="text-caption text-ink-muted">
        {fill(t.progress, { step: index })} · {t.steps[step]}
      </p>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={index}
        aria-valuetext={`${fill(t.progress, { step: index })}: ${t.steps[step]}`}
        className="grid grid-cols-3 gap-1.5"
      >
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1 rounded-full transition-colors duration-(--duration-slow)",
              i < index ? "bg-brand" : "bg-brand-soft",
            )}
          />
        ))}
      </div>
    </div>
  );
}
