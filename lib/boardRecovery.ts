import type { Board, Connection, Group, Module, MemoData } from "@/types";
import { normalizeBoardForClient, normalizeBoardsForClient } from "@/lib/boardIntegrity";
import {
  STORAGE_KEY,
  canvasStorageKey,
  loadAppData,
  loadAppDataForUser,
} from "@/lib/storage";

function pickRicherModule(a: Module, b: Module): Module {
  if (a.type === "memo" && b.type === "memo") {
    const al = String((a.data as MemoData)?.content ?? "").length;
    const bl = String((b.data as MemoData)?.content ?? "").length;
    if (bl !== al) return bl > al ? b : a;
  }
  const at = a.updatedAt ?? "";
  const bt = b.updatedAt ?? "";
  if (bt !== at) return bt > at ? b : a;
  return a;
}

function mergeModuleLists(base: Module[], snap: Module[]): Module[] {
  const map = new Map<string, Module>();
  for (const m of base) map.set(m.id, m);
  for (const m of snap) {
    const ex = map.get(m.id);
    map.set(m.id, ex ? pickRicherModule(ex, m) : m);
  }
  return [...map.values()];
}

function mergeConnectionLists(base: Connection[], snap: Connection[]): Connection[] {
  const map = new Map<string, Connection>();
  for (const c of base) map.set(c.id, c);
  for (const c of snap) {
    if (!map.has(c.id)) map.set(c.id, c);
  }
  return [...map.values()];
}

function pickRicherGroup(a: Group, b: Group): Group {
  const an = (a.moduleIds ?? []).length;
  const bn = (b.moduleIds ?? []).length;
  if (bn !== an) return bn > an ? b : a;
  const at = a.updatedAt ?? "";
  const bt = b.updatedAt ?? "";
  return bt > at ? b : a;
}

function mergeGroupLists(base: Group[], snap: Group[]): Group[] {
  const map = new Map<string, Group>();
  for (const g of base) map.set(g.id, g);
  for (const g of snap) {
    const ex = map.get(g.id);
    map.set(g.id, ex ? pickRicherGroup(ex, g) : g);
  }
  return [...map.values()];
}

function filterConnectionsForModules(
  connections: Connection[],
  modules: Module[]
): Connection[] {
  const ids = new Set(modules.map((m) => m.id));
  return connections.filter(
    (c) => ids.has(c.fromModuleId) && ids.has(c.toModuleId)
  );
}

/** Supabase로 받은 보드와 localStorage 등 스냅샷을 합쳐, 빠진 모듈·연결·그룹을 되살립니다. */
export function mergeBoardPreferRicher(base: Board, snap: Board): Board {
  const snapN = normalizeBoardForClient(snap);
  const baseN = normalizeBoardForClient(base);
  let modules = mergeModuleLists(baseN.modules ?? [], snapN.modules ?? []);
  let connections = mergeConnectionLists(
    baseN.connections ?? [],
    snapN.connections ?? []
  );
  connections = filterConnectionsForModules(connections, modules);
  const groups = mergeGroupLists(baseN.groups ?? [], snapN.groups ?? []);
  return normalizeBoardForClient({
    ...baseN,
    modules,
    connections,
    groups,
  });
}

/** 보드 id별로 여러 스냅샷(계정 키·레거시 키 등)을 순서대로 합칩니다. */
export function mergeHydratedBoardsWithSnapshotMap(
  boards: Board[],
  snapshotsByBoardId: Map<string, Board[]>
): Board[] {
  return boards.map((board) => {
    const snaps = snapshotsByBoardId.get(board.id);
    if (!snaps?.length) return normalizeBoardForClient(board);
    let acc = normalizeBoardForClient(board);
    for (const s of snaps) {
      acc = mergeBoardPreferRicher(acc, s);
    }
    return acc;
  });
}

function appendBoardsToMap(
  byId: Map<string, Board[]>,
  list: Board[] | undefined | null
) {
  if (!list?.length) return;
  for (const b of normalizeBoardsForClient(list)) {
    const arr = byId.get(b.id) ?? [];
    arr.push(b);
    byId.set(b.id, arr);
  }
}

/**
 * 브라우저에 남아 있을 수 있는 모든 mindcanvas 캐시에서 보드 스냅샷을 모읍니다.
 * (계정별 키 → 레거시 공용 키 → 그 외 mindcanvas_* 키)
 */
export function collectSnapshotsForMerge(userId: string): Map<string, Board[]> {
  const byId = new Map<string, Board[]>();

  appendBoardsToMap(byId, loadAppDataForUser(userId)?.boards);
  appendBoardsToMap(byId, loadAppData()?.boards);

  if (typeof window !== "undefined") {
    const skip = new Set<string>([canvasStorageKey(userId), STORAGE_KEY]);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.includes("mindcanvas")) continue;
      if (skip.has(key)) continue;
      skip.add(key);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const p = JSON.parse(raw) as { boards?: Board[] };
        appendBoardsToMap(byId, p.boards);
      } catch {
        /* ignore corrupt keys */
      }
    }
  }

  return byId;
}

export function boardsChildrenSignature(boards: Board[]): string {
  let h = 0;
  for (const b of boards) {
    const mods = b.modules ?? [];
    const conns = b.connections ?? [];
    h = h * 33 + mods.length;
    h = h * 33 + conns.length;
    for (const m of mods) {
      if (m.type === "memo") {
        h += String((m.data as MemoData)?.content ?? "").length;
      }
    }
  }
  return String(h);
}
