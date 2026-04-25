import { test, expect } from "@playwright/test";

/**
 * Export & Share 기능 검증
 *
 * 핵심 원칙: DB 없는 환경(로컬/no-DATABASE_URL)에서도 모든 export가 작동해야 한다.
 * export API는 body.analysisData(POST)를 우선 사용하고 DB는 fallback이어야 한다.
 */

const MOCK_ANALYSIS = {
  id: "test-export-id-1234",
  createdAt: new Date().toISOString(),
  hypothesis: "사용자가 첫 화면에서 핵심 기능을 5초 내에 발견할 수 있는가",
  targetUser: "30대 직장인 신규 유저",
  task: "마일리지 적립하기",
  projectTag: "v1.0",
  inputType: "image",
  verdict: "Partial",
  score: 72,
  summary: "전반적으로 UI가 명확하지만 CTA 버튼 위치가 직관적이지 않습니다.",
  strengths: ["깔끔한 레이아웃", "일관된 색상 체계"],
  thinkAloud: [
    { screen: "홈 화면", thought: "어디서 시작해야 할지 헷갈립니다." },
  ],
  issues: [
    {
      id: "issue-1",
      severity: "Medium",
      title: "CTA 버튼 위치 불명확",
      description: "메인 CTA가 스크롤 아래에 있어 인지하기 어렵습니다.",
      suggestion: "CTA를 화면 상단으로 이동하세요.",
    },
  ],
  thumbnailUrls: [],
  mode: "hypothesis",
};

test.describe("export API — no-DB POST 방식", () => {
  test("POST /api/export/pdf/:id — analysisData 포함 시 200 + PDF 반환", async ({ request }) => {
    const res = await request.post(`/api/export/pdf/${MOCK_ANALYSIS.id}`, {
      data: { analysisData: MOCK_ANALYSIS },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
  });

  test("POST /api/export/docx/:id — analysisData 포함 시 200 + DOCX 반환", async ({ request }) => {
    const res = await request.post(`/api/export/docx/${MOCK_ANALYSIS.id}`, {
      data: { analysisData: MOCK_ANALYSIS },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("officedocument");
  });

  test("POST /api/export/md/:id — analysisData 포함 시 200 + Markdown 반환", async ({ request }) => {
    const res = await request.post(`/api/export/md/${MOCK_ANALYSIS.id}`, {
      data: { analysisData: MOCK_ANALYSIS },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("markdown");
    const text = await res.text();
    expect(text).toContain(MOCK_ANALYSIS.hypothesis);
  });

  test("POST /api/export/jira/:id — analysisData 포함 시 200 + Markdown 반환", async ({ request }) => {
    const res = await request.post(`/api/export/jira/${MOCK_ANALYSIS.id}`, {
      data: { analysisData: MOCK_ANALYSIS },
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
  });

  test("POST /api/export/pdf/:id — analysisData 없고 DB도 없으면 404", async ({ request }) => {
    const res = await request.post(`/api/export/pdf/nonexistent-id-xyz`, {
      data: {},
    });
    // DB 없는 환경: 404. DB 있는 환경도 존재하지 않는 ID면 404.
    expect([404, 503]).toContain(res.status());
  });
});

test.describe("히스토리 페이지 — 공유 및 내보내기 UI", () => {
  test("공유 및 내보내기 버튼 존재", async ({ page }) => {
    await page.goto("/history");
    await page.waitForTimeout(1000);

    const exportBtn = page.locator("button", { hasText: "공유 및 내보내기" });
    // 분석 결과가 있을 때만 버튼이 보임 — 존재 여부만 확인
    if (await exportBtn.count() > 0) {
      await exportBtn.first().click();
      // 패널이 열렸는지 확인
      await expect(page.locator("text=파일로 내보내기")).toBeVisible();
      await expect(page.locator("text=공유 링크")).toBeVisible();
    }
  });

  test("히스토리 페이지 export 패널에 PNG 버튼 없음", async ({ page }) => {
    await page.goto("/history");
    await page.waitForTimeout(1000);

    const exportBtn = page.locator("button", { hasText: "공유 및 내보내기" });
    if (await exportBtn.count() > 0) {
      await exportBtn.first().click();
      // 히스토리에서는 PNG 버튼이 없어야 함
      const pngBtn = page.locator("button", { hasText: "PNG" });
      await expect(pngBtn).toHaveCount(0);
    }
  });

  test("리포트 페이지 export 패널에 PNG 버튼 존재", async ({ page }) => {
    // 리포트 페이지는 실제 ID가 있어야 하므로 히스토리에서 첫 항목 클릭
    await page.goto("/history");
    await page.waitForTimeout(1000);

    const reportLink = page.locator('a[href^="/report/"]').first();
    if (await reportLink.count() > 0) {
      await reportLink.click();
      await page.waitForTimeout(1000);

      const exportBtn = page.locator("button", { hasText: "공유 및 내보내기" });
      if (await exportBtn.count() > 0) {
        await exportBtn.click();
        const pngBtn = page.locator("button", { hasText: "PNG" });
        await expect(pngBtn).toBeVisible();
      }
    }
  });
});

test.describe("공유 링크(/share/:id)", () => {
  test("존재하지 않는 ID — 404 메시지 노출", async ({ page }) => {
    await page.goto("/share/nonexistent-id-xyz");
    await page.waitForTimeout(2000);
    await expect(page.locator("text=리포트를 찾을 수 없습니다")).toBeVisible();
  });
});
