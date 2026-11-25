import { expect, test } from "@playwright/test";

test("home renders with the brand lockup", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Tech Resolute" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
