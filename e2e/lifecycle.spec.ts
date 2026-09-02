import { expect, test } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

for (const viewport of [DESKTOP, ...MOBILE]) {
  test.describe(`suite 14 — ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("home, wall, compose, monument stay public-safe", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("body")).toBeVisible();
      expect(await page.content()).not.toMatch(/SERVICE_ROLE|sk_live_|claimSecretHash/);

      await page.goto("/open");
      await expect(page.locator("body")).toBeVisible();

      await page.goto("/wall");
      await expect(page.locator("body")).toBeVisible();

      const mark = page.getByRole("button", { name: /leave your mark/i });
      if (await mark.isVisible().catch(() => false)) {
        await mark.click();
        const composer = page.getByLabel(/your sentence/i);
        if (await composer.isVisible().catch(() => false)) {
          await composer.fill("E2E sentence.");
          await expect(page.getByText(/13 \/ 140|12 \/ 140/)).toBeVisible();
          await expect(page.getByText(/characters remaining/i)).toBeVisible();
        }
      }

      await page.goto("/about");
      await expect(page.getByRole("heading", { name: /a monument, not a feed/i })).toBeVisible();

      await page.goto("/monument");
      await expect(page.locator("body")).toBeVisible();
      expect(await page.content()).not.toMatch(/SERVICE_ROLE|wallKey|claimSecretHash/);
    });
  });
}
