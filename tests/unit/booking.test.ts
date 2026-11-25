import { describe, expect, it } from "vitest";
import { dbErrorCode, toBookingError, toManageError } from "@/lib/booking/errors";
import { guestFormSchema, normalizePhone } from "@/lib/booking/schemas";
import { hasEnded } from "@/lib/booking/status";
import type { PublicEvent } from "@/lib/booking/types";
import { formatDuration, formatLongDate, formatTime, timeZoneName } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { buildIcs, escapeText, foldLine } from "@/lib/ics";

const t = getMessages().booking.form;

const event: Pick<PublicEvent, "questions" | "locationType" | "phoneMode"> = {
  locationType: "google_meet",
  phoneMode: null,
  questions: [
    { id: "goal", type: "long_text", label: "Objetivo", required: true },
    { id: "size", type: "single_choice", label: "Tamanho", required: false, options: ["P", "M"] },
    { id: "topics", type: "multi_choice", label: "Temas", required: true, options: ["A", "B"] },
  ],
};

const valid = {
  name: "  Ana Souza ",
  email: " Ana@Example.COM ",
  phone: "(11) 91234-5678",
  answers: { goal: "Crescer", size: "", topics: ["A"] },
  website: "",
};

describe("normalizePhone (RN-20)", () => {
  it.each([
    ["(11) 91234-5678", "+5511912345678"],
    ["11 3456-7890", "+551134567890"],
    ["+1 (212) 555-0100", "+12125550100"],
    ["0044 20 7946 0958", "+442079460958"],
    ["   ", ""],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe("guestFormSchema", () => {
  it("accepts and normalizes valid input", () => {
    const result = guestFormSchema(event, t).parse(valid);
    expect(result.name).toBe("Ana Souza");
    expect(result.email).toBe("ana@example.com");
    expect(result.phone).toBe("+5511912345678");
  });

  it("allows an empty optional phone, rejects an invalid one", () => {
    expect(guestFormSchema(event, t).safeParse({ ...valid, phone: "" }).success).toBe(true);
    const bad = guestFormSchema(event, t).safeParse({ ...valid, phone: "123" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].message).toBe(t.invalidPhone);
  });

  it("requires the phone when the host calls", () => {
    const phoneEvent = { ...event, locationType: "phone" as const, phoneMode: "host_calls" as const };
    const result = guestFormSchema(phoneEvent, t).safeParse({ ...valid, phone: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(t.phoneRequired);

    // Typed but not a phone: says it is invalid, not that it is missing.
    const typed = guestFormSchema(phoneEvent, t).safeParse({ ...valid, phone: "abc" });
    expect(typed.error?.issues[0].message).toBe(t.invalidPhone);
  });

  it("enforces required questions and valid options", () => {
    const schema = guestFormSchema(event, t);
    expect(schema.safeParse({ ...valid, answers: { ...valid.answers, goal: "  " } }).success).toBe(false);
    expect(schema.safeParse({ ...valid, answers: { ...valid.answers, topics: [] } }).success).toBe(false);
    expect(schema.safeParse({ ...valid, answers: { ...valid.answers, size: "G" } }).success).toBe(false);
    expect(schema.safeParse({ ...valid, answers: { ...valid.answers, topics: ["Z"] } }).success).toBe(false);
  });

  it("rejects invalid name and email with friendly messages", () => {
    const result = guestFormSchema(event, t).safeParse({ ...valid, name: "A", email: "nope" });
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toContain(t.nameTooShort);
    expect(messages).toContain(t.invalidEmail);
  });
});

describe("error mapping", () => {
  it("recognizes database error codes only", () => {
    expect(dbErrorCode({ message: "slot_taken" })).toBe("slot_taken");
    expect(dbErrorCode({ message: "duplicate key value" })).toBeNull();
    expect(dbErrorCode(null)).toBeNull();
  });

  it("collapses slot rules into what the guest can act on", () => {
    expect(toBookingError("outside_notice")).toBe("slot_unavailable");
    expect(toBookingError("outside_availability")).toBe("slot_unavailable");
    expect(toBookingError("slot_taken")).toBe("slot_taken");
    expect(toBookingError(null)).toBe("unknown");
    expect(toManageError("demo_seed_protected")).toBe("demo_seed_protected");
    expect(toManageError("modification_deadline_passed")).toBe("modification_deadline_passed");
  });

  it("has a message for every code the UI can receive", () => {
    const messages = getMessages();
    for (const code of [
      "slot_taken",
      "slot_unavailable",
      "daily_limit_reached",
      "event_not_found",
      "invalid_guest",
      "invalid_answers",
      "rate_limited",
      "unknown",
    ] as const) {
      expect(messages.booking.errors[code]).toBeTruthy();
    }
  });
});

describe("ics (RN-56)", () => {
  const base = {
    uid: "abc@agenda.techresolute",
    sequence: 2,
    start: new Date("2027-05-10T12:00:00Z"),
    end: new Date("2027-05-10T12:30:00Z"),
    summary: "Conversa inicial · Marina Alves",
    description: "com Marina\n\nLink: https://x.test/booking/t",
    location: "Av. Paulista, 1000; São Paulo",
    url: "https://x.test/booking/t",
    status: "CONFIRMED" as const,
    now: new Date("2027-05-01T00:00:00Z"),
  };

  it("builds a valid VEVENT with CRLF line endings", () => {
    const ics = buildIcs(base);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n")).toEqual(
      expect.arrayContaining([
        "BEGIN:VCALENDAR",
        "METHOD:PUBLISH",
        "UID:abc@agenda.techresolute",
        "SEQUENCE:2",
        "DTSTAMP:20270501T000000Z",
        "DTSTART:20270510T120000Z",
        "DTEND:20270510T123000Z",
        "LOCATION:Av. Paulista\\, 1000\\; São Paulo",
        "STATUS:CONFIRMED",
        "END:VCALENDAR",
      ]),
    );
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("uses METHOD:CANCEL for cancelled bookings", () => {
    const ics = buildIcs({ ...base, status: "CANCELLED" });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("escapes text and folds long lines at 75 octets without breaking characters", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const long = `DESCRIPTION:${"ação ".repeat(40)}`;
    const folded = foldLine(long);
    const encoder = new TextEncoder();
    for (const line of folded.split("\r\n")) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    expect(
      folded
        .split("\r\n")
        .map((l, i) => (i === 0 ? l : l.slice(1)))
        .join(""),
    ).toBe(long);
  });
});

describe("formatting", () => {
  it("formats in the given zone, independent of the machine", () => {
    const instant = "2027-05-10T02:30:00Z";
    expect(formatTime(instant, "America/Sao_Paulo")).toBe("23:30");
    expect(formatLongDate(instant, "America/Sao_Paulo")).toBe("Domingo, 9 de maio de 2027");
    expect(formatLongDate(instant, "Asia/Tokyo")).toBe("Segunda-feira, 10 de maio de 2027");
  });

  it("names time zones the way the design asks", () => {
    expect(timeZoneName("America/Sao_Paulo")).toBe("Horário de Brasília");
    expect(timeZoneName("Mars/Olympus")).toBe("Olympus");
  });

  it("formats durations", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
  });

  it("knows when a meeting ended", () => {
    const now = Date.parse("2027-05-10T12:00:00Z");
    expect(hasEnded("2027-05-10T11:59:00Z", now)).toBe(true);
    expect(hasEnded("2027-05-10T12:30:00Z", now)).toBe(false);
  });
});
