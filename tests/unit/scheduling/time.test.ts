import { describe, expect, it } from "vitest";
import {
  HOUR_MS,
  addDays,
  dayBounds,
  instantsAt,
  isValidTimeZone,
  localDateOf,
  monthBounds,
  offsetAt,
  parseTimeOfDay,
  startOfWallClock,
  wallClockOf,
  weekdayOf,
} from "@/lib/scheduling/time";

const wall = (iso: string) => Date.parse(`${iso}Z`);
const isoList = (dates: Date[]) => dates.map((d) => d.toISOString());

describe("offsets", () => {
  it("are exact at the DST instant (New York, March 2027)", () => {
    expect(offsetAt(new Date("2027-03-14T06:59:00Z"), "America/New_York") / HOUR_MS).toBe(-5);
    expect(offsetAt(new Date("2027-03-14T07:00:00Z"), "America/New_York") / HOUR_MS).toBe(-4);
  });

  it("are exact at the DST instant (New York, November 2027)", () => {
    expect(offsetAt(new Date("2027-11-07T05:59:00Z"), "America/New_York") / HOUR_MS).toBe(-4);
    expect(offsetAt(new Date("2027-11-07T06:00:00Z"), "America/New_York") / HOUR_MS).toBe(-5);
  });

  it("keeps Sao Paulo at UTC-3 all year", () => {
    expect(offsetAt(new Date("2027-01-15T12:00:00Z"), "America/Sao_Paulo") / HOUR_MS).toBe(-3);
    expect(offsetAt(new Date("2027-07-15T12:00:00Z"), "America/Sao_Paulo") / HOUR_MS).toBe(-3);
  });

  it("handles fractional offsets (India, Nepal)", () => {
    expect(offsetAt(new Date("2027-01-01T00:00:00Z"), "Asia/Kolkata") / HOUR_MS).toBe(5.5);
    expect(offsetAt(new Date("2027-01-01T00:00:00Z"), "Asia/Kathmandu") / HOUR_MS).toBe(5.75);
  });
});

describe("wall clock conversions", () => {
  it("round trips a normal wall clock", () => {
    const [instant] = instantsAt(wall("2027-05-10T09:30:00"), "America/Sao_Paulo");
    expect(instant.toISOString()).toBe("2027-05-10T12:30:00.000Z");
    expect(wallClockOf(instant, "America/Sao_Paulo")).toBe(wall("2027-05-10T09:30:00"));
  });

  it("returns no instant for a skipped wall clock", () => {
    expect(instantsAt(wall("2027-03-14T02:30:00"), "America/New_York")).toEqual([]);
  });

  it("returns two instants for a repeated wall clock", () => {
    expect(isoList(instantsAt(wall("2027-11-07T01:30:00"), "America/New_York"))).toEqual([
      "2027-11-07T05:30:00.000Z",
      "2027-11-07T06:30:00.000Z",
    ]);
  });

  it("maps a skipped wall clock to the moment of the jump", () => {
    expect(startOfWallClock(wall("2027-03-14T02:30:00"), "America/New_York").toISOString()).toBe(
      "2027-03-14T07:00:00.000Z",
    );
    // Santiago jumps at midnight: 2027-09-05 00:00 does not exist.
    expect(startOfWallClock(wall("2027-09-05T00:00:00"), "America/Santiago").toISOString()).toBe(
      "2027-09-05T04:00:00.000Z",
    );
  });

  it("does not depend on the machine time zone", () => {
    // Vitest runs with TZ=UTC; these values would differ if local fields were used.
    expect(localDateOf(new Date("2027-05-10T02:00:00Z"), "America/Sao_Paulo")).toBe("2027-05-09");
    expect(localDateOf(new Date("2027-05-10T02:00:00Z"), "Asia/Tokyo")).toBe("2027-05-10");
  });
});

describe("calendar helpers", () => {
  it("computes 23h and 25h days around DST", () => {
    const spring = dayBounds("2027-03-14", "America/New_York");
    expect((spring.end.getTime() - spring.start.getTime()) / HOUR_MS).toBe(23);
    const fall = dayBounds("2027-11-07", "America/New_York");
    expect((fall.end.getTime() - fall.start.getTime()) / HOUR_MS).toBe(25);
  });

  it("computes month bounds in a zone", () => {
    const { start, end } = monthBounds(2027, 12, "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2027-12-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2028-01-01T03:00:00.000Z");
  });

  it("adds days and finds weekdays across months and years", () => {
    expect(addDays("2027-12-31", 1)).toBe("2028-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(weekdayOf("2027-03-14")).toBe(0); // Sunday
    expect(weekdayOf("2027-03-15")).toBe(1); // Monday
  });

  it("parses times of day, including 24:00", () => {
    expect(parseTimeOfDay("09:30")).toBe(570);
    expect(parseTimeOfDay("13:30:00")).toBe(810);
    expect(parseTimeOfDay("24:00")).toBe(1440);
    expect(() => parseTimeOfDay("9:30")).toThrow();
    expect(() => parseTimeOfDay("24:30")).toThrow();
    expect(() => parseTimeOfDay("10:75")).toThrow();
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
