"use client";

import { Check, ChevronDown, Globe, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatTime, timeZoneCity, timeZoneName, timeZoneOffsetLabel } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";

type Option = { id: string; city: string; region: string; offset: string; search: string };

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function buildOptions(current: string): Option[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  zones.add(current);
  const now = new Date();
  return [...zones]
    .filter((id) => id.includes("/") || id === "UTC")
    .map((id) => {
      const city = timeZoneCity(id);
      const region = id.includes("/") ? id.split("/")[0] : "UTC";
      const offset = timeZoneOffsetLabel(id, now);
      return { id, city, region, offset, search: normalize(`${city} ${id} ${offset} ${timeZoneName(id)}`) };
    })
    .sort((a, b) => a.region.localeCompare(b.region) || a.city.localeCompare(b.city));
}

type Props = { value: string | null; onChange: (timeZone: string) => void; align?: "left" | "right" };

/** DESIGN.md 7.7: button with zone name and current time, opening a searchable list. */
export function TimeZonePicker({ value, onChange, align = "right" }: Props) {
  const t = getMessages().booking.timeZone;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Current time next to the zone, refreshed every 30 s (client only).
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  const options = useMemo(() => (open && value ? buildOptions(value) : []), [open, value]);
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((o) => o.search.includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!value) return <Skeleton className="h-touch w-44" />;

  const label = timeZoneName(value);

  function openList() {
    const index = buildOptions(value!).findIndex((o) => o.id === value);
    setQuery("");
    setActive(Math.max(index, 0));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function choose(option: Option) {
    onChange(option.id);
    close();
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={fill(t.button, { zone: label })}
        onClick={() => (open ? setOpen(false) : openList())}
        className="inline-flex h-touch max-w-full items-center gap-2 rounded-control px-3 text-label text-ink-secondary transition-colors hover:bg-brand-soft hover:text-brand-soft-ink"
      >
        <Globe aria-hidden="true" className="size-[18px] shrink-0" />
        <span className="truncate">{label}</span>
        {now ? (
          <span className="hidden text-ink-muted tabular-nums sm:inline">{formatTime(now, value)}</span>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-card-sm border border-border bg-surface shadow-pop",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="relative border-b border-divider p-2">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-ink-muted"
            />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={filtered[active] ? `${id}-${active}` : undefined}
              aria-autocomplete="list"
              aria-label={t.search}
              placeholder={t.search}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              className="h-control w-full rounded-control bg-surface-soft pr-3 pl-10 text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
            />
          </div>
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={t.label}
            className="max-h-72 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-label text-ink-muted">{t.noResults}</li>
            ) : (
              filtered.map((option, index) => {
                const selected = option.id === value;
                return (
                  <li
                    key={option.id}
                    id={`${id}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={selected}
                    onPointerMove={() => setActive(index)}
                    onClick={() => choose(option)}
                    className={cn(
                      "flex min-h-touch cursor-pointer items-center justify-between gap-3 rounded-control px-3 text-label",
                      index === active ? "bg-brand-soft text-brand-soft-ink" : "text-ink",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Check
                        aria-hidden="true"
                        className={cn("size-4", selected ? "opacity-100" : "opacity-0")}
                      />
                      <span>
                        {option.city}
                        <span className="ml-1.5 text-caption text-ink-muted">{option.region}</span>
                      </span>
                    </span>
                    <span className="text-caption text-ink-muted tabular-nums">{option.offset}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
