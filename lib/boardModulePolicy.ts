import type { Board, BoardCategory, ModuleType } from "@/types";
import { normalizeBoardCategory } from "@/lib/boardCategory";

/** 메모·일정 보드에서 추가·표시 가능한 모듈 타입 (브레인스톰만 생각정리 전용) */
export const MEMO_SCHEDULE_MODULE_TYPES: readonly ModuleType[] = [
  "memo",
  "schedule",
  "image",
  "link",
  "file",
  "table",
];

const MEMO_SCHEDULE_ALLOWED = new Set<ModuleType>(MEMO_SCHEDULE_MODULE_TYPES);

export function isModuleTypeAllowedOnCategory(
  type: ModuleType,
  category: BoardCategory
): boolean {
  if (category === "memo_schedule" || category === "topic_notes") {
    return MEMO_SCHEDULE_ALLOWED.has(type);
  }
  return true;
}

export function isModuleTypeAllowedOnBoard(type: ModuleType, board: Board): boolean {
  return isModuleTypeAllowedOnCategory(type, normalizeBoardCategory(board));
}

/** 메모·일정 보드에서 캔버스에 그릴 모듈 id (그 외 타입은 데이터에만 남을 수 있음) */
export function visibleModuleIdsForCanvas(board: Board): Set<string> | null {
  const cat = normalizeBoardCategory(board);
  if (cat !== "memo_schedule" && cat !== "topic_notes") return null;
  return new Set(
    board.modules.filter((m) => MEMO_SCHEDULE_ALLOWED.has(m.type)).map((m) => m.id)
  );
}
