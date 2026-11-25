"use client";

import {
  CalendarClock,
  CalendarDays,
  FlaskConical,
  LayoutList,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/lib/auth/actions";
import { getMessages } from "@/lib/i18n";
import { CopyButton } from "./copy-button";

type Props = { publicUrl: string; isDemo: boolean };

const NAV = [
  { href: "/dashboard", key: "meetings", icon: CalendarDays },
  { href: "/dashboard/events", key: "events", icon: LayoutList },
  { href: "/dashboard/availability", key: "availability", icon: CalendarClock },
  { href: "/dashboard/profile", key: "profile", icon: UserRound },
] as const;

/** DESIGN.md 10.7: dark sidebar on desktop, header with a drawer on mobile. */
export function Sidebar({ publicUrl, isDemo }: Props) {
  const t = getMessages();
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = drawer.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const content = (
    <div className="flex h-full flex-col gap-6 p-4">
      <nav aria-label={t.dashboard.nav.label}>
        <ul className="flex flex-col gap-1">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex h-touch items-center gap-3 rounded-control px-3 text-label transition-colors",
                    active
                      ? "bg-sidebar-active font-semibold text-white"
                      : "text-sidebar-ink hover:bg-sidebar-active/60 hover:text-white",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                  {t.dashboard.nav[key]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        {isDemo ? (
          <div className="flex gap-3 rounded-card-sm border border-sidebar-border p-3 text-caption text-sidebar-ink">
            <FlaskConical aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
            <div>
              <p className="font-semibold text-white">{t.dashboard.demo.title}</p>
              <p>{t.dashboard.demo.body}</p>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 border-t border-sidebar-border pt-4">
          <p className="text-caption text-sidebar-ink">{t.dashboard.publicLink}</p>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate text-caption font-medium text-white underline-offset-2 hover:underline"
          >
            {publicUrl.replace(/^https?:\/\//, "")}
          </a>
          <CopyButton value={publicUrl} tone="dark" />
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex h-touch w-full items-center gap-3 rounded-control px-3 text-label text-sidebar-ink transition-colors hover:bg-sidebar-active/60 hover:text-white"
          >
            <LogOut aria-hidden="true" className="size-5" strokeWidth={1.75} />
            {t.auth.signOut}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="on-dark sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar lg:flex">
        <div className="flex h-18 items-center border-b border-sidebar-border px-5">
          <Link href="/dashboard" aria-label="Tech Resolute" className="rounded-control">
            <Logo variant="dark" />
          </Link>
        </div>
        {content}
      </aside>

      {/* Mobile */}
      <header className="on-dark sticky top-0 z-20 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <Link href="/dashboard" aria-label="Tech Resolute" className="rounded-control">
          <Logo variant="dark" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.dashboard.nav.openMenu}
          aria-haspopup="dialog"
          className="inline-flex size-touch items-center justify-center rounded-control text-white hover:bg-sidebar-active"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
      </header>
      <dialog
        ref={drawer}
        aria-label={t.dashboard.nav.label}
        onClose={() => setOpen(false)}
        className="on-dark m-0 ml-auto h-dvh max-h-none w-72 max-w-[85vw] bg-sidebar p-0 text-white backdrop:bg-ink/50 lg:hidden"
      >
        <div className="flex items-center justify-end px-4 pt-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.dashboard.nav.closeMenu}
            className="inline-flex size-touch items-center justify-center rounded-control text-white hover:bg-sidebar-active"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {content}
      </dialog>
    </>
  );
}
