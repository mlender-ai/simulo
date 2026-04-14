import { test, expect } from "@playwright/test";

test.describe("페이지 로드 테스트", () => {
  test("메인 페이지 (/) 정상 로드", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveTitle(/Simulo/i);
  });

  test("분석 페이지 (/analyze) 정상 로드", async ({ page }) => {
    const response = await page.goto("/analyze");
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();
  });

  test("히스토리 페이지 (/history) 정상 로드", async ({ page }) => {
    const response = await page.goto("/history");
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();
  });

  test("설정 페이지 (/settings) 정상 로드", async ({ page }) => {
    const response = await page.goto("/settings");
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();
  });

  test("존재하지 않는 페이지 → 404", async ({ page }) => {
    const response = await page.goto("/nonexistent-page-12345");
    expect(response?.status()).toBe(404);
  });
});

test.describe("콘솔 에러 체크", () => {
  const pages = ["/", "/analyze", "/history", "/settings"];

  for (const path of pages) {
    test(`${path} — 콘솔에 JS 에러 없음`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForTimeout(2000);

      expect(errors).toEqual([]);
    });
  }
});

test.describe("네비게이션 동작", () => {
  test("사이드바 링크 동작 확인", async ({ page }) => {
    await page.goto("/");

    // 히스토리 링크 확인
    const historyLink = page.locator('a[href="/history"]');
    if (await historyLink.count() > 0) {
      await historyLink.first().click();
      await expect(page).toHaveURL(/\/history/);
    }
  });

  test("설정 링크 동작 확인", async ({ page }) => {
    await page.goto("/");

    const settingsLink = page.locator('a[href="/settings"]');
    if (await settingsLink.count() > 0) {
      await settingsLink.first().click();
      await expect(page).toHaveURL(/\/settings/);
    }
  });
});
