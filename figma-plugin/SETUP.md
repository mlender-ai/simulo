# Simulo Figma Plugin — 로컬 설치 가이드

## 사전 준비

### 1. Figma 데스크톱 앱 설치 (필수)

플러그인 개발/로컬 테스트는 **데스크톱 앱에서만** 가능합니다. 웹 버전(figma.com)에서는 로컬 플러그인을 불러올 수 없습니다.

- 다운로드: https://www.figma.com/downloads/
- macOS: `.dmg` 파일 실행 후 Applications에 드래그
- 설치 후 Figma 계정으로 로그인

### 2. Anthropic API 키

플러그인이 Claude API를 직접 호출하므로 API 키가 필요합니다.

- https://console.anthropic.com/settings/keys 에서 발급
- `sk-ant-api03-...` 형태
- 플러그인 첫 실행 시 설정 패널에 입력 (기기 로컬에만 저장)

### 3. 플러그인 빌드 확인

터미널에서 빌드 결과물이 있는지 확인합니다:

```bash
cd figma-plugin
ls dist/
```

아래 두 파일이 있어야 합니다:
```
dist/code.js     ← 플러그인 샌드박스 코드
dist/ui.html     ← 플러그인 UI (JS 인라인 포함)
```

파일이 없으면 빌드를 실행합니다:
```bash
cd figma-plugin
npm install
npm run build
```

`webpack compiled successfully` 메시지가 나오면 성공입니다.

---

## 설치 순서

### Step 1. Figma 데스크톱 앱 실행

Figma 데스크톱 앱을 열고, 아무 디자인 파일을 엽니다 (기존 파일 또는 새 파일).

### Step 2. 플러그인 Import

1. 상단 메뉴에서 `Plugins` 클릭
2. `Development` 선택
3. `Import plugin from manifest...` 클릭
4. 파일 선택 창에서 아래 경로의 `manifest.json`을 선택:

```
/Users/yanadoo/simulo/figma-plugin/manifest.json
```

### Step 3. 플러그인 실행

Import 후 바로 플러그인을 실행합니다:

1. 상단 메뉴 → `Plugins` → `Development` → **Simulo** 클릭
2. 플러그인 패널이 우측 또는 하단에 열림

---

## 작동 확인 체크리스트

### A. 플러그인이 열리지 않는 경우

| 증상 | 원인 | 해결 |
|------|------|------|
| "Import plugin" 메뉴가 없음 | 웹 브라우저에서 Figma 사용 중 | Figma **데스크톱 앱**으로 전환 |
| manifest.json 선택 후 아무 반응 없음 | dist/ 폴더에 빌드 결과물 없음 | `cd figma-plugin && npm run build` 실행 |
| "Plugin failed to load" 에러 | dist/code.js 또는 dist/ui.html 경로 불일치 | manifest.json의 `main`, `ui` 경로가 `dist/code.js`, `dist/ui.html`인지 확인 |

### B. 플러그인은 열리지만 분석이 안 되는 경우

| 증상 | 원인 | 해결 |
|------|------|------|
| "API 키를 입력해주세요" | API 키 미입력 | 플러그인 상단 `⚙ API 설정` 클릭 → API 키 입력 |
| "API 오류 401" | API 키가 잘못됨 | https://console.anthropic.com/settings/keys 에서 키 재확인 |
| "API 오류 429" | API 사용량 초과 | Anthropic 콘솔에서 usage 확인, 잠시 후 재시도 |
| "프레임이나 레이어를 선택해주세요" | Figma에서 아무것도 선택 안 함 | 캔버스에서 프레임/레이어를 클릭하여 선택 |

### C. 정상 작동 확인 순서

1. **프레임 선택**: Figma 캔버스에서 프레임 1~2개를 선택
   - 상단 선택바에 `2개 선택됨 — FrameName1, FrameName2` 표시되면 OK

2. **UX 분석 모드 테스트**:
   - `UX 분석` 탭 선택 (기본)
   - 가설 입력: `사용자가 메인 CTA를 인지할 수 있는가?`
   - 타깃 유저 입력: `신규 사용자`
   - `2개 화면 분석 시작` 버튼 클릭
   - 로딩 → 점수/평가/이슈 결과가 나오면 성공

3. **UX 라이팅 모드 테스트**:
   - `UX 라이팅` 탭 클릭
   - `2개 화면 UX 라이팅 체크` 버튼 클릭
   - 로딩 → 점수/이슈(현재→제안)/강점이 나오면 성공

---

## 개발 모드 (코드 수정 시)

코드를 수정하면서 실시간 확인하려면:

```bash
cd figma-plugin
npm run watch
```

`watch` 모드에서는 소스 파일 저장 시 자동으로 `dist/`가 갱신됩니다.
Figma에서 `Plugins` → `Development` → `Simulo` 우클릭 → `Run last plugin` (또는 `Cmd + Option + P`)으로 리로드합니다.

---

## 팀원에게 공유하는 방법

로컬 플러그인은 import한 본인 계정에서만 보입니다. 팀원에게 공유하려면:

### 방법 A: 저장소 공유 (권장)

1. 팀원이 이 레포를 clone
2. `cd figma-plugin && npm install && npm run build`
3. Figma 데스크톱 앱에서 `manifest.json` import
4. 각자의 API 키를 플러그인 설정에 입력

### 방법 B: dist 폴더만 전달

아래 3개 파일을 하나의 폴더에 넣어 전달:

```
manifest.json
dist/code.js
dist/ui.html
```

팀원이 Figma에서 `manifest.json`을 import하면 됩니다.

---

## 파일 구조 참고

```
figma-plugin/
├── manifest.json          ← Figma가 읽는 플러그인 설정
├── package.json           ← 빌드 의존성
├── webpack.config.js      ← 빌드 설정
├── tsconfig.json          ← TypeScript 설정
├── src/
│   ├── plugin/
│   │   └── code.ts        ← 샌드박스 코드 (Figma API 접근)
│   └── ui/
│       ├── index.html      ← UI 템플릿
│       └── ui.ts           ← UI 로직 (Claude API 호출)
└── dist/                   ← 빌드 결과물 (git에 포함하지 않음)
    ├── code.js
    └── ui.html
```
