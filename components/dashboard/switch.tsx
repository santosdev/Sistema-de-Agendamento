"use client";

import { cn } from "@/lib/cn";

/** Accessible on/off switch (role="switch"), 44px touch target. */
export function Switch({
  checked,
  onChange,
  label,
  stateLabel,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  stateLabel?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex h-touch shrink-0 items-center gap-2 rounded-control px-1 text-caption font-medium text-ink-secondary disabled:opacity-50"
    >
      {stateLabel ? <span aria-hidden="true">{stateLabel}</span> : null}
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-10 rounded-full transition-colors duration-(--duration-fast)",
          checked ? "bg-brand" : "bg-border-input",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-(--duration-fast) ease-out-soft",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}
