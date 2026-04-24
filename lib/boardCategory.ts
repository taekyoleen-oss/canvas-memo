import type { Board, BoardCategory } from "@/types";

export function normalizeBoardCategory(board: Board): BoardCategory {
  return board.category ?? "memo_schedule";
}

/**
 * Supabase `boards.board_category` 컬럼 값.
 * DB에 `boards_board_category_check`가 topic_notes를 포함하도록 마이그레이션되어 있어야 합니다.
 */
export function boardCategoryToSupabaseColumn(
  category: Board["category"] | string | undefined
): "memo_schedule" | "thinking" | "topic_notes" {
  if (category === "thinking" || category === "topic_notes" || category === "memo_schedule") {
    return category;
  }
  return "memo_schedule";
}

/** 사이드바: 메모·일정 먼저, 생각정리, 주제별 — 각 섹션은 sidebarOrder 기준 (레거시·전체 목록용) */
export function sortBoardsForSidebar(boards: Board[]): Board[] {
  const memo = boards
    .filter((b) => normalizeBoardCategory(b) === "memo_schedule")
    .sort((a, b) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0));
  const thinking = boards
    .filter((b) => normalizeBoardCategory(b) === "thinking")
    .sort((a, b) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0));
  const topic = boards
    .filter((b) => normalizeBoardCategory(b) === "topic_notes")
    .sort((a, b) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0));
  return [...memo, ...thinking, ...topic];
}

/** 현재 워크스페이스(상단 탭)에 해당하는 보드만 sidebarOrder 기준 */
export function boardsForWorkspace(
  boards: Board[],
  workspace: BoardCategory
): Board[] {
  return boards
    .filter((b) => normalizeBoardCategory(b) === workspace)
    .sort((a, b) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0));
}

export function nextSidebarOrder(boards: Board[], category: BoardCategory): number {
  const same = boards.filter((b) => normalizeBoardCategory(b) === category);
  if (same.length === 0) return 0;
  return Math.max(...same.map((b) => b.sidebarOrder ?? 0)) + 1;
}

/** sortBoardsForSidebar 결과에서 globalIndex가 해당 카테고리 안에서 몇 번째인지 */
export function localIndexInCategory(sorted: Board[], globalIndex: number): number {
  const cat = normalizeBoardCategory(sorted[globalIndex]);
  let c = 0;
  for (let i = 0; i <= globalIndex; i++) {
    if (normalizeBoardCategory(sorted[i]) !== cat) continue;
    if (i === globalIndex) return c;
    c++;
  }
  return 0;
}
