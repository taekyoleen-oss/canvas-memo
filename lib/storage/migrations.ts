import type { AppData, Board, BoardCategory } from "@/types";
import { normalizeBoardsForClient } from "@/lib/boardIntegrity";
import { repairMisclassifiedTopicNotesBoards } from "@/lib/topicBoardSeed";

/** 현재 앱 데이터 버전 */
export const CURRENT_VERSION = 1;

/** 버전 1의 기본 초기 데이터 */
function createDefaultAppData(): AppData {
  return {
    version: CURRENT_VERSION,
    theme: "system",
    boards: [],
    lastOpenedBoardId: null,
  };
}

/**
 * raw unknown 데이터를 현재 버전의 AppData로 마이그레이션합니다.
 * version 필드를 체크하고, 필요 시 단계별 마이그레이션을 적용합니다.
 */
export function migrateAppData(raw: unknown): AppData {
  // 유효하지 않은 데이터면 기본값 반환
  if (!raw || typeof raw !== "object") {
    return createDefaultAppData();
  }

  const data = raw as Record<string, unknown>;

  // version 필드가 없으면 레거시(v0) 데이터로 간주
  const version =
    typeof data.version === "number" ? data.version : 0;

  // 현재 버전과 같으면 타입 단언 후 반환
  if (version === CURRENT_VERSION) {
    return ensureAppDataShape(data);
  }

  // v0 → v1 마이그레이션
  let migrated = data;
  if (version < 1) {
    migrated = migrateV0toV1(migrated);
  }

  // 향후 버전 추가 시 여기에 단계별 마이그레이션 추가
  // if (version < 2) { migrated = migrateV1toV2(migrated); }

  return ensureAppDataShape(migrated);
}

/** v0(버전 없음) → v1 마이그레이션 */
function migrateV0toV1(data: Record<string, unknown>): Record<string, unknown> {
  return {
    version: 1,
    theme: data.theme ?? "system",
    boards: Array.isArray(data.boards) ? data.boards : [],
    lastOpenedBoardId: data.lastOpenedBoardId ?? null,
  };
}

/**
 * AppData 형태를 보장합니다.
 * 누락된 필드를 기본값으로 채웁니다.
 */
const BOARD_CATEGORIES: readonly BoardCategory[] = [
  "memo_schedule",
  "thinking",
  "topic_notes",
];

function ensureAppDataShape(data: Record<string, unknown>): AppData {
  const defaults = createDefaultAppData();

  const rawWs = data.activeWorkspace;
  const activeWorkspace =
    rawWs === "memo_schedule" || rawWs === "thinking" || rawWs === "topic_notes"
      ? rawWs
      : undefined;

  let lastOpenedBoardByCategory: AppData["lastOpenedBoardByCategory"];
  const rawBy = data.lastOpenedBoardByCategory;
  if (rawBy && typeof rawBy === "object" && !Array.isArray(rawBy)) {
    const o = rawBy as Record<string, unknown>;
    lastOpenedBoardByCategory = {};
    for (const k of BOARD_CATEGORIES) {
      const v = o[k];
      if (typeof v === "string") lastOpenedBoardByCategory[k] = v;
    }
  }

  return {
    version:
      typeof data.version === "number" ? data.version : defaults.version,
    theme:
      data.theme === "light" || data.theme === "dark" || data.theme === "system"
        ? data.theme
        : defaults.theme,
    boards: normalizeBoardsForClient(
      repairMisclassifiedTopicNotesBoards(
        Array.isArray(data.boards) ? (data.boards as Board[]) : defaults.boards
      )
    ),
    lastOpenedBoardId:
      typeof data.lastOpenedBoardId === "string" || data.lastOpenedBoardId === null
        ? data.lastOpenedBoardId
        : defaults.lastOpenedBoardId,
    ...(activeWorkspace ? { activeWorkspace } : {}),
    ...(lastOpenedBoardByCategory &&
    Object.keys(lastOpenedBoardByCategory).length > 0
      ? { lastOpenedBoardByCategory }
      : {}),
  };
}
