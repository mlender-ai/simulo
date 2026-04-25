import { test as base, expect, type Page } from "@playwright/test";

export type SimuloFixtures = {
  analyzePage: Page;
  withHistory: Page;
};

export const test = base.extend<SimuloFixtures>({
  analyzePage: async ({ page }, use) => {
    await page.goto("/analyze");
    await expect(page.locator("body")).toBeVisible();
    await use(page);
  },
  withHistory: async ({ page }, use) => {
    await page.goto("/history");
    await expect(page.locator("body")).toBeVisible();
    await use(page);
  },
});

export { expect } from "@playwright/test";
