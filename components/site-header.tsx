import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/** Light header with the brand lockup (DESIGN.md 10.1, 10.2). */
export function SiteHeader({ children, width = "max-w-[1080px]" }: { children?: ReactNode; width?: string }) {
  return (
    <header
      className={`mx-auto flex w-full ${width} items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5`}
    >
      <Link href="/" aria-label="Tech Resolute" className="rounded-control">
        <Logo variant="light" />
      </Link>
      {children}
    </header>
  );
}
