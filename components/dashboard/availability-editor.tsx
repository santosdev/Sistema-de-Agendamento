"use client";

import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { controlClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  addOverridesAction,
  deleteOverrideAction,
  saveWeeklyHoursAction,
  type DashboardResult,
} from "@/lib/dashboard/actions";
import type { HostOverride } from "@/lib/dashboard/queries";
import { findWeeklyProblem, type WeeklyInterval } from "@/lib/dashboard/schemas";
import { formatDayHeading, timeZoneName, weekdayNames } from "@/lib/format";
import { fill, getMessages } from "@/lib/i18n";
import { addDays } from "@/lib/scheduling/time";
import { errorText } from "./error-text";

type Interval = { start: string; end: string };

const timeInput = cn(controlClasses, "h-control w-[7.5rem] tabular-nums");

export function AvailabilityEditor({
  timeZone,
  rules,
  overrides,
  today,
}: {
  timeZone: string;
  rules: WeeklyInterval[];
  overrides: HostOverride[];
  today: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <WeeklyHours timeZone={timeZone} initial={rules} />
      <Overrides overrides={overrides} today={today} />
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-heading text-ink">{title}</h2>
        <p className="text-label text-ink-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  function run(action: () => Promise<DashboardResult>, message: string, after?: () => void) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await action().catch((): DashboardResult => ({ ok: false, error: "unknown" }));
      if (!r.ok) setError(errorText(r.error));
      else {
        setSuccess(message);
        after?.();
      }
    });
  }
  return { pending, error, setError, success, run };
}

/** RN-20 to RN-24: zero or more intervals per weekday, no overlaps. */
function WeeklyHours({ timeZone, initial }: { timeZone: string; initial: WeeklyInterval[] }) {
  const t = getMessages();
  const ta = t.dashboard.availability;
  const days = weekdayNames();
  const [byDay, setByDay] = useState<Interval[][]>(() =>
    Array.from({ length: 7 }, (_, d) =>
      initial.filter((r) => r.weekday === d).map(({ start, end }) => ({ start, end })),
    ),
  );
  const { pending, error, setError, success, run } = useAction();

  const update = (day: number, next: Interval[]) =>
    setByDay((all) => all.map((list, i) => (i === day ? next : list)));

  function save() {
    const flat = byDay.flatMap((list, weekday) => list.map((i) => ({ weekday, ...i })));
    const problem = findWeeklyProblem(flat);
    if (problem) {
      const day = days[problem.weekday].long;
      setError(fill(problem.kind === "overlap" ? ta.overlap : ta.order, { day }));
      return;
    }
    run(() => saveWeeklyHoursAction(flat), t.dashboard.saved);
  }

  return (
    <Card title={ta.weekly} hint={fill(ta.weeklyHint, { zone: timeZoneName(timeZone) })}>
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      <ul className="flex flex-col divide-y divide-divider">
        {byDay.map((list, day) => {
          const name = days[day].long.charAt(0).toUpperCase() + days[day].long.slice(1);
          return (
            <li key={day} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start">
              <p className="w-32 shrink-0 pt-3 text-label font-semibold text-ink">{name}</p>
              <div className="flex flex-1 flex-col gap-2">
                {list.length === 0 ? (
                  <p className="pt-3 text-label text-ink-muted">{ta.unavailable}</p>
                ) : null}
                {list.map((interval, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${name}, ${ta.from} ${i + 1}`}
                      className={timeInput}
                      value={interval.start}
                      onChange={(e) =>
                        update(
                          day,
                          list.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                        )
                      }
                    />
                    <span aria-hidden="true" className="text-ink-muted">
                      ·
                    </span>
                    <input
                      type="time"
                      aria-label={`${name}, ${ta.to} ${i + 1}`}
                      className={timeInput}
                      value={interval.end}
                      onChange={(e) =>
                        update(
                          day,
                          list.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                        )
                      }
                    />
                    <IconButton
                      label={fill(ta.removeInterval, { n: i + 1, day: name })}
                      onClick={() =>
                        update(
                          day,
                          list.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" className="size-5" />
                    </IconButton>
                  </div>
                ))}
              </div>
              <IconButton
                label={fill(ta.addInterval, { day: name })}
                onClick={() => {
                  const last = list.at(-1);
                  update(day, [
                    ...list,
                    last
                      ? { start: last.end, end: last.end < "23:00" ? "23:00" : "23:59" }
                      : { start: "09:00", end: "18:00" },
                  ]);
                }}
              >
                <Plus aria-hidden="true" className="size-5" />
              </IconButton>
            </li>
          );
        })}
      </ul>
      <Button size="lg" loading={pending} onClick={save} className="sm:w-fit sm:min-w-48">
        {pending ? t.dashboard.saving : t.dashboard.save}
      </Button>
    </Card>
  );
}

/** RN-25, RN-26: day off or special hours for a date range. */
function Overrides({ overrides, today }: { overrides: HostOverride[]; today: string }) {
  const t = getMessages();
  const ta = t.dashboard.availability;
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [special, setSpecial] = useState(false);
  const [interval, setSpecialHours] = useState<Interval>({ start: "09:00", end: "12:00" });
  const { pending, error, setError, success, run } = useAction();

  function add() {
    if (!startDate || !endDate || endDate < startDate || addDays(startDate, 59) < endDate) {
      setError(ta.rangeInvalid);
      return;
    }
    if (special && !(interval.start < interval.end)) {
      setError(fill(ta.order, { day: formatDayHeading(startDate) }));
      return;
    }
    run(() => addOverridesAction({ startDate, endDate, intervals: special ? [interval] : [] }), ta.added);
  }

  return (
    <Card title={ta.overrides} hint={ta.overridesHint}>
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <div className="flex flex-col gap-4 rounded-card-sm border border-border bg-surface-soft p-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5 text-label text-ink-secondary">
            {ta.startDate}
            <input
              type="date"
              min={today}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
              }}
              className={cn(controlClasses, "h-control w-44")}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-label text-ink-secondary">
            {ta.endDate}
            <input
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={cn(controlClasses, "h-control w-44")}
            />
          </label>
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">{ta.kind}</legend>
          {[false, true].map((value) => (
            <label
              key={String(value)}
              className="flex min-h-control cursor-pointer items-center gap-3 rounded-control border border-border bg-surface px-4 text-label text-ink has-checked:border-brand has-checked:bg-slot-selected has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
            >
              <input
                type="radio"
                name="override-kind"
                checked={special === value}
                onChange={() => setSpecial(value)}
                className="size-4 accent-brand"
              />
              {value ? ta.special : ta.dayOff}
            </label>
          ))}
        </fieldset>
        {special ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              aria-label={ta.from}
              value={interval.start}
              onChange={(e) => setSpecialHours({ ...interval, start: e.target.value })}
              className={timeInput}
            />
            <span aria-hidden="true" className="text-ink-muted">
              ·
            </span>
            <input
              type="time"
              aria-label={ta.to}
              value={interval.end}
              onChange={(e) => setSpecialHours({ ...interval, end: e.target.value })}
              className={timeInput}
            />
          </div>
        ) : null}
        <Button variant="secondary" loading={pending} onClick={add} className="w-fit">
          {ta.addOverride}
        </Button>
      </div>

      {overrides.length === 0 ? (
        <p className="flex items-center gap-2 text-label text-ink-muted">
          <CalendarOff aria-hidden="true" className="size-5" />
          {ta.noOverrides}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {overrides.map((o) => {
            const label = formatDayHeading(o.date);
            return (
              <li key={o.date} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-label font-semibold text-ink">{label}</p>
                  <p className="text-caption text-ink-muted tabular-nums">
                    {o.intervals.length === 0
                      ? ta.dayOffLabel
                      : o.intervals
                          .map((i) => fill(t.common.timeRange, { start: i.start, end: i.end }))
                          .join(", ")}
                  </p>
                </div>
                <IconButton
                  label={fill(ta.remove, { date: label })}
                  disabled={pending}
                  onClick={() => run(() => deleteOverrideAction({ date: o.date }), t.dashboard.saved)}
                >
                  <Trash2 aria-hidden="true" className="size-5" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-touch shrink-0 items-center justify-center rounded-control text-ink-secondary hover:bg-brand-soft hover:text-brand-soft-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}
