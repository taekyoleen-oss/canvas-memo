import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { Board, Module, Connection } from "@/types";
import { loadAppData, createDebouncedSave } from "@/lib/storage";

interface CanvasStore {
  boards: Board[];
  activeBoardId: string | null;

  // 보드 CRUD
  addBoard(
    board: Omit<
      Board,
      "id" | "createdAt" | "updatedAt" | "modules" | "connections" | "viewport"
    >
  ): void;
  removeBoard(boardId: string): void;
  updateBoard(boardId: string, updates: Partial<Omit<Board, "id">>): void;
  setActiveBoard(boardId: string): void;

  // 모듈 CRUD
  addModule(
    boardId: string,
    module: Omit<Module, "id" | "createdAt" | "updatedAt">
  ): void;
  removeModule(boardId: string, moduleId: string): void;
  updateModule(
    boardId: string,
    moduleId: string,
    updates: Partial<Module>
  ): void;
  duplicateModule(boardId: string, moduleId: string): void;

  // 커넥션 CRUD
  addConnection(boardId: string, connection: Omit<Connection, "id">): void;
  removeConnection(boardId: string, connectionId: string): void;

  // 뷰포트
  updateViewport(boardId: string, viewport: Board["viewport"]): void;

  // 스토어 초기화 (localStorage에서 로드)
  hydrate(): void;
}

// 자동저장 함수 (스토어 외부에서 debounce 인스턴스 유지)
let debouncedSave: (() => void) | null = null;

function getTimestamp(): string {
  return new Date().toISOString();
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  boards: [],
  activeBoardId: null,

  hydrate() {
    const appData = loadAppData();
    if (!appData) return;

    set({
      boards: appData.boards ?? [],
      activeBoardId: appData.lastOpenedBoardId ?? null,
    });

    // debounced save 초기화
    debouncedSave = createDebouncedSave(() => {
      const state = get();
      return {
        version: 1,
        theme: "system",
        boards: state.boards,
        lastOpenedBoardId: state.activeBoardId,
      };
    });
  },

  // ─── 보드 CRUD ───────────────────────────────────────────────────────────

  addBoard(boardInput) {
    const now = getTimestamp();
    const newBoard: Board = {
      ...boardInput,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      modules: [],
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    set((state) => ({
      boards: [...state.boards, newBoard],
      activeBoardId: newBoard.id,
    }));

    debouncedSave?.();
  },

  removeBoard(boardId) {
    set((state) => {
      const newBoards = state.boards.filter((b) => b.id !== boardId);
      const newActiveBoardId =
        state.activeBoardId === boardId
          ? (newBoards[newBoards.length - 1]?.id ?? null)
          : state.activeBoardId;

      return { boards: newBoards, activeBoardId: newActiveBoardId };
    });

    debouncedSave?.();
  },

  updateBoard(boardId, updates) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? { ...b, ...updates, updatedAt: getTimestamp() }
          : b
      ),
    }));

    debouncedSave?.();
  },

  setActiveBoard(boardId) {
    set({ activeBoardId: boardId });
    debouncedSave?.();
  },

  // ─── 모듈 CRUD ───────────────────────────────────────────────────────────

  addModule(boardId, moduleInput) {
    const now = getTimestamp();
    const newModule: Module = {
      ...moduleInput,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              modules: [...b.modules, newModule],
              updatedAt: getTimestamp(),
            }
          : b
      ),
    }));

    debouncedSave?.();
  },

  removeModule(boardId, moduleId) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              modules: b.modules.filter((m) => m.id !== moduleId),
              // 해당 모듈과 연결된 커넥션도 함께 제거
              connections: b.connections.filter(
                (c) =>
                  c.fromModuleId !== moduleId && c.toModuleId !== moduleId
              ),
              updatedAt: getTimestamp(),
            }
          : b
      ),
    }));

    debouncedSave?.();
  },

  updateModule(boardId, moduleId, updates) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              modules: b.modules.map((m) =>
                m.id === moduleId
                  ? { ...m, ...updates, updatedAt: getTimestamp() }
                  : m
              ),
              updatedAt: getTimestamp(),
            }
          : b
      ),
    }));

    debouncedSave?.();
  },

  duplicateModule(boardId, moduleId) {
    set((state) => {
      const board = state.boards.find((b) => b.id === boardId);
      if (!board) return state;

      const source = board.modules.find((m) => m.id === moduleId);
      if (!source) return state;

      const now = getTimestamp();
      const maxZIndex = board.modules.reduce(
        (max, m) => Math.max(max, m.zIndex),
        0
      );

      const duplicate: Module = {
        ...source,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        position: {
          x: source.position.x + 20,
          y: source.position.y + 20,
        },
        zIndex: maxZIndex + 1,
        data: JSON.parse(JSON.stringify(source.data)), // 깊은 복사
      };

      return {
        boards: state.boards.map((b) =>
          b.id === boardId
            ? {
                ...b,
                modules: [...b.modules, duplicate],
                updatedAt: getTimestamp(),
              }
            : b
        ),
      };
    });

    debouncedSave?.();
  },

  // ─── 커넥션 CRUD ─────────────────────────────────────────────────────────

  addConnection(boardId, connectionInput) {
    const newConnection: Connection = {
      ...connectionInput,
      id: uuidv4(),
    };

    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              connections: [...b.connections, newConnection],
              updatedAt: getTimestamp(),
            }
          : b
      ),
    }));

    debouncedSave?.();
  },

  removeConnection(boardId, connectionId) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              connections: b.connections.filter((c) => c.id !== connectionId),
              updatedAt: getTimestamp(),
            }
          : b
      ),
    }));

    debouncedSave?.();
  },

  // ─── 뷰포트 ──────────────────────────────────────────────────────────────

  updateViewport(boardId, viewport) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId ? { ...b, viewport } : b
      ),
    }));

    debouncedSave?.();
  },
}));
