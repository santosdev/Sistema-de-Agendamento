import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LOGO_R_PATH, LOGO_R_VIEWBOX } from "@/components/brand/logo-r-path";

const read = (file: string) => readFileSync(resolve(__dirname, "../..", file), "utf8");

// Guard: the R must never drift from the official vector in public/logo-r.svg.
describe("logo R", () => {
  const official = read("public/logo-r.svg");
  const officialPath = official.match(/\sd="([^"]+)"/)?.[1];
  const officialViewBox = official.match(/viewBox="([^"]+)"/)?.[1];

  it("component path matches public/logo-r.svg", () => {
    expect(LOGO_R_PATH).toBe(officialPath);
    expect(LOGO_R_VIEWBOX).toBe(officialViewBox);
  });

  it("favicon uses the same path in brand purple", () => {
    const icon = read("app/icon.svg");
    expect(icon).toContain(`d="${officialPath}"`);
    expect(icon).toContain('fill="#5B02FD"');
  });
});
