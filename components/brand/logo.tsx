import { cn } from "@/lib/cn";
import { LogoR } from "./logo-r";

type LogoProps = {
  variant?: "light" | "dark";
  className?: string;
};

const styles = {
  light: {
    r: "text-brand",
    bar: "bg-logo-bar",
    tech: "text-ink-secondary",
    resolute: "text-ink",
  },
  dark: {
    r: "text-white",
    bar: "bg-sidebar-border",
    tech: "text-sidebar-ink",
    resolute: "text-white",
  },
} as const;

/**
 * Full lockup: R | Tech / Resolute.
 * light: for light backgrounds. dark: for the dashboard sidebar.
 */
export function Logo({ variant = "light", className }: LogoProps) {
  const s = styles[variant];

  return (
    <span role="img" aria-label="Tech Resolute" className={cn("inline-flex items-center gap-3", className)}>
      <LogoR className={cn("h-7 w-auto shrink-0", s.r)} />
      <span aria-hidden="true" className={cn("w-px self-stretch", s.bar)} />
      <span aria-hidden="true" className="flex flex-col">
        <span className={cn("font-sans text-[13px] leading-4 font-normal", s.tech)}>Tech</span>
        <span className={cn("font-display text-[19px] leading-5 font-bold tracking-[-0.01em]", s.resolute)}>
          Resolute
        </span>
      </span>
    </span>
  );
}
