import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/** Header with the brand lockup and the theme toggle (DESIGN.md 10.1, 10.2). */
export function SiteHeader({
  children,
  width = "max-w-[82.5rem]",
}: {
  children?: ReactNode;
  width?: string;
}) {
  return (
    <header
      className={`mx-auto flex w-full ${width} items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5 lg:px-10`}
    >
      <Link href="/" aria-label="Tech Resolute" className="shrink-0 rounded-control">
        <Logo variant="light" />
      </Link>
      <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}
