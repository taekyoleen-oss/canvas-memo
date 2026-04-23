import { v4 as uuidv4 } from "uuid";
import type { Board, MemoData, Module } from "@/types";
import { nextSidebarOrder, normalizeBoardCategory } from "@/lib/boardCategory";

const NOTE_W = 640;
const NOTE_H = 540;

/** 리치 텍스트(목록·링크·이미지·코드) 예시 — 클로드(주제별 노트) */
const CLAUDE_HTML = `<h3 style="margin:0 0 8px 0;font-size:15px;color:var(--text-primary)">기본 명령</h3>
<ul style="margin:0 0 14px 0;padding-left:1.25em;line-height:1.6">
<li><code>/compact</code> — 컨텍스트를 압축해 토큰을 아껴요</li>
<li><code>/clear</code> — 대화·작업 맥락을 비워요</li>
<li><code>@파일경로</code> 또는 <code>@폴더</code> — 해당 파일·폴더를 맥락에 넣어요</li>
<li>터미널 출력·<code>git diff</code>를 붙여 넣으면 리뷰·커밋 메시지 작성에 좋아요</li>
</ul>
<h3 style="margin:0 0 8px 0;font-size:15px;color:var(--text-primary)">프롬프트 예시</h3>
<ul style="margin:0 0 14px 0;padding-left:1.25em;line-height:1.6">
<li>이 저장소 구조를 읽고, <code>pnpm lint</code>가 통과하도록 타입 오류만 최소 수정해 줘</li>
<li>이 함수의 시간 복잡도와 엣지 케이스를 설명하고, 단위 테스트 케이스 목록을 적어 줘</li>
<li>방금 변경한 부분만 diff 관점에서 리뷰해 줘 (보안·성능·가독성)</li>
</ul>
<p style="margin:10px 0 6px 0"><strong>링크 예시</strong> — 문서·릴리즈를 바로 열어두기</p>
<p style="margin:0 0 10px 0"><a href="https://docs.anthropic.com/claude/docs" target="_blank" rel="noopener noreferrer">Anthropic Claude 문서</a></p>
<p style="margin:10px 0 6px 0"><strong>이미지 예시</strong> — 스크린샷·다이어그램을 노트에 함께 두기</p>
<p style="margin:0"><img src="https://picsum.photos/seed/claude-note/520/160" alt="예시 이미지 자리" style="max-width:100%;height:auto;border-radius:8px;border:1px solid var(--border)" /></p>`;

const CURSOR_HTML = `<h3 style="margin:0 0 8px 0;font-size:15px;color:var(--text-primary)">단축·기능</h3>
<ul style="margin:0 0 14px 0;padding-left:1.25em;line-height:1.6">
<li><code>Ctrl+K</code> / <code>Cmd+K</code> — 인라인 편집·생성</li>
<li><code>Ctrl+L</code> / <code>Cmd+L</code> — 채팅 패널</li>
<li><code>Ctrl+I</code> / <code>Cmd+I</code> — Composer (여러 파일)</li>
<li><code>@</code> — 코드베이스, 파일, 터미널, 웹 등 컨텍스트</li>
<li><strong>Agent 모드</strong> — 터미널·검색까지 맡길 때 범위를 명확히 적기</li>
</ul>
<h3 style="margin:0 0 8px 0;font-size:15px;color:var(--text-primary)">프롬프트 예시</h3>
<ul style="margin:0 0 14px 0;padding-left:1.25em;line-height:1.6">
<li>이 컴포넌트를 WCAG 기준으로 점검하고 수정 포인트만 목록으로 줘</li>
<li>API 라우트와 서버 액션 중 어디에 두는 게 맞는지 이유와 함께 추천해 줘</li>
<li>같은 레이아웃·디자인 토큰(<code>--primary</code> 등)을 쓰도록 스타일만 정리해 줘</li>
</ul>
<p style="margin:10px 0 6px 0"><strong>링크 예시</strong></p>
<p style="margin:0 0 10px 0"><a href="https://cursor.com/docs" target="_blank" rel="noopener noreferrer">Cursor 공식 문서</a></p>
<p style="margin:10px 0 6px 0"><strong>이미지 예시</strong></p>
<p style="margin:0"><img src="https://picsum.photos/seed/cursor-note/520/160" alt="예시 이미지 자리" style="max-width:100%;height:auto;border-radius:8px;border:1px solid var(--border)" /></p>`;

function makeNoteModule(
  now: string,
  newId: () => string,
  title: string,
  html: string,
  color: Module["color"]
): Module {
  return {
    id: newId(),
    type: "memo",
    position: { x: 48, y: 72 },
    size: { width: NOTE_W, height: NOTE_H },
    zIndex: 1,
    color,
    shape: "rounded",
    isExpanded: true,
    isMinimized: false,
    data: {
      title,
      content: html,
      previewLines: 6,
    } satisfies MemoData,
    createdAt: now,
    updatedAt: now,
  };
}

function topicStarterTitles(userName: string | undefined): {
  board1: string;
  board2: string;
  memoTitle1: string;
  memoTitle2: string;
} {
  const t = userName?.trim();
  if (!t || t === "주제별") {
    return {
      board1: "클로드",
      board2: "커서 AI",
      memoTitle1: "클로드",
      memoTitle2: "커서 AI",
    };
  }
  return {
    board1: `${t} · 클로드`,
    board2: `${t} · 커서 AI`,
    memoTitle1: `${t} · 클로드`,
    memoTitle2: `${t} · 커서 AI`,
  };
}

/**
 * 주제별 워크스페이스: 사이드바에 **보드 2개**(클로드 / 커서 AI), 그룹 없음 — 메모·일정과 동일한 “보드 단위” 저장
 * `name`에 다이얼로그에서 입력한 이름을 넣으면 보드·노트 제목에 반영됩니다.
 */
function isCanonicalClaudeTopicName(name: string | undefined): boolean {
  const n = (name ?? "").trim();
  return (
    n === "클로드" ||
    n === "클로드 코드" ||
    n.endsWith(" · 클로드") ||
    n.endsWith(" · 클로드 코드") ||
    n.endsWith("· 클로드 코드")
  );
}

function isCanonicalCursorTopicName(name: string | undefined): boolean {
  const n = (name ?? "").trim();
  return n === "커서 AI" || n.endsWith("· 커서 AI");
}

/** 기본 「클로드」「커서 AI」 보드가 이미 있는지 */
export function hasCanonicalTopicNotesPair(boards: Board[]): boolean {
  const topic = boards.filter((b) => normalizeBoardCategory(b) === "topic_notes");
  const hasClaude = topic.some(
    (b) => b.icon === "🧩" || isCanonicalClaudeTopicName(b.name)
  );
  const hasCursor = topic.some(
    (b) => b.icon === "🖱️" || isCanonicalCursorTopicName(b.name)
  );
  return hasClaude && hasCursor;
}

/**
 * 주제별에 기본 보드 2개(클로드·커서 AI)가 없으면 추가합니다.
 * 이후 사이드바 `+`는 `addBoard`로 **추가 보드 1개**만 만듭니다.
 */
export function ensureTopicNotesCanonicalPair(
  boards: Board[],
  now: string,
  newId: () => string
): { boards: Board[]; changed: boolean } {
  if (hasCanonicalTopicNotesPair(boards)) {
    return { boards, changed: false };
  }

  const topic = boards.filter((b) => normalizeBoardCategory(b) === "topic_notes");
  const hasClaude = topic.some(
    (b) => b.icon === "🧩" || isCanonicalClaudeTopicName(b.name)
  );
  const hasCursor = topic.some(
    (b) => b.icon === "🖱️" || isCanonicalCursorTopicName(b.name)
  );

  let merged = [...boards];
  if (!hasClaude && !hasCursor) {
    const o0 = nextSidebarOrder(merged, "topic_notes");
    const pack = buildTopicNotesStarterBoards(
      { color: "#0d9488" },
      now,
      newId,
      o0,
      o0 + 1
    );
    merged = [...merged, ...pack];
  } else {
    if (!hasClaude) {
      const o = nextSidebarOrder(merged, "topic_notes");
      const pack = buildTopicNotesStarterBoards(
        { color: "#0d9488" },
        now,
        newId,
        o,
        o + 1
      );
      merged.push(pack[0]!);
    }
    if (!hasCursor) {
      const o = nextSidebarOrder(merged, "topic_notes");
      const pack = buildTopicNotesStarterBoards(
        { color: "#0d9488" },
        now,
        newId,
        o,
        o + 1
      );
      merged.push(pack[1]!);
    }
  }

  return { boards: normalizeTopicSidebarOrders(merged), changed: true };
}

type CanonicalTopicSlot = "claude" | "cursor";

function normHtmlForCompare(html: string | undefined): string {
  return (html ?? "").replace(/\s+/g, " ").trim();
}

function shouldCopyMemoIntoTopicCanonical(
  topicContent: string | undefined,
  memoContent: string | undefined,
  seedHtml: string
): boolean {
  const mc = (memoContent ?? "").trim();
  if (!mc) return false;
  const tc = (topicContent ?? "").trim();
  if (!tc) return true;
  if (normHtmlForCompare(topicContent) === normHtmlForCompare(seedHtml)) return true;
  return false;
}

function getSingleMemoModule(board: Board): Module | null {
  const g = board.groups ?? [];
  if (g.length > 0) return null;
  const mods = board.modules ?? [];
  if (mods.length !== 1 || mods[0]?.type !== "memo") return null;
  return mods[0]!;
}

function findTopicBoardForSlot(
  boards: Board[],
  slot: CanonicalTopicSlot
): Board | undefined {
  const topic = boards.filter((b) => normalizeBoardCategory(b) === "topic_notes");
  if (slot === "claude") {
    const byIcon = topic.find((b) => b.icon === "🧩");
    if (byIcon) return byIcon;
    return topic.find((b) => isCanonicalClaudeTopicName(b.name));
  }
  const byIcon = topic.find((b) => b.icon === "🖱️");
  if (byIcon) return byIcon;
  return topic.find((b) => isCanonicalCursorTopicName(b.name));
}

function memoScheduleBoardsForSlot(
  boards: Board[],
  slot: CanonicalTopicSlot
): Board[] {
  return boards.filter((b) => {
    if (normalizeBoardCategory(b) !== "memo_schedule") return false;
    const okName =
      slot === "claude"
        ? isCanonicalClaudeTopicName(b.name)
        : isCanonicalCursorTopicName(b.name);
    if (!okName) return false;
    return getSingleMemoModule(b) !== null;
  });
}

function pickBestMemoScheduleBoard(candidates: Board[]): Board | undefined {
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, cur) => {
    const bm = getSingleMemoModule(cur)!;
    const am = getSingleMemoModule(best)!;
    const blen = ((bm.data as MemoData).content ?? "").length;
    const alen = ((am.data as MemoData).content ?? "").length;
    if (blen !== alen) return blen > alen ? cur : best;
    const bt = bm.updatedAt ?? "";
    const at = am.updatedAt ?? "";
    return bt > at ? cur : best;
  });
}

function mergeMemoDataIntoTopicBoard(
  topicBoard: Board,
  source: MemoData,
  now: string
): Board {
  const mod = getSingleMemoModule(topicBoard)!;
  const prev = mod.data as MemoData;
  const merged: MemoData = {
    ...prev,
    title: (source.title ?? "").trim() || prev.title,
    content: source.content ?? "",
    previewLines: Math.max(prev.previewLines ?? 6, source.previewLines ?? 6),
  };
  return {
    ...topicBoard,
    updatedAt: now,
    modules: [{ ...mod, updatedAt: now, data: merged }],
  };
}

/**
 * 메모/할일에만 있던「클로드」「커서 AI」동명 보드의 노트 내용을,
 * 주제별 시드 보드의 노트가 비어 있거나 아직 기본 예시 HTML일 때만 채워 넣습니다.
 * (두 보드는 서로 다른 id이므로, 사용자가 주제별 노트를 이미 고쳤다면 덮어쓰지 않습니다.)
 */
export function recoverCanonicalTopicNotesFromMemoScheduleBoards(
  boards: Board[],
  now: string
): { boards: Board[]; changed: boolean } {
  let changed = false;
  const next = [...boards];

  for (const slot of ["claude", "cursor"] as const) {
    const seedHtml = slot === "claude" ? CLAUDE_HTML : CURSOR_HTML;
    const topicBoard = findTopicBoardForSlot(next, slot);
    if (!topicBoard) continue;
    const topicIdx = next.findIndex((b) => b.id === topicBoard.id);
    if (topicIdx < 0) continue;

    const topicMod = getSingleMemoModule(topicBoard);
    if (!topicMod) continue;

    const sources = memoScheduleBoardsForSlot(next, slot);
    const bestMemoBoard = pickBestMemoScheduleBoard(sources);
    if (!bestMemoBoard || bestMemoBoard.id === topicBoard.id) continue;

    const srcMod = getSingleMemoModule(bestMemoBoard)!;
    const tData = topicMod.data as MemoData;
    const mData = srcMod.data as MemoData;

    if (
      !shouldCopyMemoIntoTopicCanonical(tData.content, mData.content, seedHtml)
    ) {
      continue;
    }

    next[topicIdx] = mergeMemoDataIntoTopicBoard(topicBoard, mData, now);
    changed = true;
  }

  return { boards: next, changed };
}

function renameClaudeDisplayBoardName(name: string): string {
  const t = name.trim();
  if (t === "클로드 코드") return "클로드";
  if (t.endsWith(" · 클로드 코드")) return t.replace(/ · 클로드 코드$/, " · 클로드");
  if (t.endsWith("· 클로드 코드")) return t.replace(/· 클로드 코드$/, " · 클로드");
  return name;
}

function renameClaudeDisplayMemoTitle(title: string | undefined): string | undefined {
  if (title == null) return undefined;
  const t = title.trim();
  if (t === "클로드 코드") return "클로드";
  if (t.endsWith(" · 클로드 코드")) return title.replace(/ · 클로드 코드$/, " · 클로드");
  if (t.endsWith("· 클로드 코드")) return title.replace(/· 클로드 코드$/, " · 클로드");
  return title;
}

function mapBoardClaudeRenames(board: Board, now: string): Board {
  const newName = renameClaudeDisplayBoardName(board.name);
  const nameChanged = newName !== board.name;
  let modulesTouched = false;
  const modules = (board.modules ?? []).map((m) => {
    if (m.type !== "memo") return m;
    const d = m.data as MemoData;
    const nt = renameClaudeDisplayMemoTitle(d.title);
    if (nt !== undefined && nt !== d.title) {
      modulesTouched = true;
      return { ...m, updatedAt: now, data: { ...d, title: nt } };
    }
    return m;
  });
  if (!nameChanged && !modulesTouched) return board;
  return {
    ...board,
    name: newName,
    modules,
    updatedAt: now,
  };
}

/**
 * 주제별에 🧩 없이 들어가 있던「클로드」동명 보드는 메모/할일로 옮기고,
 * 보드·노트 제목의 레거시「클로드 코드」표기를「클로드」로 바꿉니다.
 */
/** Supabase SQL 마이그레이션용 — 클라이언트 hydrate에서는 사용하지 않음 */
export function demoteNonCanonicalClaudeTopicBoardsToMemo(
  boards: Board[],
  now: string
): { boards: Board[]; changed: boolean } {
  let changed = false;
  let next = [...boards];
  const demoteIds = next
    .filter(
      (b) =>
        normalizeBoardCategory(b) === "topic_notes" &&
        b.icon !== "🧩" &&
        isCanonicalClaudeTopicName(b.name) &&
        (b.groups?.length ?? 0) === 0 &&
        b.modules?.length === 1 &&
        b.modules[0]!.type === "memo"
    )
    .map((b) => b.id);

  for (const id of demoteIds) {
    const idx = next.findIndex((b) => b.id === id);
    if (idx < 0) continue;
    const b = next[idx]!;
    const order = nextSidebarOrder(next, "memo_schedule");
    next[idx] = {
      ...b,
      category: "memo_schedule",
      sidebarOrder: order,
      updatedAt: now,
    };
    changed = true;
  }
  if (changed) next = normalizeTopicSidebarOrders(next);
  return { boards: next, changed };
}

/**
 * 레거시 표기「클로드 코드」→「클로드」만 치환합니다.
 * (카테고리 강제 이동은 동기화 시 모듈이 비는 사고가 있어 hydrate 경로에서는 실행하지 않습니다.)
 */
export function applyClaudeMemoBrandingMigration(
  boards: Board[],
  now: string
): { boards: Board[]; changed: boolean } {
  let changed = false;
  const out = boards.map((b) => {
    const nb = mapBoardClaudeRenames(b, now);
    if (nb !== b) changed = true;
    return nb;
  });
  return { boards: out, changed };
}

export function buildTopicNotesStarterBoards(
  boardInput: Pick<Board, "color"> & { name?: string },
  now: string,
  newId: () => string,
  sidebarOrder0: number,
  sidebarOrder1: number
): Board[] {
  const { board1, board2, memoTitle1, memoTitle2 } = topicStarterTitles(
    boardInput.name
  );
  const base = {
    category: "topic_notes" as const,
    connections: [] as Board["connections"],
    groups: [] as Board["groups"],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now,
  };

  return [
    {
      ...base,
      id: newId(),
      name: board1,
      icon: "🧩",
      color: boardInput.color,
      sidebarOrder: sidebarOrder0,
      modules: [makeNoteModule(now, newId, memoTitle1, CLAUDE_HTML, "purple")],
    },
    {
      ...base,
      id: newId(),
      name: board2,
      icon: "🖱️",
      color: "#0e7490",
      sidebarOrder: sidebarOrder1,
      modules: [makeNoteModule(now, newId, memoTitle2, CURSOR_HTML, "blue")],
    },
  ];
}

function cloneModuleDeep(m: Module, newId: string, now: string, position: Module["position"]): Module {
  return {
    ...m,
    id: newId,
    position,
    zIndex: 1,
    data: JSON.parse(JSON.stringify(m.data)) as Module["data"],
    createdAt: now,
    updatedAt: now,
  };
}

/** 그룹 구조만 — 카테고리와 무관 (DB에 memo_schedule 으로 잘못 들어간 주제별 레거시 감지용) */
function isLegacyTopicTwoGroupLayout(b: Board): boolean {
  const g = b.groups ?? [];
  if (g.length !== 2) return false;
  const byName = new Map(g.map((x) => [x.name, x]));
  const gc = byName.get("클로드 코드") ?? byName.get("클로드");
  const gu = byName.get("커서 AI");
  if (!gc || !gu) return false;
  if (gc.moduleIds.length !== 1 || gu.moduleIds.length !== 1) return false;
  return true;
}

/**
 * 주제별 시드(그룹 없음)인데 `category`가 memo_schedule 로만 저장된 경우.
 * 이름만으로는 메모/할일 탭의 동명 보드와 구분할 수 없으므로 **시드 전용 아이콘**만 사용한다.
 */
function isLikelyTopicStarterBoard(b: Board): boolean {
  const groups = b.groups ?? [];
  if (groups.length > 0) return false;
  const mods = b.modules ?? [];
  if (mods.length !== 1 || mods[0]?.type !== "memo") return false;
  const icon = b.icon ?? "";
  return icon === "🧩" || icon === "🖱️";
}

/**
 * Supabase/로컬에 `board_category`가 없어 memo_schedule 로만 읽히는 주제별 보드를 `topic_notes` 로 복구
 */
export function repairMisclassifiedTopicNotesBoards(boards: Board[]): Board[] {
  return boards.map((b) => {
    if (normalizeBoardCategory(b) === "thinking") return b;
    if (normalizeBoardCategory(b) === "topic_notes") return b;
    if (isLegacyTopicTwoGroupLayout(b) || isLikelyTopicStarterBoard(b)) {
      return { ...b, category: "topic_notes" as const };
    }
    return b;
  });
}

/** 레거시(한 보드·폴더 2개) 데이터가 있으면 `migrateLegacyTopicGroupedBoards` 필요 */
export function hasLegacyTopicGroupedBoard(boards: Board[]): boolean {
  return boards.some(isLegacyTopicTwoGroupBoard);
}

/** 레거시: 한 보드에 그룹「클로드(코드)」「커서 AI」+ 노트 1개씩 (주제별 카테고리만) */
function isLegacyTopicTwoGroupBoard(b: Board): boolean {
  if (normalizeBoardCategory(b) !== "topic_notes") return false;
  return isLegacyTopicTwoGroupLayout(b);
}

/**
 * 레거시 주제별(한 보드·폴더 2개) → 보드 2개로 분리. 첫 보드 id·생성일은 유지해 Supabase `boards` 행 연속성 유지
 */
export function migrateLegacyTopicGroupedBoards(boards: Board[]): Board[] {
  const out: Board[] = [];
  for (const board of boards) {
    if (!isLegacyTopicTwoGroupBoard(board)) {
      out.push(board);
      continue;
    }
    const now = new Date().toISOString();
    const newId = () => uuidv4();
    const gClaude =
      board.groups!.find((x) => x.name === "클로드 코드" || x.name === "클로드")!;
    const gCursor = board.groups!.find((x) => x.name === "커서 AI")!;
    const mClaude = board.modules.find((m) => m.id === gClaude.moduleIds[0])!;
    const mCursor = board.modules.find((m) => m.id === gCursor.moduleIds[0])!;
    const o0 = board.sidebarOrder ?? 0;
    const o1 = o0 + 1;

    const boardClaude: Board = {
      ...board,
      id: board.id,
      name: "클로드",
      icon: "🧩",
      category: "topic_notes",
      groups: [],
      connections: [],
      modules: [cloneModuleDeep(mClaude, newId(), now, { x: 48, y: 72 })],
      sidebarOrder: o0,
      updatedAt: now,
    };
    const boardCursor: Board = {
      ...board,
      id: newId(),
      name: "커서 AI",
      icon: "🖱️",
      color: "#0e7490",
      category: "topic_notes",
      groups: [],
      connections: [],
      modules: [cloneModuleDeep(mCursor, newId(), now, { x: 48, y: 72 })],
      sidebarOrder: o1,
      createdAt: now,
      updatedAt: now,
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    out.push(boardClaude, boardCursor);
  }
  return normalizeTopicSidebarOrders(out);
}

/** 주제별 보드만 정렬 순으로 sidebarOrder를 0…n-1 로 정리 */
export function normalizeTopicSidebarOrders(boards: Board[]): Board[] {
  const topic = boards
    .filter((b) => normalizeBoardCategory(b) === "topic_notes")
    .sort((a, b) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0));
  const orderMap = new Map(topic.map((b, i) => [b.id, i]));
  return boards.map((b) =>
    orderMap.has(b.id) ? { ...b, sidebarOrder: orderMap.get(b.id)! } : b
  );
}
