import { CircleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const controlClasses =
  "w-full rounded-control border border-border-input bg-surface px-4 text-ink placeholder:text-ink-muted " +
  "transition-colors duration-(--duration-fast) hover:border-ink-secondary " +
  "focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "aria-invalid:border-danger";

type FieldProps = {
  id: string;
  label: ReactNode;
  optionalLabel?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

/** Label above, hint and error below, wired with aria-describedby (DESIGN.md 7.2). */
export function Field({ id, label, optionalLabel, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-label text-ink-secondary">
        {label}
        {optionalLabel ? (
          <>
            {" "}
            <span className="text-ink-muted">{optionalLabel}</span>
          </>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-caption font-medium text-danger">
      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </p>
  );
}

/** aria-describedby for a field with optional hint and error. */
export function describedBy(id: string, { hint, error }: { hint?: string; error?: string }) {
  const ids = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClasses, "h-control", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "min-h-28 resize-y py-3", className)} {...props} />;
}
