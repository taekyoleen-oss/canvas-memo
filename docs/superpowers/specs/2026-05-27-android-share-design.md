# Android 공유 (Web Share Target) 통합 — 디자인 스펙

- 작성일: 2026-05-27
- 대상 앱: MindCanvas (Next.js 15, App Router, Zustand, Supabase)
- 한 줄 요약: 안드로이드 공유 시트에서 메모·링크·이미지·파일을 MindCanvas로 보낼 수 있게 하고, 들어온 항목을 "받은 메모" 보드에 최신 위 순서로 쌓되, 카드 길게 누르기로 세 카테고리 어느 보드로든 옮길 수 있게 한다.

## 1. 목표와 비목표

### 목표
- 안드로이드 Chrome에서 PWA로 설치한 MindCanvas가 시스템 공유 시트에 노출된다.
- 텍스트·URL·이미지·파일을 공유로 받아 자동 분류하고 `isInbox=true` 보드 상단에 세로 타임라인으로 쌓는다.
- 사용자가 카드를 길게 눌러 메모/할일·생각정리·주제별 세 카테고리 어느 보드로든 이동할 수 있다.
- 비로그인 상태에서 공유가 오더라도 분실 없이 로그인 후 처리한다.

### 비목표
- iOS Safari Share Target 지원 (Web 표준 미지원, 향후 별도).
- Play Store TWA 패키징 (PWA 단계에서 끝).
- 다중 카드 일괄 이동, 드래그 앤 드롭 카테고리 이동.
- Supabase Storage 업로드 — 8MB 초과 파일은 거절. v2.0에서 별도 처리.

## 2. 사용 시나리오

1. 사용자가 안드로이드 Chrome에서 MindCanvas를 PWA로 홈에 추가한다.
2. 유튜브 영상의 공유 버튼 → 시트에서 "MindCanvas" 선택.
3. MindCanvas가 열리며 "받은 메모" 보드가 활성화되고 상단에 link 카드가 추가된다. 하단 토스트: `📥 1개 항목이 받은 메모로 들어왔어요`.
4. 사용자가 그 카드를 길게 누른다 → "보드로 이동" 시트가 열림 → "주제별 › 클로드" 선택 → 카드가 인박스에서 사라지고 클로드 보드 하단에 추가된다.

## 3. 아키텍처

```
[Android 공유 시트]
       │
       ▼
[PWA / Chrome]
  manifest.webmanifest
   └─ share_target: POST /share-target, multipart/form-data
       │
       ▼
[Service Worker (public/sw.js)]
  fetch('/share-target') 가로채기 → FormData 추출
   └─ IndexedDB('pendingShare') 에 PendingShareItem[] 누적
   └─ /share-target?ok=1 로 303 redirect
       │
       ▼
[Next.js 페이지: app/share-target/page.tsx]
  · 비로그인이면 /auth/login?next=/share-target?ok=1
  · 로그인 상태면:
      1) ensureInboxBoard(user.id)
      2) IndexedDB에서 큐 비우기
      3) lib/share/classifyShare.ts → ModuleInput[]
      4) store.addSharedModulesToInbox(inboxBoardId, prepared)
      5) router.replace(`/?board=<inboxId>&toast=share-ok&count=N`)
       │
       ▼
[메인 페이지 app/page.tsx]
  URL 쿼리 toast=share-ok 감지 → Toast 표시 + 쿼리 제거
```

핵심:
- POST share_target은 페이지로 직접 라우팅 안 됨. SW가 가로채 페이지로 변환해야 함.
- 큐 저장소는 IndexedDB. localStorage는 base64로 가득 차면 깨지며, SW·페이지 양쪽 접근 가능한 저장소는 IndexedDB가 유일.

## 4. 데이터 모델

### 4.1 신규 타입 (`types/index.ts`)

```ts
/** Web Share Target 으로 들어왔다가 아직 보드에 안 꽂힌 단건 */
export interface PendingShareItem {
  id: string;              // uuid
  kind: "text" | "url" | "image" | "file";
  text?: string;
  url?: string;
  title?: string;
  fileName?: string;
  fileType?: string;       // MIME
  fileSize?: number;       // bytes
  dataUrl?: string;        // base64 data URL — 8MB 미만일 때만
  rejectedReason?: "too_large" | "unsupported";
  receivedAt: string;      // ISO
}
```

기존 `Module` 모델을 그대로 사용한다 (memo/link/image/file). 신규 모듈 타입은 만들지 않는다.

### 4.2 분류 규칙 (`lib/share/classifyShare.ts`)

| 입력 | 변환 결과 |
|------|----------|
| `url` 채워짐 (또는 `text`가 URL 한 줄) | LinkData — `/api/og` 메타 보강 |
| `text`만 채워짐 (URL 아님) | MemoData — `title` = 첫 줄, `content` = 전체 |
| `files[i].type` = `image/*` | ImageData (`srcs:[dataUrl]`, `title=fileName`) |
| 그 외 파일 | FileData (`fileName`/`fileType`/`fileSize`/`src=dataUrl`) |
| `fileSize > 8 * 1024 * 1024` | 거절 (`rejectedReason="too_large"`) — 모듈 생성 안 함, 토스트 안내 |

YouTube 등 동영상 플랫폼은 자동으로 link 모듈이 된다. 추후 LinkPreview 카드에서 oEmbed 임베드 확장은 비목표.

### 4.3 신규 store 액션 (`store/canvas.ts`)

```ts
addSharedModulesToInbox(inboxBoardId: string, prepared: ModuleInput[]): string[]
```

동작:
1. `pushHistory()` 후 한 번의 set 호출.
2. 인박스 보드의 기존 모듈 `position.y`를 `prepared.length * (CARD_H + GAP)` 만큼 일괄 시프트(아래로 밀기).
3. 새 모듈을 `y = 72`부터 `GAP = 28` 간격, `x = 48`로 세로 정렬. 최신 = 맨 위.
4. `zIndex`는 기존 최대값 + 1 + i.
5. `debouncedSave()` + `markDirty(inboxBoardId)` 1회.

### 4.4 크로스카테고리 이동 허용

`moveModuleToBoard(sourceBoardId, targetBoardId, moduleId)` 의 카테고리 동일성 체크 제거. 대신 `isModuleTypeAllowedOnBoard(mod.type, targetBoard)` 만 검사. 호환되지 않는 보드는 UI(§5.4 이동 시트)에서 사전 비활성화.

그룹·연결선 정리 로직은 기존 그대로 유지. 인박스 모듈은 그룹/연결을 거의 갖지 않아 영향이 작다.

## 5. UI 컴포넌트

### 5.1 PWA 인스톨 안내 (`components/ui-overlays/PwaInstallHint.tsx`)
- 진입 시 `window.matchMedia('(display-mode: standalone)')`이 false이고 UA가 안드로이드 Chrome이면 우측 하단 칩 표시: "📲 홈에 추가하면 안드로이드 공유 메뉴에서 바로 보낼 수 있어요".
- localStorage `pwa_install_hint_dismissed=true` 로 영구 닫힘.

### 5.2 받은 메모 보드 헤더 칩 (`components/layout/TopHeader.tsx` 수정)
- 받은 메모 보드를 열었을 때 상단에 "📥 공유로 들어온 항목 · N개".
- 새 항목이 추가된 직후 1.5초간 스케일 펄스(1 → 1.05 → 1).

### 5.3 Toast (`components/ui-overlays/Toast.tsx`)
- 화면 하단 중앙 fixed, 3초 후 자동 사라짐.
- 메인 페이지에서 URL 쿼리 `toast=share-ok&count=N` 을 읽어 표시. 사용 후 `router.replace`로 쿼리 제거.

### 5.4 "보드로 이동" 시트 (`components/ui-overlays/MoveToBoardSheet.tsx`)

트리거: 기존 `hooks/useLongPress.ts` 재사용, 500ms.

구조:
```
보드로 이동                    ✕
현재: 📥 받은 메모
─────────────────────────
📋 메모/할일
  📥 받은 메모  (현재)
  📋 일상 메모
  📋 업무
💡 생각정리
  💡 아이디어  ── (이동 불가 — 회색)
📓 주제별
  📓 클로드
  📓 커서 AI
```

규칙:
- 각 행: 좌측 아이콘+이름, 우측 카테고리 칩.
- 이동 불가 보드는 회색·탭 비활성·작은 안내("이 카테고리는 메모/일정만 받아요").
- 현재 보드는 체크 표시, 탭하면 닫기만.
- 모바일 = 바텀시트(60vh), 데스크톱 = 가운데 다이얼로그 (같은 컴포넌트).
- 선택 시 `moveModuleToBoard` 호출. 성공 → 닫기 + 토스트, 실패 → 인라인 에러.

이동 가능 보드가 0개일 때는 "이동 가능한 보드가 없어요" + "새 보드 만들기" 버튼.

## 6. PWA / 서비스워커

### 6.1 `public/manifest.webmanifest`
```json
{
  "name": "MindCanvas",
  "short_name": "MindCanvas",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366F1",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "share_target": {
    "action": "/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text":  "text",
      "url":   "url",
      "files": [
        { "name": "files", "accept": ["image/*", "video/*", "audio/*", "application/pdf", "text/*", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"] }
      ]
    }
  }
}
```

### 6.2 `public/sw.js`
- `SW_VERSION = "share-target-v1"` 상수.
- `install` → `skipWaiting()`.
- `activate` → `clients.claim()`.
- `fetch` 이벤트에서 `request.method === 'POST'` 이고 `url.pathname === '/share-target'` 인 경우만 가로채기.
- `FormData` 에서 title/text/url 추출, `files` 는 `entry.getAll('files')` → `File[]`.
- 각 File을 `FileReader.readAsDataURL` 로 base64 변환 (8MB 초과는 dataUrl 없이 `rejectedReason='too_large'`).
- IndexedDB `mindcanvas-share` DB의 `pendingShare` 스토어에 `PendingShareItem` 들을 push.
- `Response.redirect('/share-target?ok=1', 303)` 반환.

### 6.3 `lib/share/pendingShareStore.ts`
- IndexedDB 헬퍼: `openDB()`, `pushItems(items)`, `drainAll(): PendingShareItem[]`, `clearAll()`.
- 페이지(`/share-target`)와 SW 양쪽에서 사용.

### 6.4 등록 컴포넌트 (`components/ui-overlays/ServiceWorkerRegister.tsx`)
- `app/layout.tsx`에 한 번 마운트.
- `if ('serviceWorker' in navigator)` 환경에서 `navigator.serviceWorker.register('/sw.js', { scope: '/' })`.
- 등록 실패는 콘솔 경고만 (앱 본 기능에 영향 없음).

### 6.5 정적 자산과 layout
- `public/sw.js` 와 `public/manifest.webmanifest`는 정적으로 그대로 서빙됨 (Next.js 기본 동작).
- 별도 헤더 설정 불요. `Service-Worker-Allowed`는 SW가 루트(`/sw.js`)에 있으므로 기본 scope 인정.
- `app/layout.tsx` 의 `<head>` 또는 Metadata의 `manifest` 필드로 `/manifest.webmanifest` 노출 — 둘 중 Next.js `Metadata.manifest` 사용.
- 아이콘 자산(`/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`)은 임시로 기존 `favicon.ico` 와 `folder-icon.png` 를 재가공해 생성. 최종 디자인은 후속 작업.

### 6.6 미들웨어 영향 (`middleware.ts`)
- POST `/share-target` 은 SW가 가로채므로 서버에 도달하지 않음.
- GET `/share-target?ok=1` 은 인증 필요. 미들웨어 기존 보호 정책으로 비로그인 → `/auth/login?next=/share-target?ok=1` 으로 자동 리다이렉트. 별도 화이트리스트 추가 불요.

## 7. 페이지

### 7.1 `app/share-target/page.tsx`
- 클라이언트 컴포넌트.
- 마운트 시 `processing=true` 가드, 다음 순서:
  1. `useAuthStore` 로딩 대기. 비로그인이면 `router.replace('/auth/login?next=/share-target?ok=1')`.
  2. `ensureInboxBoard(user.id)` 호출 → 실패 시 에러 토스트 후 `/`로 이동.
  3. `pendingShareStore.drainAll()` → `PendingShareItem[]`.
  4. 거절 항목(rejectedReason)을 따로 모아 토스트 메시지 합성.
  5. 나머지는 `classifyShare(items)` → `ModuleInput[]`. URL인 경우 `/api/og?url=` 병렬 fetch (`Promise.allSettled`).
  6. `useCanvasStore.addSharedModulesToInbox(inboxBoardId, prepared)`.
  7. `router.replace(\`/?board=\${inboxId}&toast=share-ok&count=\${prepared.length}\`)`.
- 본문은 단순 로딩 스피너 + "공유 항목을 정리 중이에요...".

### 7.2 `app/page.tsx` 변경
- 마운트 시 `searchParams` 확인 후 `board` 가 있으면 `setActiveBoard`, `toast=share-ok&count=N` 이면 Toast 표시 후 `router.replace('/', { scroll:false })` 로 쿼리 제거.

## 8. 에러·엣지 케이스

| 시나리오 | 처리 |
|---------|------|
| 비로그인 상태에서 공유 도착 | SW는 IndexedDB에 보관, 페이지는 `/auth/login?next=...` 리다이렉트. 로그인 후 share-target 페이지가 다시 열려 큐를 비움 |
| `ensureInboxBoard` 실패 | 큐 그대로 두고 `/` 이동 + 에러 토스트. 다음 진입 때 재시도 |
| POST 본문이 비었음 | 빈 큐 — 토스트 없이 받은 메모만 활성화 |
| 8MB 초과 파일 | 모듈 생성 안 함, 거절 토스트 "용량 초과로 일부 항목이 추가되지 않았어요 (8MB 제한)" |
| 한 이벤트에 이미지·URL·텍스트 혼재 | 각 개별 모듈로 분리, 한 트랜잭션에 상단 추가 |
| OG fetch 5s 타임아웃 | url만 가진 LinkData (기존 `/api/og` 가 빈 메타 fallback) |
| 연속 공유 race | IndexedDB 키는 `pendingShare:<uuid>` 분리, drainAll 은 커서로 전부 비움, 페이지 내 `processing` 플래그로 중복 처리 가드 |
| 캔버스 팬·드래그와 길게 누르기 충돌 | 기존 `useLongPress` 의 movement threshold (>10px 취소) 유지 |
| 호환 보드 0개 | "이동 가능한 보드가 없어요" + 만들기 CTA |
| iOS Safari | Share Target 미지원 — 진입 자체가 안 됨, 코드는 그대로 두면 자연 무시 |
| 백그라운드 공유 도착 | SW가 IndexedDB에 누적, 다음 포그라운드 진입 시 메인 페이지 init effect가 큐 확인 → 받은 메모로 이동·처리 |

## 9. Supabase·SQL 변경
- 없음. `boards.is_inbox`, `ensureInboxBoard()`, `modules` 테이블을 그대로 사용한다.

## 10. 작업 분할 (이후 plan 기준)

| 단계 | 영역 | 산출물 |
|------|------|--------|
| A | data-layer | PendingShareItem 타입, `lib/share/pendingShareStore.ts`, `lib/share/classifyShare.ts`, `addSharedModulesToInbox` 액션, moveModuleToBoard 크로스카테고리 허용 |
| B | PWA infra | `public/manifest.webmanifest`, `public/sw.js`, `components/ui-overlays/ServiceWorkerRegister.tsx`, `app/layout.tsx` Metadata.manifest 추가 + 컴포넌트 마운트, 임시 아이콘 3종 |
| C | 페이지 | `app/share-target/page.tsx`, `app/page.tsx` 의 URL 쿼리 처리 |
| D | ui-builder | `Toast.tsx`, `MoveToBoardSheet.tsx`, `PwaInstallHint.tsx`, TopHeader 인박스 칩 |
| E | canvas-engine | 카드 길게 누르기 핸들러 → 시트 오픈 연결 |
| F | 검증 | §11 체크리스트 |

## 11. 검증 체크리스트 (수동)

본 프로젝트에는 자동 테스트가 없으므로 수동 검증 항목으로 갈음한다.

- [ ] `classifyShare` 단위 시나리오 5종 (URL/Text/Image/PDF/9MB) — 임시 스크립트로 호출
- [ ] DevTools › Application › Manifest 에서 share_target 인식
- [ ] DevTools › Application › Service Workers 에서 `sw.js` Activated
- [ ] PWA 설치 후 안드로이드 공유 시트에 "MindCanvas" 노출
- [ ] URL 1건 공유 → 받은 메모 상단 link 카드 + 토스트
- [ ] 이미지 3장 공유 → 3 카드, 최신 위 순서, 1번 토스트 (count=3)
- [ ] PDF 공유 → file 카드
- [ ] 50MB 동영상 공유 → 카드 없음, 거절 토스트
- [ ] link 카드 길게 누르기 → 생각정리 카테고리 회색
- [ ] memo 카드 길게 누르기 → 세 카테고리 모두 활성, 이동 후 원본 사라짐·대상 도착
- [ ] 로그아웃 상태에서 공유 → 로그인 화면 → 로그인 후 자동으로 받은 메모 도착
- [ ] iOS Safari로 접근 시 앱 정상 동작 (공유 진입이 없을 뿐)
- [ ] 기존 Chrome 확장(`dt_scraps`) 흐름 회귀 없음

## 12. 후속 단계 (이번 PR 비포함)

- Supabase Storage 업로드를 통한 8MB 초과 파일 지원
- 다중 선택 + 일괄 이동
- LinkData 의 oEmbed 임베드 (YouTube 인-카드 재생)
- iOS용 별도 진입 (Bookmarklet 또는 향후 WebKit 표준 진행 시 share_target 도입)
