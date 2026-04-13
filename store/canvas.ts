import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { Board, Module, Connection, Group } from "@/types";
import { loadAppData, createDebouncedSave } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

interface CanvasStore {
  boards: Board[];
  activeBoardId: string | null;

  // 보드 CRUD
  addBoard(
    board: Omit<
      Board,
      "id" | "createdAt" | "updatedAt" | "modules" | "connections" | "groups" | "viewport"
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

  // 그룹 CRUD
  addGroup(boardId: string, group: Omit<Group, "id" | "createdAt" | "updatedAt">): void;
  removeGroup(boardId: string, groupId: string): void;
  updateGroup(boardId: string, groupId: string, updates: Partial<Group>): void;

  // 그룹 포커스 (사이드바 → 캔버스 네비게이션)
  focusGroupId: string | null;
  setFocusGroup(groupId: string | null): void;

  // 뷰포트
  updateViewport(boardId: string, viewport: Board["viewport"]): void;

  // 초기화
  hydrate(): void;
  // Supabase에서 유저 데이터 로드 (로그인 후 호출)
  hydrateFromSupabase(userId: string): Promise<void>;
  // Supabase에 전체 상태 업서트 (필요 시 수동 호출)
  syncToSupabase(userId: string): Promise<void>;
}

let debouncedSave: (() => void) | null = null;
let debouncedSupabaseSync: (() => void) | null = null;

function getTimestamp(): string {
  return new Date().toISOString();
}

// ── Supabase 동기화 헬퍼 ─────────────────────────────────────────────────

async function pushBoardToSupabase(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  board: Board
) {
  // boards upsert
  await supabase.from("boards").upsert({
    id: board.id,
    user_id: userId,
    name: board.name,
    icon: board.icon,
    color: board.color,
    viewport: board.viewport,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  });

  // modules upsert
  if (board.modules.length > 0) {
    await supabase.from("modules").upsert(
      board.modules.map((m) => ({
        id: m.id,
        board_id: board.id,
        user_id: userId,
        type: m.type,
        position: m.position,
        size: m.size,
        z_index: m.zIndex,
        color: m.color,
        is_expanded: m.isExpanded,
        data: m.data,
        created_at: m.createdAt,
        updated_at: m.updatedAt,
      }))
    );
  }

  // connections upsert
  if (board.connections.length > 0) {
    await supabase.from("connections").upsert(
      board.connections.map((c) => ({
        id: c.id,
        board_id: board.id,
        user_id: userId,
        from_module_id: c.fromModuleId,
        to_module_id: c.toModuleId,
        from_anchor: c.fromAnchor,
        to_anchor: c.toAnchor,
        label: c.label,
        style: c.style,
        color: c.color,
      }))
    );
  }
}

// ── 스토어 ───────────────────────────────────────────────────────────────

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  boards: [],
  activeBoardId: null,
  focusGroupId: null,

  hydrate() {
    const appData = loadAppData();
    if (!appData) return;

    // 기존 데이터에 groups 필드가 없으면 빈 배열로 보정
    const boards = (appData.boards ?? []).map((b) => ({
      ...b,
      groups: (b as Board & { groups?: Group[] }).groups ?? [],
    }));

    set({
      boards,
      activeBoardId: appData.lastOpenedBoardId ?? null,
    });

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

  async hydrateFromSupabase(userId: string) {
    const supabase = createClient();

    const { data: boardRows } = await supabase
      .from("boards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!boardRows || boardRows.length === 0) {
      // 로그인 첫 사용: localStorage 데이터를 Supabase로 마이그레이션
      const state = get();
      if (state.boards.length > 0) {
        await get().syncToSupabase(userId);
      }
      return;
    }

    const { data: moduleRows } = await supabase
      .from("modules")
      .select("*")
      .eq("user_id", userId);

    const { data: connectionRows } = await supabase
      .from("connections")
      .select("*")
      .eq("user_id", userId);

    const boards: Board[] = boardRows.map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      color: b.color,
      viewport: b.viewport as Board["viewport"],
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      modules: (moduleRows ?? [])
        .filter((m) => m.board_id === b.id)
        .map((m) => ({
          id: m.id,
          type: m.type as Module["type"],
          position: m.position as Module["position"],
          size: m.size as Module["size"],
          zIndex: m.z_index,
          color: m.color as Module["color"],
          isExpanded: m.is_expanded,
          data: m.data as Module["data"],
          createdAt: m.created_at,
          updatedAt: m.updated_at,
        })),
      connections: (connectionRows ?? [])
        .filter((c) => c.board_id === b.id)
        .map((c) => ({
          id: c.id,
          fromModuleId: c.from_module_id,
          toModuleId: c.to_module_id,
          fromAnchor: c.from_anchor as Connection["fromAnchor"],
          toAnchor: c.to_anchor as Connection["toAnchor"],
          label: c.label,
          style: c.style as Connection["style"],
          color: c.color,
        })),
      groups: [],
    }));

    set({
      boards,
      activeBoardId: boards[0]?.id ?? null,
    });

    // Supabase 기준 데이터로 localStorage도 갱신
    debouncedSave?.();
  },

  async syncToSupabase(userId: string) {
    const supabase = createClient();
    const { boards } = get();
    for (const board of boards) {
      await pushBoardToSupabase(supabase, userId, board);
    }
  },

  // ─── 보드 CRUD ─────────────────────────────────────────────────────────

  setFocusGroup(groupId) {
    set({ focusGroupId: groupId });
  },

  addBoard(boardInput) {
    const now = getTimestamp();
    const newBoard: Board = {
      ...boardInput,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      modules: [],
      connections: [],
      groups: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    set((state) => ({
      boards: [...state.boards, newBoard],
      activeBoardId: newBoard.id,
    }));

    debouncedSave?.();
    debouncedSupabaseSync?.();
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
    // 삭제는 즉시 처리 (RLS cascade가 처리)
    createClient().from("boards").delete().eq("id", boardId).then(() => {});
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
    debouncedSupabaseSync?.();
  },

  setActiveBoard(boardId) {
    set({ activeBoardId: boardId });
    debouncedSave?.();
  },

  // ─── 모듈 CRUD ─────────────────────────────────────────────────────────

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
    debouncedSupabaseSync?.();
  },

  removeModule(boardId, moduleId) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              modules: b.modules.filter((m) => m.id !== moduleId),
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
    createClient().from("modules").delete().eq("id", moduleId).then(() => {});
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
    debouncedSupabaseSync?.();
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
        data: JSON.parse(JSON.stringify(source.data)),
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
    debouncedSupabaseSync?.();
  },

  // ─── 커넥션 CRUD ───────────────────────────────────────────────────────

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
    debouncedSupabaseSync?.();
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
    createClient().from("connections").delete().eq("id", connectionId).then(() => {});
  },

  // ─── 그룹 CRUD ─────────────────────────────────────────────────────────

  addGroup(boardId, groupInput) {
    const now = getTimestamp();
    const newGroup: Group = { ...groupInput, id: uuidv4(), createdAt: now, updatedAt: now };
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? { ...b, groups: [...(b.groups ?? []), newGroup], updatedAt: now }
          : b
      ),
    }));
    debouncedSave?.();
  },

  removeGroup(boardId, groupId) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? { ...b, groups: (b.groups ?? []).filter((g) => g.id !== groupId), updatedAt: getTimestamp() }
          : b
      ),
    }));
    debouncedSave?.();
  },

  updateGroup(boardId, groupId, updates) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              groups: (b.groups ?? []).map((g) =>
                g.id === groupId ? { ...g, ...updates, updatedAt: getTimestamp() } : g
              ),
              updatedAt: getTimestamp(),
            }
          : b
      ),
    }));
    debouncedSave?.();
  },

  // ─── 뷰포트 ────────────────────────────────────────────────────────────

  updateViewport(boardId, viewport) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId ? { ...b, viewport } : b
      ),
    }));

    debouncedSave?.();
    debouncedSupabaseSync?.();
  },
}));

// ── Supabase debounced sync 초기화 (유저 로그인 시 호출) ─────────────────

export function initSupabaseSync(userId: string) {
  debouncedSupabaseSync = debounce(() => {
    useCanvasStore.getState().syncToSupabase(userId);
  }, 1000);
}

function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
