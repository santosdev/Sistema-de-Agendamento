import { expect, test, type Page } from "@playwright/test";

/** Host dashboard with the demo account (RN-66 to RN-73). Seed data is protected, so edits are simulated. */

const SIMULATED = "No modo demonstração esta ação é simulada. Os dados de exemplo não mudam.";

/** Next keeps hidden copies of visited pages: only look at the visible one. */
const main = (page: Page) => page.locator("main:visible");

/** Sidebar on desktop, drawer on mobile. */
async function goTo(page: Page, name: string) {
  // lg breakpoint (1024px): below it the sidebar becomes a drawer.
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("dialog", { name: "Painel" }).getByRole("link", { name }).click();
  } else {
    await page.getByRole("complementary").getByRole("link", { name }).click();
  }
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: 20_000 });
}

async function signInAsDemo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar como anfitrião demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Reuniões" })).toBeVisible();
}

test("protected routes send guests to the login", async ({ page }) => {
  await page.goto("/dashboard/events");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fevents$/);
  await page.getByLabel("E-mail", { exact: true }).fill("ninguem@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible({ timeout: 15_000 });
});

test("demo host: meetings, simulated edits and sign out", async ({ page }, info) => {
  test.setTimeout(90_000); // first run compiles several routes in dev
  await signInAsDemo(page);
  // On mobile the card lives in the closed drawer.
  if (info.project.name !== "mobile") await expect(page.getByText("Modo demonstração").first()).toBeVisible();

  for (const tab of ["Passadas", "Canceladas", "Próximas"]) {
    await main(page).getByRole("link", { name: tab, exact: true }).click();
    await expect(main(page).getByRole("link", { name: tab, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }

  await goTo(page, "Disponibilidade");
  await main(page).getByRole("button", { name: "Salvar alterações" }).click();
  await expect(main(page).getByText(SIMULATED)).toBeVisible({ timeout: 15_000 });

  await goTo(page, "Perfil");
  await expect(main(page).getByLabel("Usuário")).toHaveAttribute("readonly", "");

  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }
  await page.getByRole("button", { name: "Sair" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("demo host creates, edits and deletes an event type", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "covered on desktop");
  test.setTimeout(90_000);
  await signInAsDemo(page);
  await goTo(page, "Tipos de evento");
  await main(page).getByRole("link", { name: "Novo tipo de evento" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Novo tipo de evento" })).toBeVisible();

  const title = `E2E ${Date.now().toString(36)}`;
  await main(page).getByLabel("Título").fill(title);
  const slug = await main(page).getByLabel("Endereço do evento").inputValue();
  expect(slug).toBe(title.toLowerCase().replace(" ", "-"));
  await main(page).getByLabel("Link da reunião").fill("https://meet.google.com/abc-defg-hij");
  await main(page).getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);

  await main(page).getByLabel("Duração (minutos)").fill("45");
  await main(page).getByRole("button", { name: "Salvar alterações" }).click();
  await expect(main(page).getByText("Alterações salvas.")).toBeVisible({ timeout: 15_000 });

  const guest = await page.context().newPage();
  await guest.goto(`/marina-demo/${slug}`);
  await expect(guest.getByText("45 min").first()).toBeVisible();
  await guest.close();

  await main(page).getByRole("button", { name: "Excluir evento" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir evento" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tipos de evento" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(main(page).getByRole("link", { name: `Editar ${title}` })).toHaveCount(0);
});

test("mobile menu opens as a drawer", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "mobile only");
  await signInAsDemo(page);
  await goTo(page, "Perfil");
  await expect(page.getByRole("dialog", { name: "Painel" })).toBeHidden();
});
