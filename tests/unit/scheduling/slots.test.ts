import { describe, expect, it } from "vitest";
import {
  generateSlots,
  groupSlotsByDay,
  type BusyRange,
  type DateOverride,
  type GenerateSlotsInput,
  type SlotEvent,
  type WeeklyRule,
} from "@/lib/scheduling/slots";

// Fixed clock: Wednesday 2027-05-05 09:00 in Sao Paulo (12:00 UTC).
const NOW = new Date("2027-05-05T12:00:00Z");

const EVENT: SlotEvent = {
  id: "evt",
  durationMinutes: 30,
  slotIntervalMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minNoticeMinutes: 0,
  maxDaysAhead: 60,
  dailyLimit: null,
};

const weekdays = (start: string, end: string): WeeklyRule[] =>
  [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: start, endTime: end }));

function run(overrides: Partial<Omit<GenerateSlotsInput, "event">> & { event?: Partial<SlotEvent> } = {}) {
  const { event, ...rest } = overrides;
  return generateSlots({
    hostTimeZone: "America/Sao_Paulo",
    rules: weekdays("09:00", "12:00"),
    overrides: [],
    busy: [],
    now: NOW,
    from: new Date("2027-05-10T00:00:00Z"),
    to: new Date("2027-05-11T00:00:00Z"),
    ...rest,
    event: { ...EVENT, ...event },
  });
}

/** Slots as "HH:MM" wall clock in a zone. */
const times = (slots: Date[], timeZone = "America/Sao_Paulo") =>
  slots.map((s) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(s),
  );

const busy = (start: string, end: string, extra: Partial<BusyRange> = {}): BusyRange => ({
  eventTypeId: "other",
  start: new Date(start),
  blockedFrom: new Date(start),
  blockedUntil: new Date(end),
  ...extra,
});

describe("weekly availability (RN-20 to RN-28)", () => {
  it("generates slots inside the interval, in the host zone", () => {
    const slots = run(); // Monday 2027-05-10
    expect(times(slots)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
    expect(slots[0].toISOString()).toBe("2027-05-10T12:00:00.000Z");
  });

  it("steps by the slot interval, independent of the duration", () => {
    expect(times(run({ event: { durationMinutes: 60, slotIntervalMinutes: 30 } }))).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
    ]);
    expect(times(run({ event: { durationMinutes: 45, slotIntervalMinutes: 60 } }))).toEqual([
      "09:00",
      "10:00",
      "11:00",
    ]);
  });

  it("only offers slots that end inside the interval", () => {
    expect(times(run({ event: { durationMinutes: 90 } })).at(-1)).toBe("10:30");
    expect(run({ event: { durationMinutes: 240 } })).toEqual([]);
  });

  it("supports several intervals per day", () => {
    const rules = [
      { weekday: 1, startTime: "09:00", endTime: "10:00" },
      { weekday: 1, startTime: "13:30:00", endTime: "14:30:00" },
    ];
    expect(times(run({ rules }))).toEqual(["09:00", "09:30", "13:30", "14:00"]);
  });

  it("returns nothing on days without rules", () => {
    const sunday = { from: new Date("2027-05-09T03:00:00Z"), to: new Date("2027-05-10T03:00:00Z") };
    expect(run(sunday)).toEqual([]);
  });

  it("supports intervals ending at 24:00", () => {
    const rules = [{ weekday: 1, startTime: "23:00", endTime: "24:00" }];
    const slots = run({ rules, to: new Date("2027-05-12T00:00:00Z") });
    expect(times(slots)).toEqual(["23:00", "23:30"]);
  });
});

describe("date overrides (RN-25)", () => {
  it("a day off removes the whole day", () => {
    const overrides: DateOverride[] = [{ date: "2027-05-10", startTime: null, endTime: null }];
    expect(run({ overrides })).toEqual([]);
  });

  it("special hours replace the weekly rules for that date", () => {
    const overrides: DateOverride[] = [
      { date: "2027-05-10", startTime: "15:00", endTime: "16:00" },
      { date: "2027-05-10", startTime: "18:00", endTime: "18:30" },
    ];
    expect(times(run({ overrides }))).toEqual(["15:00", "15:30", "18:00"]);
  });

  it("can open a day that has no weekly rules", () => {
    const overrides: DateOverride[] = [{ date: "2027-05-09", startTime: "10:00", endTime: "11:00" }];
    const sunday = { from: new Date("2027-05-09T03:00:00Z"), to: new Date("2027-05-10T03:00:00Z") };
    expect(times(run({ overrides, ...sunday }))).toEqual(["10:00", "10:30"]);
  });
});

describe("existing bookings and buffers (RN-29, RN-33)", () => {
  it("removes slots that overlap a booking, keeps back to back ones", () => {
    // Booking 10:00 to 10:30 local (13:00 to 13:30 UTC).
    const slots = run({ busy: [busy("2027-05-10T13:00:00Z", "2027-05-10T13:30:00Z")] });
    expect(times(slots)).toEqual(["09:00", "09:30", "10:30", "11:00", "11:30"]);
  });

  it("applies the event buffers around the new slot", () => {
    const slots = run({
      event: { bufferBeforeMinutes: 15, bufferAfterMinutes: 15 },
      busy: [busy("2027-05-10T13:00:00Z", "2027-05-10T13:30:00Z")],
    });
    // 09:30 ends 10:00 + 15 min buffer overlaps; 10:30 - 15 min overlaps.
    expect(times(slots)).toEqual(["09:00", "11:00", "11:30"]);
  });

  it("respects the buffers of the existing booking", () => {
    // Existing 10:00-10:30 with 30 min buffer after: blocked until 11:00.
    const slots = run({ busy: [busy("2027-05-10T13:00:00Z", "2027-05-10T14:00:00Z")] });
    expect(times(slots)).toEqual(["09:00", "09:30", "11:00", "11:30"]);
  });

  it("blocks with bookings of any event type of the host", () => {
    const slots = run({ busy: [busy("2027-05-10T12:00:00Z", "2027-05-10T15:00:00Z", { eventTypeId: "x" })] });
    expect(slots).toEqual([]);
  });
});

describe("notice, past and window (RN-30, RN-31)", () => {
  const today = { from: new Date("2027-05-05T00:00:00Z"), to: new Date("2027-05-06T00:00:00Z") };

  it("never offers past slots, even with zero notice", () => {
    // NOW is 09:00 local on Wednesday; 09:00 itself is not offered.
    expect(times(run({ ...today })).at(0)).toBe("09:30");
  });

  it("applies the minimum notice", () => {
    expect(times(run({ ...today, event: { minNoticeMinutes: 120 } }))).toEqual(["11:00", "11:30"]);
  });

  it("lets hosts ignore the notice when rescheduling", () => {
    const slots = run({ ...today, event: { minNoticeMinutes: 120 }, enforceNotice: false });
    expect(times(slots).at(0)).toBe("09:30");
  });

  it("stops at the maximum window", () => {
    const slots = run({
      event: { maxDaysAhead: 5 },
      from: NOW,
      to: new Date("2027-05-20T00:00:00Z"),
    });
    // NOW + 5 days = 2027-05-10 12:00 UTC (09:00 local): 09:00 that Monday is the last slot.
    expect(slots.at(-1)?.toISOString()).toBe("2027-05-10T12:00:00.000Z");
  });
});

describe("daily limit (RN-32)", () => {
  const sameEvent = (start: string) =>
    busy(start, new Date(Date.parse(start) + 30 * 60_000).toISOString(), {
      eventTypeId: "evt",
    });

  it("closes the day when the event reached its limit", () => {
    const slots = run({
      event: { dailyLimit: 2 },
      busy: [sameEvent("2027-05-10T12:00:00Z"), sameEvent("2027-05-10T14:00:00Z")],
    });
    expect(slots).toEqual([]);
  });

  it("keeps the day open below the limit", () => {
    const slots = run({ event: { dailyLimit: 2 }, busy: [sameEvent("2027-05-10T12:00:00Z")] });
    expect(slots.length).toBeGreaterThan(0);
  });

  it("does not count other event types", () => {
    const other = busy("2027-05-10T12:00:00Z", "2027-05-10T12:30:00Z", { eventTypeId: "other" });
    expect(run({ event: { dailyLimit: 1 }, busy: [other] }).length).toBe(5);
  });

  it("counts by the host local day, not the UTC day", () => {
    // 2027-05-11 01:00 UTC is still Monday 22:00 in Sao Paulo.
    const lateMonday = sameEvent("2027-05-11T01:00:00Z");
    expect(run({ event: { dailyLimit: 1 }, busy: [lateMonday] })).toEqual([]);
  });
});

describe("time zones and DST (RN-34, RN-35)", () => {
  const ny = { hostTimeZone: "America/New_York", rules: [] as WeeklyRule[] };

  it("skips wall clocks that do not exist when the clocks jump forward", () => {
    const slots = run({
      ...ny,
      overrides: [{ date: "2027-03-14", startTime: "01:00", endTime: "05:00" }],
      now: new Date("2027-03-01T00:00:00Z"),
      from: new Date("2027-03-14T00:00:00Z"),
      to: new Date("2027-03-15T00:00:00Z"),
    });
    expect(times(slots, "America/New_York")).toEqual(["01:00", "01:30", "03:00", "03:30", "04:00", "04:30"]);
    // 01:30 EST ends at 03:00 EDT, one real half hour later.
    expect(slots[1].toISOString()).toBe("2027-03-14T06:30:00.000Z");
  });

  it("offers repeated wall clocks twice when the clocks fall back", () => {
    const slots = run({
      ...ny,
      overrides: [{ date: "2027-11-07", startTime: "00:00", endTime: "03:00" }],
      now: new Date("2027-11-01T00:00:00Z"),
      from: new Date("2027-11-07T00:00:00Z"),
      to: new Date("2027-11-08T00:00:00Z"),
    });
    expect(times(slots, "America/New_York")).toEqual([
      "00:00",
      "00:30",
      "01:00",
      "01:30",
      "01:00",
      "01:30",
      "02:00",
      "02:30",
    ]);
    expect(new Set(slots.map((s) => s.getTime())).size).toBe(8);
  });

  it("keeps the host wall clock across a DST change", () => {
    const slots = run({
      ...ny,
      rules: [{ weekday: 1, startTime: "09:00", endTime: "09:30" }],
      now: new Date("2027-03-01T00:00:00Z"),
      from: new Date("2027-03-08T00:00:00Z"),
      to: new Date("2027-03-16T00:00:00Z"),
    });
    expect(slots.map((s) => s.toISOString())).toEqual([
      "2027-03-08T14:00:00.000Z",
      "2027-03-15T13:00:00.000Z",
    ]);
  });

  it("groups by the guest day, which can differ from the host day", () => {
    const slots = run({
      rules: [{ weekday: 1, startTime: "20:00", endTime: "22:00" }],
      to: new Date("2027-05-12T00:00:00Z"),
    });
    // 20:00 to 21:30 in Sao Paulo = 08:00 to 09:30 Tuesday in Tokyo.
    expect(groupSlotsByDay(slots, "America/Sao_Paulo").map((d) => d.date)).toEqual(["2027-05-10"]);
    const tokyo = groupSlotsByDay(slots, "Asia/Tokyo");
    expect(tokyo.map((d) => d.date)).toEqual(["2027-05-11"]);
    expect(times(tokyo[0].slots, "Asia/Tokyo")).toEqual(["08:00", "08:30", "09:00", "09:30"]);
  });

  it("splits one host day into two guest days", () => {
    // 09:00 to 11:30 in Sao Paulo = 12:00 to 14:30 UTC = 22:00 Monday to 00:30 Tuesday in Sydney (UTC+10).
    const sydney = groupSlotsByDay(run(), "Australia/Sydney");
    expect(sydney.map((d) => [d.date, times(d.slots, "Australia/Sydney")])).toEqual([
      ["2027-05-10", ["22:00", "22:30", "23:00", "23:30"]],
      ["2027-05-11", ["00:00", "00:30"]],
    ]);
  });
});

describe("output", () => {
  it("is sorted, unique and limited to [from, to)", () => {
    const slots = run({ from: new Date("2027-05-10T12:30:00Z"), to: new Date("2027-05-10T14:00:00Z") });
    expect(times(slots)).toEqual(["09:30", "10:00", "10:30"]);
  });

  it("handles a two month range quickly", () => {
    const started = performance.now();
    const slots = run({
      rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "00:00", endTime: "24:00" })),
      event: { slotIntervalMinutes: 5, durationMinutes: 5 },
      from: NOW,
      to: new Date("2027-07-04T12:00:00Z"),
    });
    expect(slots.length).toBeGreaterThan(10_000);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
