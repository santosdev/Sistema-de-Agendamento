import { CalendarDays, Clock, Globe } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { PublicEvent, PublicHost } from "@/lib/booking/types";
import { EVENT_COLORS } from "@/lib/design/tokens";
import { formatDuration, formatLongDate, formatTime, timeZoneName } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";
import { describeLocation, LocationIcon } from "./location";

type Props = {
  host: Pick<PublicHost, "displayName" | "avatarUrl">;
  event: PublicEvent;
  /** Chosen slot, shown from step 2 on. */
  selected?: { start: string; end: string; timeZone: string } | null;
  action?: ReactNode;
  compact?: boolean;
};

/** Column 1 of the booking card (DESIGN.md 10.2). */
export function EventSummary({ host, event, selected, action, compact = false }: Props) {
  const location = describeLocation(event.locationType, event.phoneMode, event.address, { booked: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={host.displayName} src={host.avatarUrl} size={40} />
        <p className="text-label text-ink-muted">{host.displayName}</p>
      </div>

      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 h-5 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: EVENT_COLORS[event.color] }}
        />
        <h1 className="font-display text-title text-ink">{event.title}</h1>
      </div>

      <ul className="flex flex-col gap-2.5 text-label text-ink-secondary">
        <li className="flex items-center gap-2.5">
          <Clock aria-hidden="true" className="size-[18px] shrink-0 text-ink-muted" />
          {formatDuration(event.durationMinutes)}
        </li>
        <li className="flex items-start gap-2.5">
          <LocationIcon type={event.locationType} className="mt-0.5 size-[18px] shrink-0 text-ink-muted" />
          <span>
            {location.label}
            {location.detail ? (
              <span className="block text-caption text-ink-muted">{location.detail}</span>
            ) : null}
          </span>
        </li>
        {selected ? (
          <>
            <li className="flex items-start gap-2.5 font-medium text-ink">
              <CalendarDays aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-brand" />
              <span>
                {formatLongDate(selected.start, selected.timeZone)}
                <span className="block tabular-nums">
                  {fill(getMessages().common.timeRange, {
                    start: formatTime(selected.start, selected.timeZone),
                    end: formatTime(selected.end, selected.timeZone),
                  })}
                </span>
              </span>
            </li>
            <li className="flex items-center gap-2.5 text-caption text-ink-muted">
              <Globe aria-hidden="true" className="size-4 shrink-0" />
              {timeZoneName(selected.timeZone)}
            </li>
          </>
        ) : null}
      </ul>

      {action}

      {!compact && event.description ? (
        <p className="text-body whitespace-pre-line text-ink-muted">{event.description}</p>
      ) : null}
    </div>
  );
}
