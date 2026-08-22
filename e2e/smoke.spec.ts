import { expect, test } from "@playwright/test";

test.describe("public surface", () => {
  test("serves About and does not show private payment fields", async ({ page }) => {
    const about = await page.goto("/about");
    expect(about?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /a monument, not a feed/i })).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/SERVICE_ROLE|sk_live_|claimSecretHash/);
  });

  test("home clock does not expose a treasury secret or Wall Key", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();
    expect(html).not.toMatch(/SERVICE_ROLE|sk_live_|eyJ[a-zA-Z0-9_-]{20,}\./);
    expect(html.toLowerCase()).not.toContain("claimsecrethash");
  });
});
