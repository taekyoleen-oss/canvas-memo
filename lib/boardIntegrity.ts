import type { Board } from "@/types";

/** 로컬/마이그레이션 JSON에 modules·connections가 빠진 경우 Supabase 동기화 시 전부 삭제되는 것을 막기 위함 */
export function normalizeBoardForClient(board: Board): Board {
  return {
    ...board,
    modules: Array.isArray(board.modules) ? board.modules : [],
    connections: Array.isArray(board.connections) ? board.connections : [],
    groups: Array.isArray(board.groups) ? board.groups : [],
  };
}

export function normalizeBoardsForClient(boards: Board[]): Board[] {
  return boards.map(normalizeBoardForClient);
}
