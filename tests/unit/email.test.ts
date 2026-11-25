import { describe, expect, it } from "vitest";
import { buildBookingEmails, type BookingEmailData } from "@/lib/email/booking-emails";
import { escapeHtml, renderEmail } from "@/lib/email/template";

const base: BookingEmailData = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "confirmed",
  startAt: "2026-12-03T17:30:00.000Z",
  endAt: "2026-12-03T18:00:00.000Z",
  previousStartAt: null,
  icsSequence: 0,
  eventTitle: "Conversa inicial",
  eventUrl: "https://app.test/marina/conversa",
  locationType: "google_meet",
  locationValue: "https://meet.google.com/abc",
  phoneMode: null,
  cancelReason: null,
  guest: { name: "Ana <script>", email: "ana@example.com", phone: null, timeZone: "Europe/Lisbon" },
  host: { name: "Marina", email: "marina@example.com", timeZone: "America/Sao_Paulo", isDemo: false },
  manageUrl: "https://app.test/booking/TOKEN",
  dashboardUrl: "https://app.test/dashboard",
};

describe("booking e-mails (REQUISITOS 7)", () => {
  it("created: guest and host, each in their own time zone (RN-57)", () => {
    const [guest, host] = buildBookingEmails("created", base);
    expect(guest.to).toBe("ana@example.com");
    expect(guest.text).toContain("17:30 a 18:00"); // Lisbon, UTC+0 in December
    expect(guest.text).toContain("https://app.test/booking/TOKEN");
    expect(guest.ics?.cancel).toBe(false);
    expect(guest.ics?.content).toContain("METHOD:PUBLISH");
    expect(host.to).toBe("marina@example.com");
    expect(host.text).toContain("14:30 a 15:00"); // São Paulo, UTC-3
    expect(host.text).toContain("ana@example.com");
  });

  it("escapes guest data in HTML", () => {
    const [guest] = buildBookingEmails("created", base);
    expect(guest.html).not.toContain("<script>");
    expect(guest.html).toContain("Ana &lt;script&gt;");
  });

  it("guest cancel: both get it, .ics is a CANCEL with the same UID (RN-56)", () => {
    const emails = buildBookingEmails("guest_cancelled", {
      ...base,
      status: "cancelled",
      icsSequence: 2,
      cancelReason: "Imprevisto",
    });
    expect(emails).toHaveLength(2);
    expect(emails[1].text).toContain("Imprevisto");
    for (const e of emails) {
      expect(e.ics?.cancel).toBe(true);
      expect(e.ics?.content).toContain("METHOD:CANCEL");
      expect(e.ics?.content).toContain(`UID:${base.id}@agenda.techresolute`);
      expect(e.ics?.content).toContain("SEQUENCE:2");
    }
  });

  it("host cancel: only the guest, with a link to book again", () => {
    const emails = buildBookingEmails("host_cancelled", {
      ...base,
      status: "cancelled",
      cancelReason: "Viagem",
    });
    expect(emails).toHaveLength(1);
    expect(emails[0].text).toContain("Viagem");
    expect(emails[0].text).toContain(base.eventUrl);
  });

  it("guest reschedule: shows the old and new time to both", () => {
    const emails = buildBookingEmails("guest_rescheduled", {
      ...base,
      status: "rescheduled",
      previousStartAt: "2026-12-02T17:30:00.000Z",
      icsSequence: 1,
    });
    expect(emails).toHaveLength(2);
    for (const e of emails) expect(e.text).toMatch(/Horário anterior: .*2 de dezembro/);
    expect(emails[0].ics?.content).toContain("SEQUENCE:1");
  });

  it("host reschedule: only the guest", () => {
    expect(buildBookingEmails("host_rescheduled", { ...base, previousStartAt: base.startAt })).toHaveLength(
      1,
    );
  });

  it("the demo host never receives e-mail (RN-71)", () => {
    const emails = buildBookingEmails("created", { ...base, host: { ...base.host, isDemo: true } });
    expect(emails.map((e) => e.to)).toEqual(["ana@example.com"]);
  });
});

describe("email template", () => {
  it("escapes HTML and keeps a plain text version", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    const { html, text } = renderEmail({ title: "T", intro: "Oi", rows: [["A", "B"]], footer: "F" });
    expect(html).toContain("<!doctype html>");
    expect(text).toBe("T\n\nOi\n\nA: B\n\nF");
  });
});
