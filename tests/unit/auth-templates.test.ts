import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "supabase", "templates");
const read = (name: string) => readFileSync(join(dir, name), "utf8");

/** Each Supabase Auth template must land on /auth/callback with the right OTP type and destination. */
const expected: Record<string, { type: string; next: string }> = {
  "confirmation.html": { type: "email", next: "/dashboard" },
  "magic_link.html": { type: "email", next: "/dashboard" },
  "recovery.html": { type: "recovery", next: "/reset-password" },
  "email_change.html": { type: "email_change", next: "/dashboard/profile%3Femail%3Dconfirmed" },
};

describe("Supabase Auth e-mail templates (pt-BR)", () => {
  it("covers every template file", () => {
    expect(readdirSync(dir).sort()).toEqual(Object.keys(expected).sort());
  });

  for (const [file, { type, next }] of Object.entries(expected)) {
    it(`${file} links to the callback with type=${type}`, () => {
      const html = read(file);
      expect(html).toContain(
        `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=${type}&amp;next=${next}"`,
      );
      expect(html).toContain('lang="pt-BR"');
      expect(html).not.toContain(String.fromCharCode(0x2014));
    });
  }
});
