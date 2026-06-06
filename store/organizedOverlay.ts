import { create } from "zustand";
import type { DisplayEntry } from "@/types";

/**
 * 정리 뷰 오버레이(그룹 확장 팝업 / 모듈 편집 오버레이) 상태.
 *
 * page.tsx 의 popstate(뒤로가기) 우선순위 스택이 prop drilling 없이
 * 이 상태를 읽고 위에서부터 닫을 수 있도록 별도 스토어로 둔다.
 */
interface OrganizedOverlayState {
  /** 그룹 확장 팝업 대상(없으면 닫힘) */
  expandedEntry: DisplayEntry | null;
  /** 편집 오버레이 대상 moduleId(없으면 닫힘) */
  editingModuleId: string | null;

  openGroup(entry: DisplayEntry): void;
  closeGroup(): void;
  openEditor(moduleId: string): void;
  closeEditor(): void;
  closeAll(): void;
}

export const useOrganizedOverlayStore = create<OrganizedOverlayState>((set) => ({
  expandedEntry: null,
  editingModuleId: null,

  openGroup: (entry) => set({ expandedEntry: entry }),
  closeGroup: () => set({ expandedEntry: null }),
  openEditor: (moduleId) => set({ editingModuleId: moduleId }),
  closeEditor: () => set({ editingModuleId: null }),
  closeAll: () => set({ expandedEntry: null, editingModuleId: null }),
}));
