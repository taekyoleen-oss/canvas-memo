import { create } from "zustand";
import type { Connection } from "@/types";
import { useCanvasStore } from "./canvas";
import { moduleColorToConnectionHex } from "@/lib/moduleColorHex";

interface ConnectionStore {
  mode: "idle" | "connecting";
  fromModuleId: string | null;
  fromAnchor: Connection["fromAnchor"] | null;
  previewPos: { x: number; y: number } | null;

  /** 드래그 중인 소스 모듈 ID — 앵커 렌더링 유지용 */
  dragSourceModuleId: string | null;

  startConnecting(moduleId: string, anchor: Connection["fromAnchor"]): void;
  finishConnecting(toModuleId: string, toAnchor: Connection["toAnchor"]): void;
  cancelConnecting(): void;
  updatePreviewPos(pos: { x: number; y: number }): void;
  setDragSource(moduleId: string): void;
  clearDragSource(): void;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  mode: "idle",
  fromModuleId: null,
  fromAnchor: null,
  previewPos: null,
  dragSourceModuleId: null,

  startConnecting(moduleId, anchor) {
    set({
      mode: "connecting",
      fromModuleId: moduleId,
      fromAnchor: anchor,
      previewPos: null,
    });
  },

  finishConnecting(toModuleId, toAnchor) {
    const { fromModuleId, fromAnchor } = get();

    if (!fromModuleId || !fromAnchor) {
      set({ mode: "idle", fromModuleId: null, fromAnchor: null, previewPos: null, dragSourceModuleId: null });
      return;
    }

    if (fromModuleId === toModuleId) {
      set({ mode: "idle", fromModuleId: null, fromAnchor: null, previewPos: null, dragSourceModuleId: null });
      return;
    }

    const activeBoardId = useCanvasStore.getState().activeBoardId;
    if (activeBoardId) {
      const board = useCanvasStore
        .getState()
        .boards.find((b) => b.id === activeBoardId);
      const fromMod = board?.modules.find((m) => m.id === fromModuleId);
      const strokeColor = fromMod
        ? moduleColorToConnectionHex(fromMod.color)
        : "#94a3b8";
      useCanvasStore.getState().addConnection(activeBoardId, {
        fromModuleId,
        toModuleId,
        fromAnchor,
        toAnchor,
        label: "",
        style: "solid",
        color: strokeColor,
        pathStyle: "bezier",
      });
    }

    set({ mode: "idle", fromModuleId: null, fromAnchor: null, previewPos: null, dragSourceModuleId: null });
  },

  cancelConnecting() {
    set({ mode: "idle", fromModuleId: null, fromAnchor: null, previewPos: null, dragSourceModuleId: null });
  },

  updatePreviewPos(pos) {
    set({ previewPos: pos });
  },

  setDragSource(moduleId) {
    set({ dragSourceModuleId: moduleId });
  },

  clearDragSource() {
    set({ dragSourceModuleId: null });
  },
}));
