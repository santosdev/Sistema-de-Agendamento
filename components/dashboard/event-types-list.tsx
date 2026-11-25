"use client";

import { Clock, ExternalLink, LayoutList, Pencil } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { LocationIcon } from "@/components/booking/location";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { setEventActiveAction, type DashboardResult } from "@/lib/dashboard/actions";
import type { HostEventType } from "@/lib/dashboard/queries";
import { EVENT_COLORS } from "@/lib/design/tokens";
import { formatDuration } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";
import { CopyButton } from "./copy-button";
import { errorText } from "./error-text";
import { Switch } from "./switch";

export function EventTypesList({ events, baseUrl }: { events: HostEventType[]; baseUrl: string }) {
  const t = getMessages();
  const te = t.dashboard.events;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-6 shadow-card">
        <LayoutList aria-hidden="true" className="size-6 text-ink-muted" />
        <h2 className="font-display text-heading text-ink">{te.empty}</h2>
        <p className="text-label text-ink-muted">{te.emptyBody}</p>
        <ButtonLink href="/dashboard/events/new">{te.new}</ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <ul className="grid gap-4 md:grid-cols-2">
        {events.map((e) => {
          const url = `${baseUrl}/${e.slug}`;
          return (
            <li
              key={e.id}
              className="relative flex flex-col gap-4 overflow-hidden rounded-card-sm border border-border bg-surface p-5 pt-6 shadow-card"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ backgroundColor: EVENT_COLORS[e.color] }}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <h2 className="font-display text-heading text-ink">
                    <Link
                      href={`/dashboard/events/${e.id}`}
                      aria-label={fill(te.editLink, { title: e.title })}
                      className="rounded-control underline-offset-2 hover:underline"
                    >
                      {e.title}
                    </Link>
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Chip icon={<Clock aria-hidden="true" />}>{formatDuration(e.duration_minutes)}</Chip>
                    <Chip icon={<LocationIcon type={e.location_type} />}>{t.location[e.location_type]}</Chip>
                  </div>
                </div>
                <Switch
                  checked={e.is_active}
                  disabled={pending}
                  label={te.fields.active}
                  stateLabel={e.is_active ? te.active : te.inactive}
                  onChange={(isActive) => {
                    setError(null);
                    startTransition(async () => {
                      const r = await setEventActiveAction({ id: e.id, isActive }).catch(
                        (): DashboardResult => ({ ok: false, error: "unknown" }),
                      );
                      if (!r.ok) setError(errorText(r.error));
                    });
                  }}
                />
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-divider pt-4">
                <ButtonLink
                  href={`/dashboard/events/${e.id}`}
                  variant="ghost"
                  size="sm"
                  icon={<Pencil aria-hidden="true" className="size-4" />}
                >
                  {te.edit}
                </ButtonLink>
                {e.is_active ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-touch items-center gap-2 rounded-control px-4 text-label font-semibold text-ink-secondary hover:bg-brand-soft hover:text-brand-soft-ink"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    {te.view}
                  </a>
                ) : null}
                <CopyButton value={url} className="sm:ml-auto" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
