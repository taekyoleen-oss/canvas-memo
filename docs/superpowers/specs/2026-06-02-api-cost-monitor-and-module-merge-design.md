# 설계서 — API 비용 모니터 + 모듈 합치기/이미지 복사 보강

작성일: 2026-06-02
대상 앱: MindCanvas (Next.js 16, App Router, Supabase SSR, Zustand, Tailwind v4)

두 개의 독립 기능을 한 번에 다룬다. 서로 코드 영역이 겹치지 않는다.
- **기능 A**: 개인 API 지출(Anthropic + OpenAI) 모니터 패널 (헤더 💲 → 오버레이)
- **기능 B**: 멀티 모듈 "순서 지정 합치기" + 이미지 모듈 "이미지 복사"

---

## 기능 A — API 비용 모니터 패널

### 목적
개발자(소유자) 본인의 Anthropic·OpenAI **조직 API 지출**을 Supabase에 매일 적재하고,
MindCanvas 화면 위 오버레이 패널에서 "이번 달 사용액 / 예산 / 남은 금액 / 일별 막대"를 본다.
별도 캔버스·라우트가 아니라 헤더 💲 버튼으로 여는 패널.

### 핵심 제약 (확정 사항)
- API는 **지출액만** 제공한다. 실시간 잔액 조회 불가.
  → "남은 금액" = **사용자가 설정한 월 예산 − 이번 달 누적 지출**. 패널에서 예산 인라인 수정.
- Admin 키는 **서버 전용**. 절대 클라이언트/`NEXT_PUBLIC_`에 노출 금지.
- 지출 데이터는 민감 → 모든 조회/동기화 라우트는 **로그인 세션 필수(401)**.
- 차트는 **recharts 추가 없이** 경량 CSS/SVG 막대로 구현(의존성 0 추가).
- 색상/스타일은 CSS 변수만 사용. 시리즈 색은 `--cost-anthropic` / `--cost-openai` 를 globals.css에 추가.

### 데이터 계층 (Supabase)
`supabase/migrations/<ts>_api_cost_monitor.sql` (패키지 add-tables.sql 그대로):
- `daily_costs(provider, usage_date, line_item, amount_usd, raw, updated_at)` — unique(provider,usage_date,line_item)
- `budgets(provider PK, monthly_limit_usd, alert_threshold, updated_at)`
- `sync_log(id, ran_at, provider, status, detail)`
- 세 테이블 모두 RLS on, 정책 없음 → service_role로만 접근(RLS 우회). 메모 테이블과 충돌 없음.
- 뷰 `current_month_spend` 포함.

### 서버 로직
- `lib/supabase/admin.ts` — service_role 클라이언트 + `DailyCostRow` 타입. 기존 `SUPABASE_SERVICE_ROLE_KEY` 재사용.
- `lib/cost-anthropic.ts` / `lib/cost-openai.ts` — 패키지 fetcher 그대로(import 경로만 `@/lib/supabase/admin`).
- `lib/costSync.ts` (**공통화**) — `syncCosts(lookbackDays=5)`: 두 fetcher 실행 → `daily_costs` upsert → `sync_log` 기록 → results 맵 반환. cron과 수동 새로고침이 둘 다 호출.

### API 라우트
- `GET /api/costs` — 세션 확인(없으면 401). admin으로 최근 60일 `daily_costs` + `budgets` 조회.
  반환 `{ series: {date, anthropic, openai, total}[], mtd: {anthropic, openai}, budgets }`.
- `POST /api/costs/refresh` — 세션 확인 → `syncCosts()` → results 반환(패널 "새로고침" 버튼).
- `POST /api/costs/budget` — 세션 확인 → `budgets` upsert `{provider, monthly_limit_usd, alert_threshold}`.
- `GET /api/cron/sync` — `CRON_SECRET` 보호 → `syncCosts()`. `vercel.json` cron 일 1회.

### UI
- `components/costs/CostPanel.tsx` — 우측 슬라이드 오버레이(모바일은 풀폭 바텀시트 느낌). 열릴 때 `GET /api/costs` fetch.
  Claude/OpenAI 카드 각각: 이번 달 지출 · 예산 게이지 · 남은 금액(예산−지출) · 예산 인라인 편집(저장 시 `POST /api/costs/budget`) · 일별 막대.
  상단 "새로고침" 버튼(`POST /api/costs/refresh` → 재조회). 44px 터치 타겟, CSS 변수 테마.
- `components/costs/DailyBars.tsx` — 최근 60일 스택 막대(anthropic/openai). div/SVG 기반, `--cost-*` 색.

### 통합 (트리거 & 오버레이 스택)
- `components/layout/TopHeader.tsx` — 우측 클러스터에 💲 버튼(새 prop `onOpenCosts`).
- `app/page.tsx` — `showCostPanel` state, TopHeader에 `onOpenCosts` 전달, 데스크톱 헤더 행에도 동일 트리거,
  `<CostPanel>` 렌더, `overlayStateRef`/`handlePopState` 백버튼 스택에 편입(뒤로가기로 닫힘).
- `.env.local.example` — `ANTHROPIC_ADMIN_KEY`, `OPENAI_ADMIN_KEY`, `CRON_SECRET` 추가.
- `vercel.json` (신규) — `{ "crons": [{ "path": "/api/cron/sync", "schedule": "0 1 * * *" }] }`.

### 사용자 수동 사전작업 (코드로 불가)
1. Anthropic Console: Organization 설정 + `sk-ant-admin-…` 발급.
2. OpenAI: `sk-admin-…` 발급.
3. `.env.local` + Vercel 환경변수에 키 3개 입력(`CRON_SECRET`= `openssl rand -hex 16`).
4. 마이그레이션 SQL 실행 + (선택) `budgets` 초기값 insert.

---

## 기능 B — 순서 지정 합치기 + 이미지 복사

### 현황 (다시 확인 결과)
- 멀티 합치기는 **이미 존재**: 하단 `MultiSelectActionBar`의 `📝 노트로 합치기` → `handleMergeSelectedToNote`(Canvas.tsx).
  선택 모듈(메모·이미지)을 `selectedMultiIds` 배열 순서대로 HTML로 이어붙여 새 "합친 노트" 메모 생성, 원본 유지.
- 선택: 올가미 드래그 / Shift+클릭(클릭 순서로 append).
- 이미지 모듈: 다중 이미지 + Ctrl+V/`붙여넣기`(OS 클립보드 read) 지원. **"이미지 복사" 버튼은 없음.**

### B1. 합치기 버튼을 상단 + 순서 지정 모드 (확정)
흐름: **버튼 → 순서탭 → 실행 (사전 선택 불필요)**, 원본 유지 + 새 노트 생성.

Canvas.tsx 신규 state:
- `mergeOrderMode: boolean`
- `mergeOrderIds: string[]` (탭한 순서)

새 컴포넌트 `components/canvas/MergeOrderBar.tsx` — 캔버스 **상단 중앙** 플로팅.
- **Idle**: 보드에 메모/이미지 모듈이 2개 이상일 때 "📝 순서대로 합치기" 버튼 표시.
- 버튼 탭 → `mergeOrderMode=true`, `mergeOrderIds=[]`.
- **Ordering**: 안내 바("합칠 모듈을 순서대로 탭하세요 · N개 선택") + `합치기 실행`(≥2일 때 활성) + `취소`.
  - 모듈 탭 → 메모/이미지면 `mergeOrderIds`에 토글(다시 탭하면 제거+재번호). 그 외 타입은 무시.
  - 선택된 모듈에 번호 배지 ①②③ 오버레이.
  - `합치기 실행` → `mergeIdsToNote(mergeOrderIds)` → 모드 종료/초기화.
  - `취소` 또는 Esc → 모드 종료/초기화.

리팩터: `handleMergeSelectedToNote` 본문을 `mergeIdsToNote(orderedIds: string[])`로 추출.
`MultiSelectActionBar`에서 머지 버튼 제거(색상/삭제/해제만 유지) — 머지 진입점은 상단으로 일원화.

`ModuleCardWrapper.tsx`:
- 신규 prop `mergeOrderActive: boolean`, `mergeOrderIndex?: number`, `onMergeOrderPick?(id)`.
- `mergeOrderActive`면 카드 클릭이 일반 선택 대신 `onMergeOrderPick` 호출.
- `mergeOrderIndex`가 있으면 카드 좌상단에 번호 배지 표시.

### B2. 이미지 복사 (앱 내부 클립보드) (확정)
- `store/imageClipboard.ts` — `{ srcs: string[]; copy(srcs: string[]); clear() }` (zustand).
- `components/modules/ImageModuleHeaderCopy.tsx` — 이미지 모듈 **우측 상단** "이미지 복사" 버튼.
  탭 → `getImageSrcs(data)`를 `imageClipboard.copy()`. 토스트/flash "이미지 복사됨".
- 붙여넣기: 이미지 모듈 헤더에 클립보드가 비어있지 않을 때 "복사한 이미지 붙여넣기" 버튼 노출 →
  `appendImageSrcs(data, imageClipboard.srcs)`로 대상 모듈에 추가. (기존 OS 클립보드 `붙여넣기`는 그대로.)
- `ModuleCardWrapper`의 이미지 헤더 영역(기존 `ImageModuleHeaderPaste` 위치)에 두 버튼 배치.

---

## 파일 요약

신규:
- A: `lib/supabase/admin.ts`, `lib/cost-anthropic.ts`, `lib/cost-openai.ts`, `lib/costSync.ts`,
  `app/api/cron/sync/route.ts`, `app/api/costs/route.ts`, `app/api/costs/refresh/route.ts`, `app/api/costs/budget/route.ts`,
  `components/costs/CostPanel.tsx`, `components/costs/DailyBars.tsx`, `vercel.json`,
  `supabase/migrations/<ts>_api_cost_monitor.sql`
- B: `components/canvas/MergeOrderBar.tsx`, `store/imageClipboard.ts`, `components/modules/ImageModuleHeaderCopy.tsx`

수정:
- A: `app/page.tsx`, `components/layout/TopHeader.tsx`, `app/globals.css`(+`--cost-*`), `.env.local.example`
- B: `components/canvas/Canvas.tsx`, `components/canvas/MultiSelectActionBar.tsx`, `components/modules/ModuleCardWrapper.tsx`

## 검증
- `npx tsc --noEmit` 타입 오류 0개 (전역 규칙).
- A: `GET /api/costs` 비로그인 401 / 로그인 200. 키 미설정 시 refresh가 명확한 에러 메시지.
- B: 순서 배지 ①②③ 순서대로 노트 생성. 이미지 복사→붙여넣기 라운드트립.
