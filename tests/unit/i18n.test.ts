import { describe, expect, it } from "vitest";
import { LOCALES, getDateLocale, getMessages } from "@/lib/i18n";

const EM_DASH = String.fromCharCode(0x2014);

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function values(obj: object): string[] {
  return Object.values(obj).flatMap((v) => (typeof v === "object" && v !== null ? values(v) : [String(v)]));
}

describe("i18n", () => {
  it("every locale has the same keys as pt-BR", () => {
    const base = keys(getMessages("pt-BR")).sort();
    for (const locale of LOCALES) {
      expect(keys(getMessages(locale)).sort()).toEqual(base);
    }
  });

  it("no string uses an em dash", () => {
    for (const locale of LOCALES) {
      for (const text of values(getMessages(locale))) {
        expect(text).not.toContain(EM_DASH);
      }
    }
  });

  it("pt-BR calendar weeks start on Sunday", () => {
    expect(getDateLocale("pt-BR").options?.weekStartsOn).toBe(0);
  });
});
