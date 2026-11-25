"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupSlotsByDay, type DaySlots } from "@/lib/scheduling/slots";
import { monthBounds } from "@/lib/scheduling/time";

export type YearMonth = { year: number; month: number };

type State =
  { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; days: DaySlots[] };

type Params = {
  username: string;
  eventSlug: string;
  timeZone: string | null;
  month: YearMonth;
  /** Rescheduling: exclude this booking from the busy times. */
  token?: string;
  /** Called when a month arrives from the network (not from the cache). */
  onLoaded?: (days: DaySlots[]) => void;
};

/**
 * Loads free slots for one month of the guest calendar, grouped by the guest day.
 * Raw slots are cached per month range, so switching months or time zones back
 * and forth does not refetch.
 */
export function useMonthSlots({ username, eventSlug, timeZone, month, token, onLoaded }: Params) {
  const cache = useRef(new Map<string, string[]>());
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });
  const [state, setState] = useState<State>({ status: "idle" });
  const [version, setVersion] = useState(0);

  const range = useMemo(
    () => (timeZone ? monthBounds(month.year, month.month, timeZone) : null),
    [month.year, month.month, timeZone],
  );

  useEffect(() => {
    if (!range || !timeZone) return;
    const key = `${range.start.toISOString()}|${range.end.toISOString()}`;
    const cached = cache.current.get(key);
    if (cached) {
      setState({
        status: "ready",
        days: groupSlotsByDay(
          cached.map((s) => new Date(s)),
          timeZone,
        ),
      });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    const query = new URLSearchParams({
      username,
      event: eventSlug,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
    });
    if (token) query.set("token", token);

    fetch(`/api/slots?${query}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`slots ${res.status}`);
        const body = (await res.json()) as { slots: string[] };
        cache.current.set(key, body.slots);
        const days = groupSlotsByDay(
          body.slots.map((s) => new Date(s)),
          timeZone,
        );
        setState({ status: "ready", days });
        onLoadedRef.current?.(days);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, [range, timeZone, username, eventSlug, token, version]);

  /** Drops the cache and reloads (after "slot taken" or a retry). */
  const reload = useCallback(() => {
    cache.current.clear();
    setVersion((v) => v + 1);
  }, []);

  return { state, reload };
}
