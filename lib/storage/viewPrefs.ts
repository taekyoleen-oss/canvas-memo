import type { OrganizedViewMode, OrganizedSortKey } from "@/types";

/**
 * 정리 뷰 설정의 localStorage 영속화.
 *
 * 가벼운 메타데이터(보드별 뷰 모드/정렬/대표 지정)만 담으므로 IndexedDB가 아닌
 * 작은 localStorage 키를 사용하고, debounce 없이 즉시 저장한다.
 */

export const VIEW_PREFS_KEY = "mindcanvas_view_prefs_v1";

export const DEFAULT_VIEW_MODE: OrganizedViewMode = "canvas";
export const DEFAULT_SORT_KEY: OrganizedSortKey = "createdDesc";

export interface ViewPrefs {
  /** boardId → 뷰 모드 */
  viewMode: Record<string, OrganizedViewMode>;
  /** boardId → 정렬 기준 */
  sortKey: Record<string, OrganizedSortKey>;
  /** boardId → (groupKey → 대표 moduleId) 수동 지정 */
  primary: Record<string, Record<string, string>>;
  /** boardId → 사용자정의 순서(정리 뷰 엔트리 key의 배열) */
  customOrder: Record<string, string[]>;
}

function emptyPrefs(): ViewPrefs {
  return { viewMode: {}, sortKey: {}, primary: {}, customOrder: {} };
}

function isViewMode(v: unknown): v is OrganizedViewMode {
  return v === "canvas" || v === "organized";
}

function isSortKey(v: unknown): v is OrganizedSortKey {
  return (
    v === "createdDesc" ||
    v === "title" ||
    v === "updatedDesc" ||
    v === "custom"
  );
}

/** localStorage에서 ViewPrefs를 읽어 검증된 형태로 반환. 없거나 손상 시 빈 기본값. */
export function loadViewPrefs(): ViewPrefs {
  if (typeof window === "undefined") return emptyPrefs();
  try {
    const raw = localStorage.getItem(VIEW_PREFS_KEY);
    if (!raw) return emptyPrefs();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyPrefs();
    const o = parsed as Record<string, unknown>;

    const viewMode: Record<string, OrganizedViewMode> = {};
    if (o.viewMode && typeof o.viewMode === "object") {
      for (const [k, v] of Object.entries(o.viewMode as Record<string, unknown>)) {
        if (isViewMode(v)) viewMode[k] = v;
      }
    }

    const sortKey: Record<string, OrganizedSortKey> = {};
    if (o.sortKey && typeof o.sortKey === "object") {
      for (const [k, v] of Object.entries(o.sortKey as Record<string, unknown>)) {
        if (isSortKey(v)) sortKey[k] = v;
      }
    }

    const primary: Record<string, Record<string, string>> = {};
    if (o.primary && typeof o.primary === "object") {
      for (const [boardId, byKey] of Object.entries(
        o.primary as Record<string, unknown>
      )) {
        if (byKey && typeof byKey === "object") {
          const inner: Record<string, string> = {};
          for (const [groupKey, moduleId] of Object.entries(
            byKey as Record<string, unknown>
          )) {
            if (typeof moduleId === "string") inner[groupKey] = moduleId;
          }
          if (Object.keys(inner).length > 0) primary[boardId] = inner;
        }
      }
    }

    const customOrder: Record<string, string[]> = {};
    if (o.customOrder && typeof o.customOrder === "object") {
      for (const [boardId, keys] of Object.entries(
        o.customOrder as Record<string, unknown>
      )) {
        if (Array.isArray(keys)) {
          const list = keys.filter((k): k is string => typeof k === "string");
          if (list.length > 0) customOrder[boardId] = list;
        }
      }
    }

    return { viewMode, sortKey, primary, customOrder };
  } catch (err) {
    console.error("[MindCanvas] Failed to load view prefs:", err);
    return emptyPrefs();
  }
}

/** ViewPrefs를 localStorage에 즉시 저장. 실패는 조용히 무시(가벼우므로 크래시 방지). */
export function saveViewPrefs(prefs: ViewPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error("[MindCanvas] Failed to save view prefs:", err);
  }
}

/** 보드의 뷰 모드 조회 (없으면 기본값) */
export function getViewMode(prefs: ViewPrefs, boardId: string): OrganizedViewMode {
  return prefs.viewMode[boardId] ?? DEFAULT_VIEW_MODE;
}

/** 보드의 정렬 기준 조회 (없으면 기본값) */
export function getSortKey(prefs: ViewPrefs, boardId: string): OrganizedSortKey {
  return prefs.sortKey[boardId] ?? DEFAULT_SORT_KEY;
}

/** 보드+그룹의 수동 대표 지정 조회 (없으면 null) */
export function getGroupPrimary(
  prefs: ViewPrefs,
  boardId: string,
  groupKey: string
): string | null {
  return prefs.primary[boardId]?.[groupKey] ?? null;
}

/** 뷰 모드 설정 후 저장. 다음 in-memory 미러로 쓸 새 ViewPrefs를 반환한다. */
export function setViewModePref(
  prefs: ViewPrefs,
  boardId: string,
  mode: OrganizedViewMode
): ViewPrefs {
  const next: ViewPrefs = {
    ...prefs,
    viewMode: { ...prefs.viewMode, [boardId]: mode },
  };
  saveViewPrefs(next);
  return next;
}

/** 정렬 기준 설정 후 저장. */
export function setSortKeyPref(
  prefs: ViewPrefs,
  boardId: string,
  key: OrganizedSortKey
): ViewPrefs {
  const next: ViewPrefs = {
    ...prefs,
    sortKey: { ...prefs.sortKey, [boardId]: key },
  };
  saveViewPrefs(next);
  return next;
}

/** 보드의 사용자정의 순서 조회 (없으면 빈 배열) */
export function getCustomOrder(prefs: ViewPrefs, boardId: string): string[] {
  return prefs.customOrder[boardId] ?? [];
}

/** 사용자정의 순서 설정 후 저장. */
export function setCustomOrderPref(
  prefs: ViewPrefs,
  boardId: string,
  order: string[]
): ViewPrefs {
  const next: ViewPrefs = {
    ...prefs,
    customOrder: { ...prefs.customOrder, [boardId]: order },
  };
  saveViewPrefs(next);
  return next;
}

/** 그룹 대표 수동 지정 후 저장. */
export function setGroupPrimaryPref(
  prefs: ViewPrefs,
  boardId: string,
  groupKey: string,
  moduleId: string
): ViewPrefs {
  const next: ViewPrefs = {
    ...prefs,
    primary: {
      ...prefs.primary,
      [boardId]: { ...(prefs.primary[boardId] ?? {}), [groupKey]: moduleId },
    },
  };
  saveViewPrefs(next);
  return next;
}
