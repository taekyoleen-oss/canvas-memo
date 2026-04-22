import type { Board, BoardCategory } from "@/types";

export function normalizeBoardCategory(board: Board): BoardCategory {
  return board.category ?? "memo_schedule";
}

/** 사이드바: 메모·일정 먼저, 생각정리 다음 — 각 섹션은 sidebarOrder 기준 */
export function sortBoardsForSidebar(boards: Board[]): Board[] {
  const memo = boards
    .filter((b) => normalizeBoardCategory(b) === "memo_schedule")
    .sort((a, b) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0));
  const thinking = boards
    .filter((b) => normalizeBoardCategory(b) === "thinking")
    .sort((a, b) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0));
  return [...memo, ...thinking];
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
