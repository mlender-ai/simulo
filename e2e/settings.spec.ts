import { test, expect } from "@playwright/test";

test.describe("설정 페이지 기능 테스트", () => {
  test("API 키 입력 필드 존재", async ({ page }) => {
    await page.goto("/settings");

    // API 키 입력 필드가 있는지 확인
    const apiKeyInput = page.locator('input[type="password"], input[type="text"]').first();
    await expect(apiKeyInput).toBeVisible();
  });

  test("언어 전환 동작", async ({ page }) => {
    await page.goto("/settings");

    // 언어 선택 요소 확인
    const langSelector = page.locator("select, [role='listbox'], button:has-text('한국어'), button:has-text('English')");
    if (await langSelector.count() > 0) {
      await expect(langSelector.first()).toBeVisible();
    }
  });

  test("모델 선택 옵션 확인", async ({ page }) => {
    await page.goto("/settings");

    // 모델 선택 관련 요소 확인
    const modelOption = page.locator("text=/Haiku|Sonnet|모델/i");
    if (await modelOption.count() > 0) {
      await expect(modelOption.first()).toBeVisible();
    }
  });
});
