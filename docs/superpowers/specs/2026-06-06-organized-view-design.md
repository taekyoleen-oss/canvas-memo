# MindCanvas 「정리 뷰」 설계 스펙

- 작성일: 2026-06-06
- 상태: 사용자 검토 대기
- 담당 하네스: data-layer → canvas-engine → ui-builder → qa

## 1. 배경 / 문제

현재 앱은 **자유 배치 캔버스**(팬·줌·드래그)만 제공한다. 메모가 많아지면 한눈에 훑기
어렵다. 이미 `computeArrangeLayout`(격자/목록/종류별/컴팩트)으로 캔버스 위 카드를
재배치하는 "정렬해서 보기"가 있으나, 이는 캔버스 좌표만 바꾸는 것이라 다음을 못 한다.

- 읽기 최적화된 일목요연한 그리드/리스트
- **연결된 메모를 하나의 그룹으로 접어 보이기** + 클릭 시 펼치기
- PC(가로 그리드) / 모바일(세로 리스트) 형태 분기

## 2. 목표 (확정된 사용자 결정)

1. **전용 「정리」 뷰 토글 신설** — 캔버스와 별개의 읽기 전용/편집 진입 뷰.
   상단에 `[캔버스] [정리]` 세그먼트 토글. 보드별로 기억.
2. **연결선으로 이어진 전체 묶음(연결 컴포넌트) = 한 그룹.** 명시적 `Group`,
   맵 템플릿 묶음(`mapTemplateBundleId`)도 각각 한 그룹으로 취급.
3. **대표(중심) 모듈 자동 선정 = 연결 최다 → 동률 시 가장 오래된 것.**
   사용자 수동 지정이 있으면 그것이 최우선.
4. PC: 만든순(최신이 좌상단) 기본 그리드, 「가나다」 정렬 옵션. 모바일: 위→아래 세로 리스트.
5. **메모뿐 아니라 모든 모듈 타입**(memo·schedule·image·link·file·table·brainstorm)에 동일 적용.

### 함께 처리 (사용자 승인 — data-layer 단계에 포함)

- **로컬 캐시 localStorage → IndexedDB 이전** (QuotaExceededError 근본 해결).
  base64 미디어를 포함한 캔버스 캐시를 IndexedDB(수백MB 가용)로 옮긴다. 자세한 내용은 §12.

### 비목표 (이번 반복 제외 — YAGNI)

- Supabase 스키마 마이그레이션 (대표 지정·뷰 설정은 로컬 영속화로 처리)
- 정리 뷰 내 드래그 재정렬(수동 순서) — 정렬 기준으로만 배열
- 정리 뷰에서의 신규 연결 생성 (연결은 캔버스에서)

## 3. 아키텍처 개요

```
app/page.tsx (viewMode 분기)
  ├─ viewMode==="canvas"     → <Canvas/>        (기존)
  └─ viewMode==="organized"  → <OrganizedView/> (신규, 일반 스크롤 DOM)

OrganizedView
  ├─ buildOrganizedEntries()   ← lib/canvas/organizedGroups.ts (canvas-engine)
  │     · 연결 컴포넌트/Group/맵 묶음 → DisplayEntry[] (singleton | group)
  │     · 대표 모듈 선정, 그룹 멤버 정렬
  ├─ sortEntries()             ← 정렬(만든순 최신 / 가나다 / 수정순)
  ├─ <ViewModeToggle/> <SortMenu/>
  ├─ PC: CSS grid / Mobile: 1열 리스트
  │     ├─ <OrganizedCard/>       (단일 모듈 읽기 카드)
  │     └─ <OrganizedGroupCard/>  (대표 미리보기 + 🔗N 배지)
  ├─ <GroupExpandPopup/>      (PC 모달 / 모바일 시트 — 그룹 멤버 펼침)
  └─ <ModuleEditOverlay/>     (카드 탭 → 기존 모듈 편집기 모달 재사용)

상태/영속화: store/canvas.ts + lib/storage/viewPrefs.ts (data-layer)
  · viewModeByBoardId, sortKeyByBoardId, primaryOverrideByBoard  → localStorage(UI 전용, 비동기 Supabase 미반영)
```

데이터 흐름은 **단방향**: 스토어(boards) → 순수 계산(`organizedGroups`) → UI. 정리 뷰는
모듈 좌표(`position`)를 **변경하지 않는다**(캔버스 자유 배치 보존). 편집은 기존 store
액션(`updateModule` 등)을 그대로 호출한다.

## 4. 데이터 모델 / 타입 (data-layer)

새 영속 스키마(Supabase) 변경 없음. 타입 추가:

```ts
// types/index.ts
export type OrganizedViewMode = "canvas" | "organized";
export type OrganizedSortKey = "createdDesc" | "title" | "updatedDesc";

// 표시용(파생, 영속 아님) — lib/canvas/organizedGroups.ts
export type DisplayEntryKind = "single" | "group";
export interface DisplayEntry {
  kind: DisplayEntryKind;
  /** 정렬 키 계산 기준 모듈(단일=자기 자신, 그룹=대표 모듈) */
  anchor: Module;
  /** group일 때만: 대표 포함 전체 멤버(대표가 [0]) */
  members?: Module[];
  /** group 출처 */
  groupSource?: "connection" | "group" | "mapBundle";
  /** group 식별자(Group.id | bundleId | 연결 컴포넌트 서명) */
  groupKey?: string;
}
```

### 영속 (lib/storage/viewPrefs.ts)

- localStorage key: `mindcanvas_view_prefs_v1`
- 형태: `{ viewMode: Record<boardId,OrganizedViewMode>, sortKey: Record<boardId,OrganizedSortKey>, primary: Record<boardId, Record<groupKey, moduleId>> }`
- 기본값: viewMode=`canvas`, sortKey=`createdDesc`
- 읽기/쓰기 헬퍼 제공. 스토어가 이를 in-memory 미러로 들고, 변경 시 즉시 저장(가벼우므로 debounce 불필요).
- **대표 수동 지정**은 `primary[boardId][groupKey] = moduleId`. groupKey가 연결 변화로
  달라지면 자동 규칙으로 폴백(무효 지정 무시). 향후 모듈 필드로 승격 가능하도록 헬퍼 경유로만 접근.

### 스토어 추가 (store/canvas.ts)

```ts
organizedView: {
  viewModeByBoardId: Record<string, OrganizedViewMode>;
  sortKeyByBoardId: Record<string, OrganizedSortKey>;
};
setViewMode(boardId, mode): void;     // viewPrefs 저장
setSortKey(boardId, key): void;       // viewPrefs 저장
setGroupPrimary(boardId, groupKey, moduleId): void; // viewPrefs 저장
hydrateForUser 시 viewPrefs 로드.
```

## 5. 그룹화 / 대표 선정 (canvas-engine) — `lib/canvas/organizedGroups.ts`

순수 함수, 입력 = `{ modules, connections, groups }`, 출력 = `DisplayEntry[]`.

1. **소속 결정 (우선순위)**: 각 모듈을 정확히 하나의 표시 그룹에 배정.
   1) 명시적 `Group` (moduleIds) — 우선순위 최상
   2) 맵 묶음 `mapTemplateBundleId`
   3) `connections` 무향 그래프의 **연결 컴포넌트**(크기 ≥ 2)
   4) 어디에도 없으면 **단일(single)**
   - 한 모듈이 Group과 연결 컴포넌트 양쪽에 걸치면 (1) 우선. 컴포넌트 계산 시 이미
     상위 그룹에 배정된 모듈은 제외하고 나머지로 재계산.
2. **대표(anchor) 선정** (그룹 한정):
   - (a) `viewPrefs.primary[boardId][groupKey]`가 멤버에 있으면 그 모듈
   - (b) 없으면 **그룹 내 연결 차수(degree) 최다**
   - (c) 동률이면 **createdAt 오름차순(가장 오래된 것)**
   - (d) 그래도 동률이면 `id` 사전순 (결정적)
3. **멤버 정렬**: 대표 [0], 이후 createdAt 오름차순.
4. **groupKey**:
   - group: `g:{Group.id}`
   - mapBundle: `b:{bundleId}`
   - connection: `c:{정렬된 멤버 id들의 해시}` (멤버 집합이 같으면 동일 키 유지)
5. **anchor 노출**: 정렬은 entry.anchor 기준으로 수행(단일=자기, 그룹=대표).

degree 계산: 각 모듈의 연결 수 = 그 모듈을 끝점으로 갖는 connection 개수(그룹 내부/외부 무관, 단 일반적으로 컴포넌트 내부).

## 6. 정렬 (canvas-engine/data-layer 공용) — `sortEntries`

`arrangeLayouts.ts`의 정렬 로직을 일반화하여 entry용 비교자 제공:

- `createdDesc` (기본): anchor.createdAt **내림차순** (최신이 앞 = 좌상단/최상단)
- `title`: anchor 제목 `localeCompare(…, "ko")`. 제목 없으면 뒤로.
- `updatedDesc`: anchor.updatedAt 내림차순
- 안정 정렬, 동률 시 createdAt desc → id 로 결정적.

제목 추출은 모듈 타입별 (`title` / `fileName` / `url`) — 기존 `safeTitle` 재사용/확장.

## 7. UI (ui-builder)

CSS 변수만 사용(`--surface`, `--border`, `--text-*`, `--module-*` …), 하드코딩 금지.
터치 타겟 ≥ 44×44px.

### 7-1. 진입/토글
- `components/organized/ViewModeToggle.tsx` — `[캔버스][정리]` 세그먼트(분절 컨트롤).
  toolbar 행 또는 WorkspaceSwitcher 우측에 배치. 보드 전환해도 보드별 모드 유지.
- `components/organized/SortMenu.tsx` — 정렬 드롭다운(만든순(최신)·가나다·수정순).
  `ArrangeMenu` 시각 스타일 참고.

### 7-2. 레이아웃
- **PC(md+)**: `display:grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap:16px;`
  읽기 순서 좌→우, 위→아래. 카드 높이 균일(미리보기 줄 수 제한). 네이티브 스크롤.
- **모바일(<md)**: 1열 `flex-col`, 카드 전체 폭, 위→아래. 네이티브 스크롤.
- 빈 보드: 안내 + "캔버스로 전환" 버튼.

### 7-3. 카드
- `OrganizedCard` (단일): 타입 아이콘 + 제목 + 타입별 미리보기. `ModuleCard` 접힘 표현 참고하되
  **드래그/앵커 없는 정적 카드**. 클릭 → `ModuleEditOverlay`.
- `OrganizedGroupCard` (그룹): 대표 모듈 미리보기 + 우상단 배지 `🔗 N`(멤버 수) + 멤버
  타입 믹스 작은 점/아이콘. 출처 표시(연결/그룹/맵). 클릭 → `GroupExpandPopup`.
- 타입별 미리보기:
  memo=제목+content N줄 / schedule=제목+다음 항목+완료비율 / image=썸네일 /
  link=favicon+제목+url / file=파일명+용량 / table=제목+행열 / brainstorm=제목+항목수.

### 7-4. 그룹 확장
- **PC**: `GroupExpandPopup` 중앙 모달. 멤버를 미니 그리드로, 연결 라벨 표시. 멤버 탭 → 편집 오버레이.
- **모바일**: 하단 시트(앱의 기존 시트 스타일). 대표를 맨 위, 멤버 위→아래 리스트. "펼치기 N" 버튼으로 진입.
- 닫기: 배경 클릭 / ✕ / Android 뒤로가기(아래 7-6).

### 7-5. 편집 오버레이
- `ModuleEditOverlay` — 기존 모듈 컴포넌트(`MemoModule` 등)를 expanded 모드로 모달에 렌더.
  store 액션 그대로 사용 → 저장/동기화 경로 동일. ui-builder는 각 모듈 컴포넌트가 캔버스
  변환 밖에서 단독 렌더 가능한지 확인하고, 불가하면 최소 래퍼로 보정.

### 7-6. 뒤로가기/오버레이 스택 통합
`app/page.tsx`의 popstate 우선순위 스택에 정리 뷰 오버레이를 등록:
편집 오버레이 → 그룹 확장 팝업 → (그 외 기존 오버레이) → 펼친 카드 → 종료 확인.
즉 정리 뷰에서 뒤로가기는 편집 오버레이/그룹 팝업을 먼저 닫는다.

## 8. 통합 지점 요약

| 파일 | 변경 |
|------|------|
| `types/index.ts` | OrganizedViewMode·OrganizedSortKey·DisplayEntry 추가 |
| `lib/storage/viewPrefs.ts` | 신규 — 뷰 설정 영속 |
| `store/canvas.ts` | organizedView 상태 + setViewMode/setSortKey/setGroupPrimary, hydrate 시 로드 |
| `lib/canvas/organizedGroups.ts` | 신규 — 그룹화·대표·정렬 순수 로직 |
| `app/page.tsx` | viewMode 분기(모바일·PC 양쪽), 토글/정렬 배치, popstate 스택 확장 |
| `components/ui-overlays/ModuleToolbar.tsx` | 토글/정렬 슬롯 추가(또는 상위에서 주입) |
| `components/organized/*` | 신규 컴포넌트 7종 |

## 9. 엣지 케이스

- 연결 0개 보드 → 전부 single. 정상.
- 멤버 1개만 남은 연결 컴포넌트 → single 취급.
- 대표 수동 지정 후 그 모듈이 그룹에서 빠지면 → 자동 규칙 폴백.
- 매우 큰 그룹(수십 개) → 그룹 카드는 대표만, 팝업은 스크롤.
- 같은 모듈이 Group + 연결 양쪽 → Group 우선(중복 표시 금지).
- 모듈 0개 보드 → 빈 상태 안내.
- 정리 뷰에서 모듈 삭제/수정 → 재계산되어 즉시 반영.

## 10. QA 기준 (qa)

경계면 교차 검증 위주:
1. 타입↔스토어↔viewPrefs shape 일치(저장→로드 라운드트립).
2. 그룹화 우선순위·단일 판정 정확성(연결/Group/맵 혼합 케이스).
3. 대표 선정 결정성(차수·동률·수동 지정·폴백).
4. 정렬: createdDesc 최신 우선, title ko 정렬, 안정성.
5. 7개 모듈 타입 전부 카드·팝업·편집 오버레이 렌더.
6. PC 그리드/모바일 리스트 반응형, 44px 터치 타겟.
7. 뒤로가기 스택: 편집→그룹팝업 순서로 닫힘.
8. 정리 뷰 편집이 캔버스/Supabase 동기화에 정상 반영(좌표 불변).
9. `tsc` 타입 오류 0, 기존 캔버스 기능 회귀 없음.

## 11. 구현 순서 (오케스트레이터 파이프라인)

1. **data-layer**: (a) IndexedDB 이전(§12) → (b) 타입 + viewPrefs + 스토어 상태/액션 + hydrate.
2. **canvas-engine**: organizedGroups(그룹화·대표·정렬) + 단위 검증.
3. **ui-builder**: OrganizedView 및 하위 컴포넌트 + page.tsx 분기 + 뒤로가기 스택.
4. **qa**: 각 단계 직후 점진 QA + 통합 회귀.
각 단계 산출물은 `_workspace/`에 메모로 남겨 다음 에이전트가 참조.

## 12. 부록 — 로컬 캐시 IndexedDB 이전 (data-layer, 사용자 승인)

**문제:** `saveAppDataForUser`가 base64 미디어를 포함한 전체 AppData를 localStorage(~5MB)에
직렬화 → `QuotaExceededError`로 저장 실패.

**해결:** 캔버스 캐시를 **IndexedDB**(수백MB 가용)로 이전. base64 미디어를 캐시에서 버리지
않고 오프라인에서도 유지.

- `lib/storage/idb.ts` 신규 — 최소 IndexedDB 래퍼(`get/set/del`, DB명 `mindcanvas`,
  store `appData`, key=`canvasStorageKey(userId)`). 외부 의존성 없이 `indexedDB` 직접 사용.
- `lib/storage/index.ts`: `loadAppDataForUser`/`saveAppDataForUser`를 **async**로 전환하여
  IDB 사용. 최초 1회 localStorage→IDB **마이그레이션**(기존 키 읽어 IDB로 이전 후 localStorage 키 제거).
- `store/canvas.ts`: 저장/하이드레이트 경로를 async 저장기에 맞춰 조정(`createDebouncedSave`가
  async 저장 함수 허용). 500ms debounce 유지.
- 폴백: IndexedDB 미지원/실패 시 try/catch로 localStorage 폴백 + 미디어 제외 슬림 저장.
- §4의 `viewPrefs`(가벼움)는 별도 작은 localStorage 키 유지(IDB 불필요).
- QA: 저장→로드 라운드트립, 마이그레이션 1회성, 용량 큰 보드 저장 성공, 폴백 경로.
