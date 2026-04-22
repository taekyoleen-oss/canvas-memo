import type { BoardCategory } from "@/types";

export const SIDEBAR_CATEGORY_COLLAPSE_KEY = "mindcanvas-sidebar-category-collapsed";

export type CategoryCollapseState = Record<BoardCategory, boolean>;

const defaultState: CategoryCollapseState = {
  memo_schedule: false,
  thinking: false,
};

export function loadCategoryCollapse(): CategoryCollapseState {
  if (typeof window === "undefined") return { ...defaultState };
  try {
    const raw = window.localStorage.getItem(SIDEBAR_CATEGORY_COLLAPSE_KEY);
    if (!raw) return { ...defaultState };
    const p = JSON.parse(raw) as Partial<Record<BoardCategory, boolean>>;
    return {
      memo_schedule: !!p.memo_schedule,
      thinking: !!p.thinking,
    };
  } catch {
    return { ...defaultState };
  }
}

export function saveCategoryCollapse(state: CategoryCollapseState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SIDEBAR_CATEGORY_COLLAPSE_KEY,
      JSON.stringify({
        memo_schedule: state.memo_schedule,
        thinking: state.thinking,
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}
