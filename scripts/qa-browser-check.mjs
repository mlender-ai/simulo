/**
 * Playwright 기반 브라우저 QA 검사 스크립트
 *
 * 검사 항목:
 * 1. body overflow: hidden 감지 (Next.js dev overlay / JS 에러로 인한 UI 전체 잠금)
 * 2. Next.js dev overlay 활성화 여부
 * 3. 버튼 클릭 가능성 (다른 요소에 가려져 있는지)
 * 4. JS 런타임 에러
 * 5. HTTP 500 응답
 * 6. 전체화면 오버레이 감지
 *
 * 사용법:
 *   node scripts/qa-browser-check.mjs
 *   node scripts/qa-browser-check.mjs --url http://localhost:3001
 */

import { chromium } from '@playwright/test';

const BASE_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:3000';

const PAGES = [
  { url: `${BASE_URL}`, name: 'Home (/)' },
  { url: `${BASE_URL}/history`, name: 'History' },
  { url: `${BASE_URL}/dashboard`, name: 'Dashboard' },
  { url: `${BASE_URL}/settings`, name: 'Settings' },
];

async function checkPage(browser, url, name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const issues = [];
  const pageErrors = [];
  const http500s = [];

  page.on('pageerror', err => pageErrors.push(err.message.slice(0, 300)));
  page.on('response', resp => {
    if (resp.status() >= 500) http500s.push(`${resp.status()} ${resp.url().slice(0, 100)}`);
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    await page.close();
    return { name, url, issues: [`[CRITICAL] 페이지 로드 타임아웃: ${e.message.slice(0, 100)}`], pageErrors: [], buttonCount: 0 };
  }

  // ── 1. body overflow 검사 ──────────────────────────────────────────────────
  const bodyState = await page.evaluate(() => ({
    overflow: window.getComputedStyle(document.body).overflow,
    height: document.body.offsetHeight,
    styleAttr: document.body.getAttribute('style') || '',
  }));
  if (bodyState.overflow === 'hidden') {
    issues.push(`[CRITICAL] body overflow:hidden 감지 — UI 잠금 상태. style="${bodyState.styleAttr}", height=${bodyState.height}px`);
  }
  if (bodyState.height === 0) {
    issues.push(`[CRITICAL] body height=0 — 콘텐츠가 렌더링되지 않음`);
  }

  // ── 2. Next.js dev overlay 활성화 감지 ────────────────────────────────────
  const hasDevOverlay = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal');
    if (!portal) return false;
    const shadow = portal.shadowRoot;
    if (shadow) {
      return !!(
        shadow.querySelector('[data-nextjs-dialog]') ||
        shadow.querySelector('.nextjs-container-errors-header') ||
        shadow.querySelector('[data-nextjs-toast]')
      );
    }
    // shadow DOM 없는 경우 innerHTML로 판단
    return portal.innerHTML.length > 500;
  });
  if (hasDevOverlay) {
    issues.push(`[CRITICAL] Next.js dev overlay 활성화 — JS 에러 또는 .next 캐시 불일치. 해결: kill $(lsof -ti:3000) && rm -rf .next && npm run dev`);
  }

  // ── 3. 버튼 클릭 가능성 검사 ──────────────────────────────────────────────
  const buttons = await page.locator('button:visible').all();
  const blockedButtons = [];
  for (const btn of buttons.slice(0, 15)) {
    const box = await btn.boundingBox();
    if (!box || box.width === 0 || box.height === 0) continue;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const topEl = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return { tag: 'null', cls: '' };
      return { tag: el.tagName, cls: el.className?.slice?.(0, 60) || '' };
    }, { x: cx, y: cy });
    // 버튼 내부 자식(span, svg, path 등)이 top element로 잡히는 건 정상 — 클릭 가능
    // 완전히 다른 요소(div, nextjs-portal 등)가 덮고 있을 때만 CRITICAL
    const CLICKABLE_TAGS = new Set(['BUTTON', 'INPUT', 'A', 'LABEL', 'SELECT', 'TEXTAREA', 'SPAN', 'SVG', 'PATH', 'IMG', 'P', 'DIV']);
    const isInsideButton = topEl.tag !== 'null' && await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return false;
      let cur = el;
      while (cur) {
        if (cur.tagName === 'BUTTON') return true;
        cur = cur.parentElement;
      }
      return false;
    }, { x: cx, y: cy });
    // null = 뷰포트 밖 (스크롤 필요) → false positive이므로 스킵
    if (topEl.tag !== 'null' && !CLICKABLE_TAGS.has(topEl.tag) && !isInsideButton) {
      const text = (await btn.textContent())?.trim().slice(0, 20) || '';
      blockedButtons.push(`"${text}" → 가리는 요소: ${topEl.tag}.${topEl.cls.split(' ')[0]}`);
    }
  }
  if (blockedButtons.length > 0) {
    issues.push(`[CRITICAL] ${blockedButtons.length}개 버튼 클릭 불가:\n    ${blockedButtons.join('\n    ')}`);
  }

  // ── 4. HTTP 500 에러 ───────────────────────────────────────────────────────
  if (http500s.length > 0) {
    issues.push(`[CRITICAL] HTTP 500 에러: ${http500s.slice(0, 3).join(', ')}`);
  }

  // ── 5. JS 런타임 에러 ─────────────────────────────────────────────────────
  if (pageErrors.length > 0) {
    const firstError = pageErrors[0];
    const isCacheError = firstError.includes('Cannot find module') || firstError.includes('.next/');
    const level = isCacheError ? 'CRITICAL' : 'HIGH';
    issues.push(`[${level}] JS 에러 ${pageErrors.length}건. 첫 번째: ${firstError.slice(0, 150)}`);
    if (isCacheError) {
      issues.push(`  → 해결: rm -rf .next && npm run dev`);
    }
  }

  // ── 6. 전체화면 오버레이 감지 ─────────────────────────────────────────────
  const coveringOverlays = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return [...document.querySelectorAll('*')]
      .filter(el => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return (
          (s.position === 'fixed' || s.position === 'absolute') &&
          r.width > vw * 0.8 && r.height > vh * 0.8 &&
          s.pointerEvents !== 'none' &&
          s.display !== 'none' &&
          s.visibility !== 'hidden' &&
          parseFloat(s.opacity || '1') > 0.1 &&
          el.tagName !== 'BODY' && el.tagName !== 'HTML'
        );
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return `${el.tagName} z=${s.zIndex} ${Math.round(r.width)}x${Math.round(r.height)}`;
      });
  });
  if (coveringOverlays.length > 0) {
    issues.push(`[HIGH] 전체화면 오버레이 감지 (의도치 않은 경우): ${coveringOverlays.join(', ')}`);
  }

  await page.close();
  return { name, url, issues, pageErrors, buttonCount: buttons.length };
}

// ── 메인 실행 ────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });
const results = [];

console.log(`\n🔍 Simulo QA Browser Check — ${new Date().toLocaleString('ko-KR')}`);
console.log(`   Base URL: ${BASE_URL}\n`);

for (const { url, name } of PAGES) {
  process.stdout.write(`  Checking ${name}... `);
  const result = await checkPage(browser, url, name);
  results.push(result);
  const hasCritical = result.issues.some(i => i.includes('[CRITICAL]'));
  const hasHigh = result.issues.some(i => i.includes('[HIGH]'));
  console.log(hasCritical ? '✗ FAIL' : hasHigh ? '⚠ WARN' : '✓ PASS');
}

await browser.close();

// ── 결과 출력 ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
let hasCritical = false;
let hasHigh = false;

for (const r of results) {
  const isCritical = r.issues.some(i => i.includes('[CRITICAL]'));
  const isHigh = r.issues.some(i => i.includes('[HIGH]'));
  const status = isCritical ? '✗ FAIL' : isHigh ? '⚠ WARN' : '✓ PASS';

  console.log(`\n${status}  ${r.name}`);
  console.log(`   URL: ${r.url} | 버튼: ${r.buttonCount}개`);

  if (r.issues.length === 0) {
    console.log('   ✓ 모든 검사 통과');
  } else {
    for (const issue of r.issues) {
      console.log(`   ${issue}`);
    }
  }

  if (isCritical) hasCritical = true;
  if (isHigh) hasHigh = true;
}

console.log('\n' + '─'.repeat(60));

if (hasCritical) {
  console.log('❌ QA FAILED — CRITICAL 이슈 발견. 배포/push 불가.\n');
  process.exit(1);
} else if (hasHigh) {
  console.log('⚠️  QA WARN — HIGH 이슈 있음. 확인 후 판단 필요.\n');
  process.exit(0);
} else {
  console.log('✅ QA PASSED — 모든 검사 통과.\n');
  process.exit(0);
}
