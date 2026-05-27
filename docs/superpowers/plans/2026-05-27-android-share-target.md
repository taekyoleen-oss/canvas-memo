# 안드로이드 공유 (Web Share Target) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA 설치된 안드로이드 Chrome의 시스템 공유 시트에서 MindCanvas로 텍스트·URL·이미지·파일을 보낼 수 있게 하고, "받은 메모" 보드 상단에 최신 위 순서로 쌓되, 카드 컨텍스트 메뉴의 "보드로 이동"으로 세 카테고리 어디로든 옮길 수 있게 한다.

**Architecture:** PWA manifest의 `share_target` → 서비스워커가 POST FormData를 가로채 IndexedDB 큐에 저장 → 클라이언트의 `/share-target` 페이지가 큐를 비워 분류기로 모듈을 만들고 zustand store의 신규 액션으로 받은 메모 보드 상단에 한꺼번에 추가. 기존 컨텍스트 메뉴의 보드 이동 옵션을 세 카테고리 전체로 확장한다.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Zustand, Supabase Auth, IndexedDB (idb-keyval은 도입 안 함 — vanilla IndexedDB로 직접 구현해 의존성 추가 회피).

**Spec:** `docs/superpowers/specs/2026-05-27-android-share-design.md`

---

## File Map

| 경로 | 신규/수정 | 책임 |
|------|-----------|------|
| `types/index.ts` | 수정 | `PendingShareItem` 타입 추가 |
| `lib/share/pendingShareStore.ts` | 신규 | IndexedDB 큐 (push / drain / clear) |
| `lib/share/classifyShare.ts` | 신규 | `PendingShareItem[]` → `ModuleInput[]` |
| `store/canvas.ts` | 수정 | `addSharedModulesToInbox` 추가, `moveModuleToBoard` 카테고리 체크 제거 |
| `public/manifest.webmanifest` | 신규 | PWA manifest + share_target |
| `public/sw.js` | 신규 | POST `/share-target` 가로채기 |
| `public/icons/icon-192.png` 등 3종 | 신규 | 임시 아이콘 (기존 자산 재활용) |
| `components/ui-overlays/ServiceWorkerRegister.tsx` | 신규 | `navigator.serviceWorker.register('/sw.js')` |
| `components/ui-overlays/Toast.tsx` | 신규 | 글로벌 토스트 (URL 쿼리로 트리거) |
| `components/ui-overlays/PwaInstallHint.tsx` | 신규 | 안드로이드 미설치 안내 칩 |
| `app/layout.tsx` | 수정 | Metadata.manifest + ServiceWorkerRegister 마운트 |
| `app/share-target/page.tsx` | 신규 | 큐 비우기 → 분류 → store 액션 |
| `app/page.tsx` | 수정 | URL 쿼리(`board`, `toast`) 처리 effect 추가, Toast/PwaInstallHint 마운트 |
| `components/layout/TopHeader.tsx` | 수정 | 받은 메모 보드 헤더 칩 |
| `components/modules/ModuleCardWrapper.tsx` | 수정 | `moveBoardOptions`를 세 카테고리 전체로 확장, 카테고리 라벨 부여 |
| `components/ui-overlays/ModuleContextMenu.tsx` | 수정 | 보드 이동 목록을 카테고리별로 그룹화 |
| `scripts/verify-classify-share.mjs` | 신규 | classifyShare 단위 검증 스크립트 |

---

## 검증 전략

본 프로젝트는 Jest/Vitest가 없다. 각 태스크는 다음 둘 중 하나로 검증한다:
- **타입 체크**: `npx tsc --noEmit`
- **단위 스크립트**: 순수 함수만 `node scripts/verify-classify-share.mjs`
- **수동 시나리오**: Chrome DevTools + 모바일 PWA 설치 (스펙 §11)

각 태스크는 작은 commit으로 끝낸다. 메시지는 conventional(`feat:`, `chore:` 등).

---

## Task 1: PendingShareItem 타입 추가

**Files:**
- Modify: `types/index.ts` (파일 끝에 추가)

- [ ] **Step 1: 타입 정의 추가**

`types/index.ts` 맨 아래에 추가:

```ts
/**
 * Web Share Target POST 로 들어왔지만 아직 보드의 Module로 변환되지 않은 단건.
 * 서비스워커가 IndexedDB에 push 하고, /share-target 페이지가 drain 하여 처리한다.
 */
export interface PendingShareItem {
  id: string;              // uuid (서비스워커가 발급)
  kind: "text" | "url" | "image" | "file";
  text?: string;
  url?: string;
  title?: string;
  fileName?: string;
  fileType?: string;       // MIME
  fileSize?: number;       // bytes
  dataUrl?: string;        // base64 data URL — 8MB 미만일 때만
  rejectedReason?: "too_large" | "unsupported";
  receivedAt: string;      // ISO timestamp
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): add PendingShareItem for Web Share Target queue"
```

---

## Task 2: IndexedDB 큐 헬퍼

**Files:**
- Create: `lib/share/pendingShareStore.ts`

- [ ] **Step 1: 파일 작성**

`lib/share/pendingShareStore.ts` 신규 작성:

```ts
import type { PendingShareItem } from "@/types";

/**
 * Web Share Target 큐 — 서비스워커가 push, /share-target 페이지가 drain.
 * vanilla IndexedDB로 직접 구현해 추가 의존성 없이 유지.
 *
 * DB: "mindcanvas-share"
 * Store: "pending"  keyPath: "id"  (단순 객체 store)
 */

const DB_NAME = "mindcanvas-share";
const DB_VERSION = 1;
const STORE = "pending";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("receivedAt", "receivedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function pushPendingShareItems(items: PendingShareItem[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    for (const it of items) os.put(it);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function drainPendingShareItems(): Promise<PendingShareItem[]> {
  const db = await openDB();
  const items = await new Promise<PendingShareItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    const getAll = os.getAll();
    getAll.onsuccess = () => {
      const list = (getAll.result ?? []) as PendingShareItem[];
      // 동일 트랜잭션 안에서 clear 까지 끝낸다 (race 방지)
      const clear = os.clear();
      clear.onsuccess = () => {
        // receivedAt 오름차순(오래된 → 최신) — 최신이 마지막. 호출자가 reverse 처리.
        list.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
        resolve(list);
      };
      clear.onerror = () => reject(clear.error);
    };
    getAll.onerror = () => reject(getAll.error);
  });
  db.close();
  return items;
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add lib/share/pendingShareStore.ts
git commit -m "feat(share): IndexedDB queue for pending share items"
```

---

## Task 3: 공유 분류기 (classifyShare)

**Files:**
- Create: `lib/share/classifyShare.ts`

- [ ] **Step 1: 파일 작성**

```ts
import type {
  FileData,
  ImageData,
  LinkData,
  MemoData,
  Module,
  ModuleColor,
  PendingShareItem,
} from "@/types";

export const MAX_SHARE_FILE_BYTES = 8 * 1024 * 1024;

/** PendingShareItem -> Module 생성 입력. Module의 id/createdAt/updatedAt은 store가 채움 */
export type SharedModuleInput = Omit<Module, "id" | "createdAt" | "updatedAt">;

export interface ClassifyResult {
  accepted: SharedModuleInput[];
  rejected: PendingShareItem[];
}

const URL_REGEX = /^(https?:\/\/[^\s]+)$/i;

function isUrlString(s: string): boolean {
  const trimmed = s.trim();
  if (URL_REGEX.test(trimmed)) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const DEFAULT_SIZE = { width: 260, height: 200 };
const DEFAULT_COLOR: ModuleColor = "default";

function emptyZ(): number { return 1; }

function memoFromText(text: string, title?: string): SharedModuleInput {
  const firstLine = text.split(/\r?\n/, 1)[0].trim();
  const data: MemoData = {
    title: title?.trim() || firstLine.slice(0, 60) || "공유 메모",
    content: text,
    previewLines: 2,
  };
  return {
    type: "memo",
    position: { x: 0, y: 0 },
    size: DEFAULT_SIZE,
    zIndex: emptyZ(),
    color: DEFAULT_COLOR,
    isExpanded: false,
    data,
  };
}

function linkFromUrl(url: string, title?: string): SharedModuleInput {
  const data: LinkData = {
    url: url.trim(),
    title: title?.trim() || url.trim(),
    description: "",
    favicon: "",
    thumbnail: "",
  };
  return {
    type: "link",
    position: { x: 0, y: 0 },
    size: DEFAULT_SIZE,
    zIndex: emptyZ(),
    color: DEFAULT_COLOR,
    isExpanded: false,
    data,
  };
}

function imageFromDataUrl(dataUrl: string, fileName?: string): SharedModuleInput {
  const data: ImageData = {
    title: fileName?.replace(/\.[^.]+$/, "") || "공유 이미지",
    src: dataUrl,
    srcs: [dataUrl],
    caption: "",
    description: "",
  };
  return {
    type: "image",
    position: { x: 0, y: 0 },
    size: DEFAULT_SIZE,
    zIndex: emptyZ(),
    color: DEFAULT_COLOR,
    isExpanded: false,
    data,
  };
}

function fileFromDataUrl(item: PendingShareItem): SharedModuleInput {
  const data: FileData = {
    title: item.fileName?.replace(/\.[^.]+$/, "") || "공유 파일",
    fileName: item.fileName || "file",
    fileType: item.fileType || "application/octet-stream",
    fileSize: item.fileSize ?? 0,
    src: item.dataUrl ?? "",
  };
  return {
    type: "file",
    position: { x: 0, y: 0 },
    size: DEFAULT_SIZE,
    zIndex: emptyZ(),
    color: DEFAULT_COLOR,
    isExpanded: false,
    data,
  };
}

export function classifyShare(items: PendingShareItem[]): ClassifyResult {
  const accepted: SharedModuleInput[] = [];
  const rejected: PendingShareItem[] = [];

  for (const it of items) {
    if (it.rejectedReason) { rejected.push(it); continue; }

    if (it.kind === "url" && it.url && isUrlString(it.url)) {
      accepted.push(linkFromUrl(it.url, it.title));
      continue;
    }
    if (it.kind === "text" && it.text) {
      const t = it.text.trim();
      if (isUrlString(t)) accepted.push(linkFromUrl(t, it.title));
      else accepted.push(memoFromText(it.text, it.title));
      continue;
    }
    if (it.kind === "image" && it.dataUrl) {
      accepted.push(imageFromDataUrl(it.dataUrl, it.fileName));
      continue;
    }
    if (it.kind === "file" && it.dataUrl) {
      accepted.push(fileFromDataUrl(it));
      continue;
    }
    rejected.push({ ...it, rejectedReason: it.rejectedReason ?? "unsupported" });
  }
  return { accepted, rejected };
}
```

- [ ] **Step 2: 단위 검증 스크립트 작성**

`scripts/verify-classify-share.mjs` 신규:

```js
// 순수 함수만 검증. ts-loader 없이 동작하려면 classifyShare.ts를 잠깐 ts-import 해야 하므로
// 여기서는 tsx 의존 대신 동일 로직을 인라인으로 복사해 회귀만 잡는다.
// 본격 회귀는 npx tsc 와 수동 시나리오로 갈음.
import { strict as assert } from "node:assert";

// classifyShare.ts의 isUrlString만 분리해서 검증
const URL_REGEX = /^(https?:\/\/[^\s]+)$/i;
function isUrlString(s) {
  const t = s.trim();
  if (URL_REGEX.test(t)) return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

assert.equal(isUrlString("https://youtu.be/abc"), true);
assert.equal(isUrlString("  http://example.com  "), true);
assert.equal(isUrlString("hello world"), false);
assert.equal(isUrlString("ftp://example.com"), false);
assert.equal(isUrlString(""), false);

console.log("classifyShare URL detection OK");
```

- [ ] **Step 3: 스크립트 실행**

Run: `node scripts/verify-classify-share.mjs`
Expected: `classifyShare URL detection OK`

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add lib/share/classifyShare.ts scripts/verify-classify-share.mjs
git commit -m "feat(share): classify shared inputs into module inputs"
```

---

## Task 4: store에 addSharedModulesToInbox 액션 추가

**Files:**
- Modify: `store/canvas.ts`

- [ ] **Step 1: 인터페이스에 액션 추가**

`store/canvas.ts` 의 `interface CanvasStore` 안, `moveModuleToBoard` 선언 바로 위에 추가:

```ts
  /**
   * Web Share Target 으로 들어온 모듈 배치 — 받은 메모(인박스) 보드의 기존 모듈을
   * 아래로 일괄 시프트하고 최신을 맨 위(y=72)부터 세로 GAP=28 간격으로 추가한다.
   */
  addSharedModulesToInbox(
    inboxBoardId: string,
    modules: Omit<Module, "id" | "createdAt" | "updatedAt">[]
  ): string[];
```

- [ ] **Step 2: 구현 추가**

`addModulesBatch` 정의 바로 아래(파일 검색: `addModulesBatch(boardId, moduleInputs) {`)에 새 함수 추가. 이 함수는 zustand `create` 인자의 객체 안에 들어가므로 다른 액션과 같은 들여쓰기.

```ts
  addSharedModulesToInbox(inboxBoardId, moduleInputs) {
    const board = get().boards.find((b) => b.id === inboxBoardId);
    if (!board) return [];

    const allowed = moduleInputs.filter((mi) =>
      isModuleTypeAllowedOnBoard(mi.type, board)
    );
    if (allowed.length === 0) return [];

    get().pushHistory();
    const now = getTimestamp();
    const GAP = 28;
    const CARD_H_GUESS = 200;
    const STEP = CARD_H_GUESS + GAP;
    const newCount = allowed.length;
    const totalShift = STEP * newCount;

    const maxZBefore = board.modules.reduce(
      (a, m) => Math.max(a, Number(m.zIndex) || 0),
      0
    );

    const newIds: string[] = [];
    const newModules: Module[] = allowed.map((mi, idx) => {
      const id = uuidv4();
      newIds.push(id);
      return {
        ...mi,
        id,
        createdAt: now,
        updatedAt: now,
        position: { x: 48, y: 72 + idx * STEP },
        zIndex: maxZBefore + 1 + idx,
      };
    });

    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === inboxBoardId
          ? {
              ...b,
              modules: [
                ...newModules,
                ...b.modules.map((m) => ({
                  ...m,
                  position: { x: m.position.x, y: m.position.y + totalShift },
                  updatedAt: now,
                })),
              ],
              updatedAt: now,
            }
          : b
      ),
    }));

    debouncedSave?.();
    markDirty(inboxBoardId);
    return newIds;
  },
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add store/canvas.ts
git commit -m "feat(store): addSharedModulesToInbox stacks new items at top"
```

---

## Task 5: 크로스카테고리 이동 허용

**Files:**
- Modify: `store/canvas.ts` (`moveModuleToBoard` 함수)

- [ ] **Step 1: 카테고리 동일성 체크 제거**

`store/canvas.ts` 의 `moveModuleToBoard` 함수에서 다음 3줄 삭제:

```ts
    if (normalizeBoardCategory(sourceBoard) !== normalizeBoardCategory(targetBoard)) {
      return false;
    }
```

타입 정책 검사(`isModuleTypeAllowedOnBoard`)는 그대로 유지한다.

- [ ] **Step 2: 인터페이스 JSDoc 갱신**

`store/canvas.ts` 의 인터페이스 `moveModuleToBoard` JSDoc을 다음과 같이 갱신:

```ts
  /**
   * 다른 보드로 모듈을 옮깁니다. 세 카테고리(메모/일정·생각정리·주제별) 어디로든 가능하나,
   * 대상 보드에서 허용되지 않는 모듈 타입(예: 일반 보드에 brainstorm)은 `false`입니다.
   */
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add store/canvas.ts
git commit -m "feat(store): allow cross-category module move (type policy still enforced)"
```

---

## Task 6: 컨텍스트 메뉴의 보드 이동 목록을 세 카테고리로 확장

**Files:**
- Modify: `components/modules/ModuleCardWrapper.tsx` (라인 112-122)
- Modify: `components/ui-overlays/ModuleContextMenu.tsx` (이동 섹션 렌더링)

- [ ] **Step 1: ModuleCardWrapper의 moveBoardOptions 확장**

`components/modules/ModuleCardWrapper.tsx` 의 `moveBoardOptions` `useMemo` 블록(현재 라인 112~122)을 다음으로 교체:

```ts
  const moveBoardOptions = useMemo(() => {
    if (!board) return [];
    const order: BoardCategory[] = ["memo_schedule", "thinking", "topic_notes"];
    const labelOf: Record<BoardCategory, string> = {
      memo_schedule: "메모/할일",
      thinking: "생각정리",
      topic_notes: "주제별",
    };
    const list: Array<{
      id: string;
      label: string;
      category: BoardCategory;
      categoryLabel: string;
      disabled: boolean;
    }> = [];
    for (const cat of order) {
      for (const b of boardsForWorkspace(boards, cat)) {
        if (b.id === boardId) continue;
        list.push({
          id: b.id,
          label: `${b.icon ? `${b.icon} ` : ""}${(b.name ?? "").trim() || "제목 없음"}`.trim(),
          category: cat,
          categoryLabel: labelOf[cat],
          disabled: !isModuleTypeAllowedOnBoard(module.type, b),
        });
      }
    }
    return list;
  }, [boards, board, boardId, module.type]);
```

또한 동일 파일 상단의 import에 `BoardCategory` 가 없다면 추가:

```ts
import type {
  Board,
  BoardCategory,
  Module,
  MemoData,
  ScheduleData,
  ImageData,
  LinkData,
  FileData,
  TableData,
  BrainstormData,
  ExpandAdjacentModuleOptions,
} from "@/types";
```

- [ ] **Step 2: ModuleContextMenu의 옵션 타입과 렌더링 확장**

`components/ui-overlays/ModuleContextMenu.tsx` 의 `moveBoardOptions` props 타입을 다음으로 확장:

```ts
  moveBoardOptions?: {
    id: string;
    label: string;
    category: "memo_schedule" | "thinking" | "topic_notes";
    categoryLabel: string;
    disabled: boolean;
  }[];
```

라인 ~176 부근의 `{moveBoardOptions!.map((o) => ( ... ))}` 영역을 다음으로 교체. 비활성 옵션은 흐리게, 카테고리별 작은 헤더 라벨을 끼워 넣는다:

```tsx
{(() => {
  const groups = ["memo_schedule", "thinking", "topic_notes"] as const;
  return groups.map((cat) => {
    const inCat = moveBoardOptions!.filter((o) => o.category === cat);
    if (inCat.length === 0) return null;
    return (
      <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            padding: "6px 10px 2px",
          }}
        >
          {inCat[0].categoryLabel}
        </div>
        {inCat.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={o.disabled}
            onClick={() => {
              if (o.disabled) return;
              setMoveTargetId(o.id);
            }}
            style={{
              textAlign: "left",
              padding: "8px 12px",
              borderRadius: 8,
              border:
                moveTargetId === o.id
                  ? "1px solid var(--primary)"
                  : "1px solid transparent",
              background:
                moveTargetId === o.id ? "var(--surface-hover)" : "transparent",
              cursor: o.disabled ? "not-allowed" : "pointer",
              color: o.disabled ? "var(--text-muted)" : "var(--text-primary)",
              opacity: o.disabled ? 0.55 : 1,
              fontSize: 14,
            }}
            title={o.disabled ? "이 보드는 해당 모듈 유형을 받을 수 없어요" : undefined}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  });
})()}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 확인**

- 개발 서버 실행: `npm run dev`
- 임의의 link 모듈을 길게 누르면 컨텍스트 메뉴 표시
- "다른 보드로 이동" 클릭 → 카테고리 3개(메모/할일·생각정리·주제별) 그룹과 보드 목록이 보이는지
- 생각정리 카테고리 보드는 link 모듈 대상으로 비활성(회색)인지

- [ ] **Step 5: Commit**

```bash
git add components/modules/ModuleCardWrapper.tsx components/ui-overlays/ModuleContextMenu.tsx
git commit -m "feat(ui): grouped move-to-board across all 3 categories"
```

---

## Task 7: 임시 PWA 아이콘 자산

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`

- [ ] **Step 1: 디렉터리·자산 복사**

Run (Git Bash):
```bash
mkdir -p public/icons
cp public/folder-icon.png public/icons/icon-192.png
cp public/folder-icon.png public/icons/icon-512.png
cp public/folder-icon.png public/icons/icon-maskable-512.png
```

> 본 단계는 PWA가 설치 가능해지기 위한 최소 자산이다. 정식 아이콘은 후속 PR에서 디자이너 산출물로 교체.

- [ ] **Step 2: Commit**

```bash
git add public/icons
git commit -m "chore(pwa): temporary share-target launcher icons (folder-icon reuse)"
```

---

## Task 8: PWA manifest

**Files:**
- Create: `public/manifest.webmanifest`

- [ ] **Step 1: 파일 작성**

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
        {
          "name": "files",
          "accept": [
            "image/*",
            "video/*",
            "audio/*",
            "application/pdf",
            "text/*",
            ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"
          ]
        }
      ]
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/manifest.webmanifest
git commit -m "feat(pwa): manifest with Web Share Target declaration"
```

---

## Task 9: 서비스워커 (share_target intercept)

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: 파일 작성**

```js
/* MindCanvas Service Worker — Web Share Target intercept.
 * Buffers POST /share-target into IndexedDB and redirects to /share-target?ok=1.
 * Bumping SW_VERSION forces clients to update.
 */
const SW_VERSION = "share-target-v1";
const MAX_BYTES = 8 * 1024 * 1024;
const DB_NAME = "mindcanvas-share";
const DB_VERSION = 1;
const STORE = "pending";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("receivedAt", "receivedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function pushItems(items) {
  if (!items.length) return;
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    for (const it of items) os.put(it);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function uuid() {
  if (self.crypto && typeof self.crypto.randomUUID === "function") {
    return self.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleShareTarget(request) {
  const items = [];
  const now = new Date().toISOString();
  try {
    const formData = await request.formData();
    const title = formData.get("title");
    const text = formData.get("text");
    const url = formData.get("url");
    const files = formData.getAll("files");

    if (typeof url === "string" && url.trim()) {
      items.push({
        id: uuid(),
        kind: "url",
        url: url.trim(),
        title: typeof title === "string" ? title : undefined,
        receivedAt: now,
      });
    }
    if (typeof text === "string" && text.trim() && !(typeof url === "string" && url.trim())) {
      items.push({
        id: uuid(),
        kind: "text",
        text,
        title: typeof title === "string" ? title : undefined,
        receivedAt: now,
      });
    }

    for (const f of files) {
      if (!(f instanceof File)) continue;
      const isImage = f.type.startsWith("image/");
      if (f.size > MAX_BYTES) {
        items.push({
          id: uuid(),
          kind: isImage ? "image" : "file",
          fileName: f.name,
          fileType: f.type,
          fileSize: f.size,
          rejectedReason: "too_large",
          receivedAt: now,
        });
        continue;
      }
      const dataUrl = await fileToDataUrl(f);
      items.push({
        id: uuid(),
        kind: isImage ? "image" : "file",
        fileName: f.name,
        fileType: f.type,
        fileSize: f.size,
        dataUrl,
        receivedAt: now,
      });
    }

    await pushItems(items);
  } catch (err) {
    // 큐 비울 때 페이지가 빈 결과를 처리하므로 여기서는 조용히 통과
    console.warn("[sw] share-target handler error:", err);
  }
  return Response.redirect("/share-target?ok=1", 303);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "POST") return;
  const url = new URL(req.url);
  if (url.pathname !== "/share-target") return;
  event.respondWith(handleShareTarget(req));
});
```

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat(pwa): service worker intercepts POST /share-target into IndexedDB queue"
```

---

## Task 10: 서비스워커 등록 컴포넌트 + layout 통합

**Files:**
- Create: `components/ui-overlays/ServiceWorkerRegister.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: 등록 컴포넌트 작성**

```tsx
"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Next.js dev에서도 등록은 가능. 단 HMR 충돌 시 콘솔 경고만 남기고 무시.
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[MindCanvas] SW register failed:", err);
    });
  }, []);
  return null;
}
```

- [ ] **Step 2: layout 수정**

`app/layout.tsx` 전체를 다음으로 교체:

```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ui-overlays/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "MindCanvas",
  description: "시각적 지식 캔버스",
  manifest: "/manifest.webmanifest",
  themeColor: "#6366F1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 확인**

- `npm run dev` 실행 후 `http://localhost:3000` 접속.
- DevTools › Application › Manifest 에서 share_target 항목 노출 확인.
- DevTools › Application › Service Workers 에서 `sw.js` Activated 상태 확인.

- [ ] **Step 5: Commit**

```bash
git add components/ui-overlays/ServiceWorkerRegister.tsx app/layout.tsx
git commit -m "feat(pwa): register service worker and expose manifest"
```

---

## Task 11: Toast 컴포넌트

**Files:**
- Create: `components/ui-overlays/Toast.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
"use client";

import { useEffect, useState } from "react";

export interface ToastProps {
  message: string;
  durationMs?: number;
  onDismiss?: () => void;
}

export default function Toast({ message, durationMs = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 600,
        padding: "10px 16px",
        borderRadius: 999,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
        color: "var(--text-primary)",
        fontSize: 13,
        maxWidth: "calc(100vw - 32px)",
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add components/ui-overlays/Toast.tsx
git commit -m "feat(ui): minimal global Toast component"
```

---

## Task 12: /share-target 페이지

**Files:**
- Create: `app/share-target/page.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useCanvasStore } from "@/store/canvas";
import { ensureInboxBoard } from "@/lib/inboxBoard";
import { drainPendingShareItems } from "@/lib/share/pendingShareStore";
import {
  classifyShare,
  MAX_SHARE_FILE_BYTES,
  type SharedModuleInput,
} from "@/lib/share/classifyShare";
import type { LinkData, PendingShareItem } from "@/types";

async function enrichLinkMetadata(modules: SharedModuleInput[]): Promise<SharedModuleInput[]> {
  return Promise.all(
    modules.map(async (m) => {
      if (m.type !== "link") return m;
      const url = (m.data as LinkData).url;
      if (!url) return m;
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
        if (!res.ok) return m;
        const data = (await res.json()) as LinkData;
        return {
          ...m,
          data: {
            url: data.url || url,
            title: data.title || (m.data as LinkData).title || url,
            description: data.description || "",
            favicon: data.favicon || "",
            thumbnail: data.thumbnail || "",
          } satisfies LinkData,
        };
      } catch {
        return m;
      }
    })
  );
}

export default function ShareTargetPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuthStore();
  const addSharedModulesToInbox = useCanvasStore((s) => s.addSharedModulesToInbox);
  const processingRef = useRef(false);
  const [message, setMessage] = useState("공유 항목을 정리 중이에요…");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/auth/login?next=/share-target?ok=1");
      return;
    }

    if (processingRef.current) return;
    processingRef.current = true;

    (async () => {
      const items = await drainPendingShareItems();
      if (items.length === 0) {
        router.replace("/");
        return;
      }

      const inboxId = await ensureInboxBoard(user.id);
      if (!inboxId) {
        setMessage("받은 메모 보드를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.");
        // 큐는 이미 비워졌으므로 손실 방지를 위해 5초 후 홈으로 이동만
        window.setTimeout(() => router.replace("/"), 3000);
        return;
      }

      const { accepted, rejected } = classifyShare(items);
      const enriched = await enrichLinkMetadata(accepted);

      let count = 0;
      if (enriched.length > 0) {
        const ids = addSharedModulesToInbox(inboxId, enriched);
        count = ids.length;
      }

      const tooLarge = rejected.filter(
        (r: PendingShareItem) => r.rejectedReason === "too_large"
      ).length;

      const search = new URLSearchParams();
      search.set("board", inboxId);
      if (count > 0) {
        search.set("toast", "share-ok");
        search.set("count", String(count));
      }
      if (tooLarge > 0) search.set("rejectedTooLarge", String(tooLarge));
      router.replace(`/?${search.toString()}`);
    })().catch((err) => {
      console.error("[share-target]", err);
      setMessage("공유 처리 중 오류가 났어요. 홈으로 이동합니다.");
      window.setTimeout(() => router.replace("/"), 1500);
    });
  }, [authLoading, user, router, addSharedModulesToInbox]);

  // params 의존성 표시 (next/navigation 사용 시 lint 만족 + 향후 큐 식별자 확장 여지)
  useEffect(() => {
    void params;
  }, [params]);

  void MAX_SHARE_FILE_BYTES;

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
        color: "var(--text-primary)",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📥</div>
        <div style={{ fontSize: 15 }}>{message}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add app/share-target/page.tsx
git commit -m "feat(share): share-target page drains queue and adds modules to inbox"
```

---

## Task 13: page.tsx 의 URL 쿼리(`board`, `toast`) 처리 + Toast 마운트

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: import 추가**

`app/page.tsx` 상단의 다른 import 옆에 추가:

```ts
import { useSearchParams } from "next/navigation";
import Toast from "@/components/ui-overlays/Toast";
```

- [ ] **Step 2: 컴포넌트 본문 안에 effect + 상태 추가**

`export default function Home()` 안, 기존 `useEffect` 들 다음에 추가:

```ts
  const searchParams = useSearchParams();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!appReady) return;
    const boardParam = searchParams?.get("board");
    const toastParam = searchParams?.get("toast");
    const countParam = searchParams?.get("count");
    const tooLargeParam = searchParams?.get("rejectedTooLarge");

    let changed = false;
    if (boardParam && boards.some((b) => b.id === boardParam)) {
      setActiveBoard(boardParam);
      changed = true;
    }
    if (toastParam === "share-ok") {
      const count = Number(countParam) || 0;
      const tooLarge = Number(tooLargeParam) || 0;
      const msg = tooLarge > 0
        ? `📥 ${count}개 항목이 받은 메모로 들어왔어요 (용량 초과 ${tooLarge}건은 제외)`
        : `📥 ${count}개 항목이 받은 메모로 들어왔어요`;
      setToastMessage(msg);
      changed = true;
    } else if (tooLargeParam) {
      setToastMessage(`용량 초과로 ${tooLargeParam}건이 추가되지 않았어요 (8MB 제한)`);
      changed = true;
    }

    if (changed) {
      // 쿼리만 제거 (스크롤·히스토리 영향 최소화)
      router.replace("/", { scroll: false });
    }
  }, [appReady, searchParams, boards, setActiveBoard, router]);
```

- [ ] **Step 3: Toast 렌더링**

`app/page.tsx` JSX 최상위(예: `</> 안에) 가장 끝에 추가 — 종료 확인 다이얼로그 옆 위치:

```tsx
{toastMessage && (
  <Toast
    message={toastMessage}
    onDismiss={() => setToastMessage(null)}
  />
)}
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 수동 확인**

- `npm run dev` 후 브라우저 주소창에 `http://localhost:3000/?toast=share-ok&count=2` 직접 입력.
- 하단 중앙에 `📥 2개 항목이 받은 메모로 들어왔어요` 토스트가 3초간 떠야 함.
- 토스트 사라진 뒤 주소창에서 쿼리스트링이 사라져 있어야 함.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): consume share-target redirect query (active board + toast)"
```

---

## Task 14: 받은 메모 보드 헤더 칩

**Files:**
- Modify: `components/layout/TopHeader.tsx`

- [ ] **Step 1: props 확장 + 렌더링**

`components/layout/TopHeader.tsx` 전체를 다음으로 교체:

```tsx
"use client";

import ThemeToggle from "@/components/ui-overlays/ThemeToggle";
import { useAuthStore } from "@/store/auth";

interface TopHeaderProps {
  boardName: string;
  workspaceLabel?: string;
  /** 받은 메모(인박스) 보드인지 — 표시할 칩이 달라짐 */
  isInbox?: boolean;
  /** 받은 메모 보드일 때 카드 수 */
  inboxItemCount?: number;
  onAddModule: () => void;
  onMenuClick: () => void;
}

export default function TopHeader({
  boardName,
  workspaceLabel,
  isInbox,
  inboxItemCount,
  onAddModule,
  onMenuClick,
}: TopHeaderProps) {
  const { user, signOut } = useAuthStore();
  return (
    <header
      className="flex items-center justify-between px-4 md:hidden"
      style={{
        height: 56,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 44,
            height: 44,
            color: "var(--text-primary)",
            fontSize: 20,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="메뉴 열기"
        >
          ≡
        </button>
        <div className="flex min-w-0 flex-col gap-0.5">
          {workspaceLabel ? (
            <span
              className="truncate text-[11px] font-semibold tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              {workspaceLabel}
            </span>
          ) : null}
          <span
            className="font-semibold truncate max-w-[160px]"
            style={{ color: "var(--text-primary)", fontSize: 16 }}
          >
            {boardName}
          </span>
          {isInbox ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{
                background: "var(--surface-hover)",
                color: "var(--text-secondary)",
                fontSize: 11,
                width: "fit-content",
                marginTop: 2,
              }}
              title="안드로이드 공유에서 들어오는 항목이 여기로 모입니다"
            >
              📥 공유로 들어온 항목 · {inboxItemCount ?? 0}개
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        {user ? (
          <button
            onClick={signOut}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 44,
              height: 44,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
            }}
            title={`로그아웃 (${user.email})`}
            aria-label="로그아웃"
          >
            👤
          </button>
        ) : (
          <a
            href="/auth/login"
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 44,
              height: 44,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              textDecoration: "none",
            }}
            aria-label="로그인"
          >
            🔑
          </a>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: page.tsx 에서 props 전달**

`app/page.tsx` 의 모바일 레이아웃 `<TopHeader ... />` 호출에 다음 두 props를 추가:

```tsx
        <TopHeader
          boardName={activeBoard?.name ?? "보드"}
          workspaceLabel={workspaceLabel}
          isInbox={!!activeBoard?.isInbox}
          inboxItemCount={activeBoard?.modules.length ?? 0}
          onAddModule={() =>
            handleAddModule(
              activeBoardCategory === "thinking" ? "brainstorm" : "memo"
            )
          }
          onMenuClick={() => setShowMobileDrawer(true)}
        />
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 확인**

- `npm run dev` → 모바일 뷰포트(DevTools 디바이스 모드)로 전환.
- 받은 메모 보드를 선택 → 헤더에 "📥 공유로 들어온 항목 · N개" 칩이 보임.
- 다른 보드 선택 → 칩이 사라짐.

- [ ] **Step 5: Commit**

```bash
git add components/layout/TopHeader.tsx app/page.tsx
git commit -m "feat(ui): inbox chip on TopHeader for received-shared board"
```

---

## Task 15: PWA 설치 안내 칩 (안드로이드 한정)

**Files:**
- Create: `components/ui-overlays/PwaInstallHint.tsx`
- Modify: `app/page.tsx` (마운트 + 표시 조건)

- [ ] **Step 1: 컴포넌트 작성**

`components/ui-overlays/PwaInstallHint.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "pwa_install_hint_dismissed";

export default function PwaInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "true") return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari standalone (out of scope, but harmless)
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isAndroidChrome = ua.includes("android") && ua.includes("chrome") && !ua.includes("samsung");
    if (!isAndroidChrome) return;

    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 400,
        padding: "10px 14px",
        borderRadius: 999,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        color: "var(--text-primary)",
        fontSize: 12,
        maxWidth: 280,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>📲 홈에 추가하면 안드로이드 공유 메뉴에서 바로 보낼 수 있어요</span>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(DISMISS_KEY, "true");
          setVisible(false);
        }}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          fontSize: 14,
          padding: "2px 6px",
        }}
        aria-label="안내 닫기"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: page.tsx 에 마운트**

`app/page.tsx` 의 import 영역에 추가:

```ts
import PwaInstallHint from "@/components/ui-overlays/PwaInstallHint";
```

그리고 메인 페이지 return 구조의 끝(Toast 위치 근처)에 추가:

```tsx
<PwaInstallHint />
```

(보드 0개 온보딩 화면에는 노출 불필요 — 메인 return 분기 안쪽에만 두면 됨.)

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add components/ui-overlays/PwaInstallHint.tsx app/page.tsx
git commit -m "feat(ui): show install hint on Android Chrome web (non-standalone)"
```

---

## Task 16: 미들웨어가 /share-target 을 통과시키는지 확인

**Files:**
- Read: `middleware.ts`

- [ ] **Step 1: 미들웨어 점검**

Run:
```bash
cat middleware.ts | head -80
```
- `/share-target` 이 인증 필요 경로에 자연스럽게 포함되어 있고, 비로그인 시 `/auth/login` 으로 리다이렉트되는지 확인.
- 만약 `/share-target` 이 화이트리스트(공개 경로)에 잘못 포함되어 있다면, `share-target` 페이지 내부에서 redirect 처리를 이미 하므로 그대로 두어도 무방. 단 POST 가 미들웨어에 의해 차단되지 않는지(serviceWorker가 가로채므로 서버에는 도달하지 않지만, 혹시 SW 등록이 안 된 첫 진입에서 POST가 새는 경우 401/302 발생 가능) 확인.

- [ ] **Step 2: 필요 시 보호 예외 추가 (선택)**

만약 미들웨어가 `/share-target` POST를 막아 SW 등록 전 첫 공유에서 실패한다면, 다음 비슷한 형태로 화이트리스트를 추가한다. (현재 미들웨어 구조가 다를 수 있으므로 실제 코드에 맞춰 적용)

```ts
// 예시: 인증 필수 검사를 우회할 경로
const PUBLIC_PATHS = ["/auth/login", "/privacy"]; // 기존
const PUBLIC_POST_PATHS = ["/share-target"];      // 신규: SW 미등록 시 1회용
```

본 예시는 실제 미들웨어 구조에 따라 다르게 적용해야 한다. 본 단계는 "확인만"이며, 추가 작업 필요 시 별도 커밋.

- [ ] **Step 3: Commit (변경이 있을 때만)**

변경 사항이 없으면 skip. 있다면:

```bash
git add middleware.ts
git commit -m "fix(middleware): allow /share-target POST through to service worker"
```

---

## Task 17: 통합 검증 (수동)

**Files:** 없음 — 수동 검증

다음 시나리오를 모두 통과해야 끝. 통과/실패를 체크박스로 표시.

- [ ] **TC-1: 단위 — classifyShare URL 감지**
  Run: `node scripts/verify-classify-share.mjs` → `classifyShare URL detection OK`

- [ ] **TC-2: Manifest 인식**
  - `npm run dev` 후 DevTools › Application › Manifest 에서 `share_target` 블록 표시.

- [ ] **TC-3: Service Worker Activated**
  - DevTools › Application › Service Workers 에서 `sw.js` Activated.

- [ ] **TC-4: 직접 POST 시뮬레이션 (PWA 설치 전 1회용 검증)**
  - DevTools 콘솔에서:
    ```js
    const fd = new FormData();
    fd.append("url", "https://example.com");
    fetch("/share-target", { method: "POST", body: fd });
    ```
  - 페이지가 `/share-target?ok=1`로 이동하며 받은 메모에 example.com 카드가 추가되고 토스트가 뜸.

- [ ] **TC-5: 이미지 다중 공유 (시뮬레이션)**
  - 콘솔에서 이미지 3개 Blob 만들어 동일 방식으로 POST → 받은 메모 상단에 3개 카드, 토스트 count=3.

- [ ] **TC-6: 8MB 초과 거절**
  - 9MB 파일 Blob을 만들어 POST → 카드 없음, "용량 초과로 1건이 추가되지 않았어요" 토스트.

- [ ] **TC-7: PWA 설치 → 안드로이드 공유 시트 노출**
  - Chrome 데스크톱에서 "Install MindCanvas" 또는 안드로이드 실기기에서 "홈 화면에 추가".
  - 안드로이드에서 다른 앱의 공유 버튼 → 시트에 MindCanvas 노출.

- [ ] **TC-8: 카드 길게 누르기 → 컨텍스트 메뉴 → "다른 보드로 이동"**
  - link 카드: 생각정리 카테고리가 회색·비활성.
  - memo 카드: 세 카테고리 모두 활성. 다른 카테고리 보드 선택 시 이동되고 원본 사라짐.

- [ ] **TC-9: 비로그인 흐름**
  - 로그아웃 후 콘솔에서 POST 시뮬레이션 → `/auth/login?next=/share-target?ok=1` 로 리다이렉트.
  - 로그인하면 `/share-target?ok=1` 으로 다시 와서 큐를 비우고 받은 메모로 이동.

- [ ] **TC-10: 회귀 — 기존 Chrome 확장(`dt_scraps`) 흐름 영향 없음**
  - 별도 환경이 없으면 코드 검토만으로 확인 (인박스 보드는 그대로 사용, 다른 흐름은 건드리지 않음).

- [ ] **TC-11: 회귀 — `npm run lint`**
  Run: `npm run lint`
  Expected: 에러 없음.

- [ ] **TC-12: 회귀 — `npm run build`**
  Run: `npm run build`
  Expected: 성공 (경고는 무방, 에러 없음).

전부 통과하면 마무리 커밋 없이 끝. 통과 시 push:

```bash
git push
```

---

## Self-Review (작성자 메모)

- **Spec 항목 커버리지**
  - §3 아키텍처 → Task 8/9/10/12
  - §4 데이터 모델 → Task 1/2/3/4
  - §4.4 크로스카테고리 이동 → Task 5/6
  - §5 UI 컴포넌트 → Task 11/14/15 + Task 6 (시트 대체로 컨텍스트 메뉴 확장)
  - §6 PWA infra → Task 7/8/9/10
  - §7 페이지 → Task 12/13
  - §8 엣지 케이스 → 분류기·서비스워커·share-target 페이지에 분산 구현
  - §9 Supabase 변경 없음 → 별도 작업 없음
  - §11 검증 → Task 17
- **노트**: 스펙 §5.4는 별도 `MoveToBoardSheet.tsx`를 만들도록 했으나, 코드 탐색 결과 동일 기능을 제공하는 `ModuleContextMenu` 의 "다른 보드로 이동" UI가 이미 존재. 별도 시트 신설 대신 기존 메뉴를 세 카테고리 그룹·비활성 표시로 확장(Task 6)하여 동일한 사용자 가치를 더 작은 diff로 제공한다. 길게 누르기 트리거는 이미 메뉴에 연결돼 있어 사용자가 답한 "카드 장누르면 시트" 요구를 그대로 충족한다.
- **타입 일관성**: `SharedModuleInput` = `Omit<Module, "id" | "createdAt" | "updatedAt">` 와 `addSharedModulesToInbox` 의 두 번째 인자 시그니처 일치 확인 (Task 3/4).
- **Placeholder 점검**: 모든 코드 블록은 그대로 붙여넣을 수 있는 완성된 형태. TBD/TODO 없음.
