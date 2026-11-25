import { expect, test, type Page } from "@playwright/test";

/**
 * Guest flow against the real database (demo host). Each run books, reschedules and
 * cancels one meeting per project, so it stays under the rate limit (RN-60: 5 per 10 min per IP).
 * Bookings made here are removed by the daily demo reset.
 */

const EVENT = "/marina-demo/conversa-inicial";

async function pickSlot(page: Page, dayIndex: number) {
  const slots = page.getByRole("list", { name: "Horários disponíveis" }).getByRole("button");
  await expect(slots.first()).toBeVisible();
  const days = page.locator('[role=grid] button[aria-label$="horários disponíveis"]');
  await days.nth(Math.min(dayIndex, (await days.count()) - 1)).click();
  await slots.last().click();
}

test("guest books, reschedules and cancels through the manage link", async ({ page }, info) => {
  const email = `e2e+${info.project.name}-${Date.now()}@example.com`;

  await page.goto(EVENT);
  await expect(page.getByRole("heading", { name: "Conversa inicial" })).toBeVisible();
  await pickSlot(page, info.project.name === "mobile" ? 1 : 0);
  await page.getByRole("button", { name: /^Continuar · / }).click();

  // Validation: the required question blocks the submit.
  await page.getByLabel("Nome", { exact: true }).fill("Teste E2E");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
  await expect(page.getByText("Campo obrigatório.")).toBeVisible();
  await page.getByLabel("O que você quer resolver?").fill("Teste automatizado");
  await expect(page.getByRole("link", { name: "Política de privacidade" })).toHaveAttribute(
    "href",
    "/privacy",
  );
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();

  await expect(page.getByRole("heading", { name: "Reunião confirmada" })).toBeVisible({ timeout: 20_000 });
  const ics = page.getByRole("link", { name: "Adicionar ao calendário" });
  const icsResponse = await page.request.get((await ics.getAttribute("href"))!);
  expect(icsResponse.headers()["content-type"]).toContain("text/calendar");
  expect(await icsResponse.text()).toContain("METHOD:PUBLISH");

  const manageHref = (await page.getByRole("link", { name: /Cancelar ou remarcar/ }).getAttribute("href"))!;
  await page.goto(manageHref);
  await expect(page.getByText("Confirmada")).toBeVisible();

  await page.getByRole("button", { name: "Remarcar" }).click();
  await expect(page.getByText(/^Horário atual:/)).toBeVisible();
  const slots = page.getByRole("list", { name: "Horários disponíveis" }).getByRole("button");
  await slots.first().click();
  await page.getByRole("button", { name: /^Remarcar para / }).click();
  await expect(page.getByText("Reunião remarcada.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Remarcada", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Horário anterior:/)).toBeVisible();

  await page.getByRole("button", { name: "Cancelar reunião" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo").fill("Teste E2E");
  await dialog.getByRole("button", { name: "Cancelar reunião" }).click();
  await expect(page.getByText("Reunião cancelada.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Motivo: Teste E2E")).toBeVisible();
  expect(
    await (await page.request.get(manageHref.replace("/booking/", "/api/booking/") + "/ics")).text(),
  ).toContain("METHOD:CANCEL");
});

test("unknown pages and tokens show the 404 page", async ({ page }) => {
  await page.goto("/marina-demo/nao-existe");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await page.goto("/booking/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("calendar works with the keyboard", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "keyboard test runs on desktop");
  await page.goto(EVENT);
  await expect(
    page.getByRole("list", { name: "Horários disponíveis" }).getByRole("button").first(),
  ).toBeVisible();
  const firstAvailable = page.locator('[role=grid] button[aria-label$="horários disponíveis"]').first();
  await firstAvailable.focus();
  await expect(firstAvailable).toHaveAttribute("tabindex", "0");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[role=grid] button:focus")).toHaveCount(1);
});
