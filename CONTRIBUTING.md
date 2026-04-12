# 커밋 컨벤션

| 타입 | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `ui` | UI/스타일 변경 |
| `refactor` | 코드 리팩토링 |
| `chore` | 설정, 패키지 변경 |
| `docs` | 문서 수정 |

## 예시

```
feat: 플로우 분석 탭 추가
fix: Figma API 토큰 파싱 오류 수정
ui: Overview 썸네일 그리드 레이아웃 개선
```

## 브랜치 전략

- `main` — production (Vercel 자동 배포)
- `develop` — 통합 테스트 (Vercel preview 자동 배포)
- `feature/기능명` — 기능 개발 단위

**흐름:** `feature/*` → PR to `develop` → PR to `main`
