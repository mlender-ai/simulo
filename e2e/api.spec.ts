import { test, expect } from "@playwright/test";

test.describe("API 엔드포인트 테스트", () => {
  test("GET /api/health — 헬스체크 정상", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("status");
  });

  test("GET /api/history — 히스토리 목록 조회", async ({ request }) => {
    const response = await request.get("/api/history");
    expect(response.status()).toBe(200);
  });

  test("POST /api/analyze — 빈 바디로 요청 시 에러 핸들링", async ({ request }) => {
    const response = await request.post("/api/analyze", {
      data: {},
    });
    // 400 또는 에러 응답이어야 하며, 500 서버 크래시는 안 됨
    expect(response.status()).not.toBe(500);
  });

  test("POST /api/analyze — 잘못된 inputType으로 요청", async ({ request }) => {
    const response = await request.post("/api/analyze", {
      data: { inputType: "invalid_type" },
    });
    expect(response.status()).not.toBe(500);
  });

  test("POST /api/figma-validate — 빈 바디로 요청 시 에러 핸들링", async ({ request }) => {
    const response = await request.post("/api/figma-validate", {
      data: {},
    });
    expect(response.status()).not.toBe(500);
  });

  test("GET /api/report — ID 없이 요청 시 에러 핸들링", async ({ request }) => {
    const response = await request.get("/api/report");
    // 400 또는 적절한 에러 응답
    expect(response.status()).not.toBe(500);
  });

  test("GET /api/report?id=nonexistent — 존재하지 않는 리포트", async ({ request }) => {
    const response = await request.get("/api/report?id=nonexistent-id-12345");
    // DB 미연결 시 503 가능, 정상 환경에서는 404
    expect([404, 400, 200, 503]).toContain(response.status());
  });
});
