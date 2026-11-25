import { expect, test } from "@playwright/test";

test("landing links to the demo, the dashboard and the privacy policy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Agende reuniões sem troca de mensagens");
  await expect(page.getByRole("link", { name: "Ver a página de demonstração" })).toHaveAttribute(
    "href",
    "/marina-demo",
  );
  await page.getByRole("link", { name: "Política de privacidade" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeVisible();
  await expect(page.getByText(/12 meses/)).toBeVisible();
});

test("embed: popup button, link opener and inline iframe (RN-74, RN-75)", async ({ page }) => {
  await page.goto("/embed-example.html");

  const inline = page.locator("[data-techresolute-inline] iframe");
  await expect(inline).toHaveAttribute("src", /\/marina-demo\/consultoria-tecnica\?embed=1$/);
  const frame = page.frameLocator("[data-techresolute-inline] iframe");
  await expect(frame.getByRole("button", { name: /Fuso horário/ })).toBeVisible({ timeout: 20_000 });
  await expect(frame.getByRole("link", { name: /Voltar para/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Agendar conversa" }).click();
  const dialog = page.getByRole("dialog", { name: "Agendar conversa" });
  await expect(dialog.locator("iframe")).toHaveAttribute("src", /conversa-inicial\?embed=1$/);
  await expect(dialog.getByRole("button", { name: "Fechar agendamento" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agendar conversa" })).toBeFocused();

  await page.getByRole("link", { name: /ligação rápida/ }).click();
  await expect(page.getByRole("dialog").locator("iframe")).toHaveAttribute("src", /ligacao-rapida\?embed=1$/);
});

test("cron routes reject calls without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/demo-reset")).status()).toBe(401);
  expect((await request.get("/api/cron/maintenance")).status()).toBe(401);
});

test("forgot password is linked from login and the reset page needs the e-mail link", async ({ page }) => {
  await page.goto("/login");
  await page.locator("main:visible").getByRole("link", { name: "Esqueci minha senha" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Recuperar senha" })).toBeVisible();
  await expect(page.locator("main:visible").getByLabel("E-mail")).toBeVisible();

  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/login\?error=link_invalid$/);
  await expect(page.locator("main:visible").getByText("O link expirou")).toBeVisible();
});

test("shared links carry an Open Graph preview", async ({ page, request }) => {
  await page.goto("/");
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toMatch(/\/opengraph-image/);
  const response = await request.get(new URL(image!).pathname);
  expect(response.headers()["content-type"]).toBe("image/png");
});
