import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  Board,
  Module,
  Connection,
  Group,
  BoardCategory,
  ExpandAdjacentModuleOptions,
  BrainstormMapType,
  MemoData,
  BrainstormData,
} from "@/types";
import { buildCanvasMapTemplate } from "@/lib/canvas/mapTemplates";
import { BRAINSTORM_MAP_OPTIONS } from "@/lib/brainstormMapMeta";
import { findMapToolDef } from "@/lib/canvas/mapTemplateTools";
import { moduleColorToConnectionHex } from "@/lib/moduleColorHex";
import { buildTemplateData } from "@/lib/moduleTemplates";
import { nextSidebarOrder, normalizeBoardCategory } from "@/lib/boardCategory";
import { isModuleTypeAllowedOnBoard } from "@/lib/boardModulePolicy";
import {
  loadAppData,
  loadAppDataForUser,
  createDebouncedSave,
  saveAppData,
} from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import type { AnchorSide } from "@/lib/canvas/geometry";

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
  reorderBoardsInCategory(
    category: BoardCategory,
    fromIndex: number,
    toIndex: number
  ): void;

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
  /** 메모·브레인스토밍: 방향 화살표로 인접 모듈 생성 + 연결 (한 번에 undo) */
  expandAdjacentModule(
    boardId: string,
    sourceModuleId: string,
    direction: AnchorSide,
    options?: ExpandAdjacentModuleOptions
  ): string | null;
  /** 맵 템플릿: 여러 모듈 + 연결을 한 번에 추가 (실행취소 1회) */
  applyMapTemplate(
    boardId: string,
    templateId: BrainstormMapType,
    origin: { x: number; y: number }
  ): void;
  /** 맵 템플릿 그룹: 피벗 기준 균일 확대·축소 (실행취소 1회) */
  scaleMapTemplateGroup(boardId: string, groupId: string, factor: number): void;
  /** 맵 템플릿 그룹에 템플릿 도구로 모듈 추가 (실행취소 1회) */
  appendMapToolModule(boardId: string, groupId: string, toolId: string): void;

  // 커넥션 CRUD
  addConnection(boardId: string, connection: Omit<Connection, "id">): void;
  removeConnection(boardId: string, connectionId: string): void;
  updateConnection(
    boardId: string,
    connectionId: string,
    updates: Partial<
      Pick<Connection, "label" | "style" | "color" | "fromAnchor" | "toAnchor" | "pathStyle">
    >
  ): void;

  // 그룹 CRUD
  addGroup(boardId: string, group: Omit<Group, "id" | "createdAt" | "updatedAt">): void;
  removeGroup(boardId: string, groupId: string): void;
  updateGroup(boardId: string, groupId: string, updates: Partial<Group>): void;

  // 그룹 초대 (연결 생성 시)
  pendingGroupInvite: {
    groupId: string;
    groupName: string;
    candidateModuleId: string;
    boardId: string;
  } | null;
  clearGroupInvite(): void;

  // 그룹 포커스 (사이드바 → 캔버스 네비게이션)
  focusGroupId: string | null;
  setFocusGroup(groupId: string | null): void;

  // 모듈 포커스 (검색 → 캔버스 네비게이션)
  focusModuleId: string | null;
  setFocusModule(moduleId: string | null): void;

  // 실행취소 히스토리
  _history: Board[][];
  pushHistory(): void;
  undo(): void;

  // 뷰포트
  updateViewport(boardId: string, viewport: Board["viewport"]): void;

  // 초기화 (로그인한 사용자 id 기준 로컬 캐시 + 이후 Supabase)
  hydrateForUser(userId: string): void;
  /** 로그아웃 시 메모리·디바운스 저장기 정리 */
  resetForLogout(): void;
  // Supabase에서 유저 데이터 로드 (로그인 후 호출)
  hydrateFromSupabase(userId: string): Promise<void>;
  // Supabase에 전체 상태 업서트 (필요 시 수동 호출)
  syncToSupabase(userId: string): Promise<void>;
}

let debouncedSave: (() => void) | null = null;
let debouncedSupabaseSync: (() => void) | null = null;

/** 레거시 공용 키의 보드를 한 번만 현재 계정으로 옮김 (동일 브라우저 다계정 오염 방지) */
const LEGACY_CANVAS_MIGRATED_FLAG = "mindcanvas_v1_legacy_canvas_migrated";

function getTimestamp(): string {
  return new Date().toISOString();
}

function bboxOfModules(modules: Module[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of modules) {
    minX = Math.min(minX, m.position.x);
    minY = Math.min(minY, m.position.y);
    maxX = Math.max(maxX, m.position.x + m.size.width);
    maxY = Math.max(maxY, m.position.y + m.size.height);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
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
    board_category: board.category ?? "memo_schedule",
    sidebar_order: board.sidebarOrder ?? 0,
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
        is_minimized: m.isMinimized ?? false,
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

  // groups upsert
  const groups = board.groups ?? [];
  if (groups.length > 0) {
    await supabase.from("groups").upsert(
      groups.map((g) => ({
        id: g.id,
        board_id: board.id,
        user_id: userId,
        name: g.name,
        module_ids: g.moduleIds,
        position: g.position,
        size: g.size,
        color: g.color,
        is_collapsed: g.isCollapsed,
        created_at: g.createdAt,
        updated_at: g.updatedAt,
        map_template_id: g.mapTemplateId ?? null,
        map_pivot: g.mapPivot ?? null,
        map_scale: g.mapScale ?? null,
      }))
    );
  }

  // DB에서 삭제된 그룹 제거 (현재 목록에 없는 것)
  if (groups.length > 0) {
    await supabase
      .from("groups")
      .delete()
      .eq("board_id", board.id)
      .not("id", "in", `(${groups.map((g) => g.id).join(",")})`);
  } else {
    // 그룹이 하나도 없으면 이 보드의 모든 그룹 삭제
    await supabase.from("groups").delete().eq("board_id", board.id);
  }
}

// ── 스토어 ───────────────────────────────────────────────────────────────

const HISTORY_LIMIT = 30;

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  boards: [],
  activeBoardId: null,
  focusGroupId: null,
  focusModuleId: null,
  pendingGroupInvite: null,
  _history: [],

  hydrateForUser(userId: string) {
    let appData = loadAppDataForUser(userId);

    if (
      !appData &&
      typeof window !== "undefined" &&
      localStorage.getItem(LEGACY_CANVAS_MIGRATED_FLAG) !== "1"
    ) {
      const legacy = loadAppData();
      if (legacy && legacy.boards.length > 0) {
        appData = legacy;
        localStorage.setItem(LEGACY_CANVAS_MIGRATED_FLAG, "1");
        saveAppData({
          version: legacy.version,
          theme: legacy.theme,
          boards: [],
          lastOpenedBoardId: null,
        });
      }
    }

    if (!appData) {
      set({
        boards: [],
        activeBoardId: null,
        focusGroupId: null,
        focusModuleId: null,
        pendingGroupInvite: null,
        _history: [],
      });
      debouncedSave = createDebouncedSave(() => {
        const state = get();
        const prev = loadAppDataForUser(userId);
        return {
          version: 1,
          theme: prev?.theme ?? "system",
          boards: state.boards,
          lastOpenedBoardId: state.activeBoardId,
        };
      }, userId);
      return;
    }

    // groups 필드 보정 + 보드 카테고리·순서
    const raw = appData.boards ?? [];
    let memoOrd = 0;
    let thinkOrd = 0;
    const boards: Board[] = raw.map((b) => {
      const bb = b as Board & { groups?: Group[] };
      const category = bb.category ?? "memo_schedule";
      const sidebarOrder =
        typeof bb.sidebarOrder === "number"
          ? bb.sidebarOrder
          : category === "thinking"
            ? thinkOrd++
            : memoOrd++;
      return {
        ...bb,
        groups: bb.groups ?? [],
        category,
        sidebarOrder,
      };
    });

    // 마지막 열었던 보드 복원 (보드가 실제로 존재하는지 확인)
    const savedId = appData.lastOpenedBoardId;
    const activeBoardId =
      (savedId && boards.find((b) => b.id === savedId))
        ? savedId
        : boards[0]?.id ?? null;

    set({ boards, activeBoardId });

    debouncedSave = createDebouncedSave(() => {
      const state = get();
      const prev = loadAppDataForUser(userId);
      return {
        version: 1,
        theme: prev?.theme ?? "system",
        boards: state.boards,
        lastOpenedBoardId: state.activeBoardId,
      };
    }, userId);
  },

  resetForLogout() {
    debouncedSave = null;
    debouncedSupabaseSync = null;
    set({
      boards: [],
      activeBoardId: null,
      focusGroupId: null,
      focusModuleId: null,
      pendingGroupInvite: null,
      _history: [],
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

    const { data: groupRows } = await supabase
      .from("groups")
      .select("*")
      .eq("user_id", userId);

    const boards: Board[] = boardRows.map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      color: b.color,
      category:
        (b as { board_category?: string }).board_category === "thinking"
          ? "thinking"
          : "memo_schedule",
      sidebarOrder:
        typeof (b as { sidebar_order?: number }).sidebar_order === "number"
          ? (b as { sidebar_order: number }).sidebar_order
          : 0,
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
          zIndex: typeof m.z_index === "number" ? m.z_index : 0,
          color: m.color as Module["color"],
          isExpanded: m.is_expanded,
          isMinimized: m.is_minimized ?? false,
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
      groups: (groupRows ?? [])
        .filter((g) => g.board_id === b.id)
        .map((g) => {
          const row = g as {
            map_template_id?: string | null;
            map_pivot?: { x: number; y: number } | null;
            map_scale?: number | null;
          };
          const mt = row.map_template_id;
          return {
            id: g.id,
            name: g.name,
            moduleIds: g.module_ids as string[],
            position: g.position as Group["position"],
            size: g.size as Group["size"],
            color: g.color as Group["color"],
            isCollapsed: g.is_collapsed,
            createdAt: g.created_at,
            updatedAt: g.updated_at,
            ...(mt
              ? {
                  mapTemplateId: mt as BrainstormMapType,
                  mapPivot: row.map_pivot ?? undefined,
                  mapScale:
                    typeof row.map_scale === "number" && row.map_scale > 0
                      ? row.map_scale
                      : undefined,
                }
              : {}),
          } satisfies Group;
        }),
    }));

    // 현재 선택된 보드를 유지 (없으면 첫 번째 보드)
    const currentActiveBoardId = get().activeBoardId;
    const restoredId =
      (currentActiveBoardId && boards.find((b) => b.id === currentActiveBoardId))
        ? currentActiveBoardId
        : boards[0]?.id ?? null;

    set({
      boards,
      activeBoardId: restoredId,
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

  clearGroupInvite() {
    set({ pendingGroupInvite: null });
  },

  setFocusGroup(groupId) {
    set({ focusGroupId: groupId });
  },

  setFocusModule(moduleId) {
    set({ focusModuleId: moduleId });
  },

  pushHistory() {
    const { boards, _history } = get();
    const snapshot = JSON.parse(JSON.stringify(boards)) as Board[];
    const next = [..._history, snapshot];
    if (next.length > HISTORY_LIMIT) next.shift();
    set({ _history: next });
  },

  undo() {
    const { _history } = get();
    if (_history.length === 0) return;
    const prev = _history[_history.length - 1];
    const next = _history.slice(0, -1);
    set({ boards: prev, _history: next });
    debouncedSave?.();
    debouncedSupabaseSync?.();
  },

  reorderBoardsInCategory(category, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    set((state) => {
      const catBoards = state.boards
        .filter((b) => normalizeBoardCategory(b) === category)
        .sort((a, b) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0));
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= catBoards.length ||
        toIndex >= catBoards.length
      ) {
        return state;
      }
      const arr = [...catBoards];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      const orderMap = new Map(arr.map((b, i) => [b.id, i]));
      return {
        boards: state.boards.map((b) =>
          orderMap.has(b.id) ? { ...b, sidebarOrder: orderMap.get(b.id)! } : b
        ),
      };
    });
    debouncedSave?.();
    debouncedSupabaseSync?.();
  },

  addBoard(boardInput) {
    const now = getTimestamp();
    const category = boardInput.category ?? "memo_schedule";
    const sidebarOrder =
      typeof boardInput.sidebarOrder === "number"
        ? boardInput.sidebarOrder
        : nextSidebarOrder(get().boards, category);
    const newBoard: Board = {
      ...boardInput,
      category,
      sidebarOrder,
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
    const board = get().boards.find((b) => b.id === boardId);
    if (board && !isModuleTypeAllowedOnBoard(moduleInput.type, board)) return;

    get().pushHistory();
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
    get().pushHistory();
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
      if (!isModuleTypeAllowedOnBoard(source.type, board)) return state;

      const now = getTimestamp();
      const maxZIndex = board.modules.reduce(
        (max, m) => Math.max(max, Number(m.zIndex) || 0),
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

  expandAdjacentModule(boardId, sourceModuleId, direction, options) {
    const state = get();
    const board = state.boards.find((b) => b.id === boardId);
    const source = board?.modules.find((m) => m.id === sourceModuleId);
    if (!board || !source) return null;
    if (source.type !== "memo" && source.type !== "brainstorm") return null;

    get().pushHistory();

    const moduleShape = options?.moduleShape ?? "rounded";
    const pathStyle = options?.pathStyle ?? "bezier";

    const GAP = 56;
    const nw = 260;
    const nh = Math.round(
      Math.min(480, Math.max(140, source.size.height < 100 ? 200 : source.size.height))
    );

    const { position: p, size: s } = source;
    let nx = p.x;
    let ny = p.y;
    let fromA: Connection["fromAnchor"];
    let toA: Connection["toAnchor"];

    switch (direction) {
      case "right":
        nx = p.x + s.width + GAP;
        ny = p.y + (s.height - nh) / 2;
        fromA = "right";
        toA = "left";
        break;
      case "left":
        nx = p.x - nw - GAP;
        ny = p.y + (s.height - nh) / 2;
        fromA = "left";
        toA = "right";
        break;
      case "bottom":
        nx = p.x + (s.width - nw) / 2;
        ny = p.y + s.height + GAP;
        fromA = "bottom";
        toA = "top";
        break;
      case "top":
        nx = p.x + (s.width - nw) / 2;
        ny = p.y - nh - GAP;
        fromA = "top";
        toA = "bottom";
        break;
    }

    const now = getTimestamp();
    const newId = uuidv4();
    const maxZ = board.modules.reduce(
      (a, m) => Math.max(a, Number(m.zIndex) || 0),
      0
    );

    const data =
      source.type === "memo"
        ? buildTemplateData("memo", options?.templateId)
        : buildTemplateData("brainstorm", options?.templateId);

    const newModule: Module = {
      id: newId,
      type: source.type,
      position: { x: Math.round(nx), y: Math.round(ny) },
      size: { width: nw, height: nh },
      zIndex: maxZ + 1,
      color: source.color,
      shape: moduleShape,
      isExpanded: false,
      isMinimized: false,
      data: data as Module["data"],
      createdAt: now,
      updatedAt: now,
    };

    const newConnection: Connection = {
      id: uuidv4(),
      fromModuleId: sourceModuleId,
      toModuleId: newId,
      fromAnchor: fromA,
      toAnchor: toA,
      label: "",
      style: "solid",
      color: moduleColorToConnectionHex(source.color),
      pathStyle,
    };

    const groups = board.groups ?? [];
    const fromGroup = groups.find((g) => g.moduleIds.includes(sourceModuleId));
    let pendingGroupInvite: CanvasStore["pendingGroupInvite"] = null;
    if (fromGroup && !fromGroup.moduleIds.includes(newId)) {
      pendingGroupInvite = {
        groupId: fromGroup.id,
        groupName: fromGroup.name,
        candidateModuleId: newId,
        boardId,
      };
    }

    set((st) => ({
      boards: st.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              modules: [...b.modules, newModule],
              connections: [...b.connections, newConnection],
              updatedAt: getTimestamp(),
            }
          : b
      ),
      pendingGroupInvite,
    }));

    debouncedSave?.();
    debouncedSupabaseSync?.();
    return newId;
  },

  applyMapTemplate(boardId, templateId, origin) {
    const def = buildCanvasMapTemplate(templateId);
    if (!def.cells.length) return;

    const boardPre = get().boards.find((b) => b.id === boardId);
    if (!boardPre || normalizeBoardCategory(boardPre) !== "thinking") return;

    get().pushHistory();
    const board = get().boards.find((b) => b.id === boardId);
    if (!board) return;

    const now = getTimestamp();
    const maxZ = board.modules.reduce(
      (a, m) => Math.max(a, Number(m.zIndex) || 0),
      0
    );

    const ids: string[] = [];
    const newModules: Module[] = def.cells.map((cell, i) => {
      const id = uuidv4();
      ids.push(id);
      const data =
        cell.type === "memo"
          ? ({
              title: cell.memoTitle ?? "메모",
              content: cell.memoContent ?? "",
              previewLines: 2,
            } satisfies MemoData)
          : ({
              title: cell.brainTitle ?? "브레인스토밍",
              items: [],
              previewCount: 4,
              itemLinks: [],
            } satisfies BrainstormData);

      const mod: Module = {
        id,
        type: cell.type,
        position: {
          x: Math.round(origin.x + cell.relX),
          y: Math.round(origin.y + cell.relY),
        },
        size: { width: cell.width, height: cell.height },
        zIndex: maxZ + 1 + i,
        color: cell.color,
        isExpanded: cell.isExpanded ?? cell.type === "brainstorm",
        isMinimized: false,
        data,
        createdAt: now,
        updatedAt: now,
      };
      if (cell.shape) mod.shape = cell.shape;
      return mod;
    });

    const newConnections: Connection[] = def.connections.map((c) => {
      const fromMod = newModules[c.from];
      return {
        id: uuidv4(),
        fromModuleId: ids[c.from]!,
        toModuleId: ids[c.to]!,
        fromAnchor: c.fromAnchor,
        toAnchor: c.toAnchor,
        label: c.label ?? "",
        style: "solid",
        color: fromMod
          ? moduleColorToConnectionHex(fromMod.color)
          : "#94a3b8",
        pathStyle: c.pathStyle,
      };
    });

    const bb = bboxOfModules(newModules);
    const pivot = {
      x: (bb.minX + bb.maxX) / 2,
      y: (bb.minY + bb.maxY) / 2,
    };
    const PAD = 20;
    const groupLabel =
      BRAINSTORM_MAP_OPTIONS.find((o) => o.id === templateId)?.label ?? templateId;
    const groupId = uuidv4();
    const newGroup: Group = {
      id: groupId,
      name: groupLabel,
      moduleIds: ids,
      position: {
        x: Math.round(bb.minX - PAD),
        y: Math.round(bb.minY - PAD),
      },
      size: {
        width: Math.round(bb.maxX - bb.minX + PAD * 2),
        height: Math.round(bb.maxY - bb.minY + PAD * 2),
      },
      color: "teal",
      isCollapsed: false,
      createdAt: now,
      updatedAt: now,
      mapTemplateId: templateId,
      mapPivot: pivot,
      mapScale: 1,
    };

    set((st) => ({
      boards: st.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              modules: [...b.modules, ...newModules],
              connections: [...b.connections, ...newConnections],
              groups: [...(b.groups ?? []), newGroup],
              updatedAt: getTimestamp(),
            }
          : b
      ),
      pendingGroupInvite: null,
    }));

    debouncedSave?.();
    debouncedSupabaseSync?.();
  },

  scaleMapTemplateGroup(boardId, groupId, factor) {
    if (!Number.isFinite(factor) || factor <= 0) return;

    const board = get().boards.find((b) => b.id === boardId);
    if (!board || normalizeBoardCategory(board) !== "thinking") return;
    const g = board?.groups?.find((x) => x.id === groupId);
    if (!g?.mapTemplateId || g.mapPivot == null) return;

    const pivot = g.mapPivot;
    const members = g.moduleIds
      .map((id) => board.modules.find((m) => m.id === id))
      .filter((m): m is Module => Boolean(m));
    if (members.length === 0) return;

    get().pushHistory();
    const ts = getTimestamp();

    const moduleUpdates = new Map<
      string,
      { position: { x: number; y: number }; size: { width: number; height: number } }
    >();

    for (const m of members) {
      const cx = m.position.x + m.size.width / 2;
      const cy = m.position.y + m.size.height / 2;
      const ncx = pivot.x + (cx - pivot.x) * factor;
      const ncy = pivot.y + (cy - pivot.y) * factor;
      const nw = Math.max(72, Math.round(m.size.width * factor));
      const nh = Math.max(48, Math.round(m.size.height * factor));
      moduleUpdates.set(m.id, {
        position: { x: Math.round(ncx - nw / 2), y: Math.round(ncy - nh / 2) },
        size: { width: nw, height: nh },
      });
    }

    const nextScale = Math.round((g.mapScale ?? 1) * factor * 1000) / 1000;

    set((st) => ({
      boards: st.boards.map((b) => {
        if (b.id !== boardId) return b;
        const modules = b.modules.map((m) => {
          const u = moduleUpdates.get(m.id);
          return u ? { ...m, ...u, updatedAt: ts } : m;
        });
        const groups = (b.groups ?? []).map((gr) => {
          if (gr.id !== groupId) return gr;
          const subs = gr.moduleIds
            .map((id) => modules.find((m) => m.id === id))
            .filter((m): m is Module => Boolean(m));
          const box = bboxOfModules(subs);
          const PAD = 20;
          return {
            ...gr,
            position: {
              x: Math.round(box.minX - PAD),
              y: Math.round(box.minY - PAD),
            },
            size: {
              width: Math.round(box.maxX - box.minX + PAD * 2),
              height: Math.round(box.maxY - box.minY + PAD * 2),
            },
            mapScale: nextScale,
            updatedAt: ts,
          };
        });
        return { ...b, modules, groups, updatedAt: ts };
      }),
    }));

    debouncedSave?.();
    debouncedSupabaseSync?.();
  },

  appendMapToolModule(boardId, groupId, toolId) {
    const board = get().boards.find((b) => b.id === boardId);
    if (!board || normalizeBoardCategory(board) !== "thinking") return;
    const g = board?.groups?.find((x) => x.id === groupId);
    if (!g?.mapTemplateId) return;

    const tool = findMapToolDef(g.mapTemplateId, toolId);
    if (!tool) return;

    get().pushHistory();
    const now = getTimestamp();
    const members = g.moduleIds
      .map((id) => board.modules.find((m) => m.id === id))
      .filter((m): m is Module => Boolean(m));
    if (members.length === 0) return;

    const bb = bboxOfModules(members);
    const gap = 16;
    const maxZ = board.modules.reduce((a, m) => Math.max(a, Number(m.zIndex) || 0), 0);

    const newId = uuidv4();
    let newModule: Module;

    if (tool.kind === "memo") {
      newModule = {
        id: newId,
        type: "memo",
        position: { x: Math.round(bb.minX), y: Math.round(bb.maxY + gap) },
        size: { width: 240, height: 140 },
        zIndex: maxZ + 1,
        color: "default",
        shape: "rounded",
        isExpanded: false,
        isMinimized: false,
        data: {
          title: "메모",
          content: "",
          previewLines: 2,
        } satisfies MemoData,
        createdAt: now,
        updatedAt: now,
      };
    } else if (tool.kind === "brainstorm") {
      newModule = {
        id: newId,
        type: "brainstorm",
        position: { x: Math.round(bb.minX), y: Math.round(bb.maxY + gap) },
        size: { width: 280, height: 200 },
        zIndex: maxZ + 1,
        color: "blue",
        shape: "rounded",
        isExpanded: true,
        isMinimized: false,
        data: {
          title: "브레인스토밍",
          items: [],
          previewCount: 4,
          itemLinks: [],
        } satisfies BrainstormData,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      const laneW = Math.max(360, bb.maxX - bb.minX);
      newModule = {
        id: newId,
        type: "memo",
        position: { x: Math.round(bb.minX), y: Math.round(bb.maxY + gap) },
        size: { width: laneW, height: 96 },
        zIndex: maxZ + 1,
        color: "teal",
        shape: "rounded",
        isExpanded: false,
        isMinimized: false,
        data: {
          title: "새 레인",
          content: "",
          previewLines: 2,
        } satisfies MemoData,
        createdAt: now,
        updatedAt: now,
      };
    }

    set((st) => ({
      boards: st.boards.map((b) => {
        if (b.id !== boardId) return b;
        const modules = [...b.modules, newModule];
        const groups = (b.groups ?? []).map((gr) => {
          if (gr.id !== groupId) return gr;
          const nextIds = [...gr.moduleIds, newId];
          const subs = nextIds
            .map((id) => modules.find((m) => m.id === id))
            .filter((m): m is Module => Boolean(m));
          const box = bboxOfModules(subs);
          const PAD = 20;
          return {
            ...gr,
            moduleIds: nextIds,
            position: {
              x: Math.round(box.minX - PAD),
              y: Math.round(box.minY - PAD),
            },
            size: {
              width: Math.round(box.maxX - box.minX + PAD * 2),
              height: Math.round(box.maxY - box.minY + PAD * 2),
            },
            updatedAt: now,
          };
        });
        return { ...b, modules, groups, updatedAt: now };
      }),
    }));

    debouncedSave?.();
    debouncedSupabaseSync?.();
  },

  // ─── 커넥션 CRUD ───────────────────────────────────────────────────────

  addConnection(boardId, connectionInput) {
    get().pushHistory();
    const newConnection: Connection = {
      ...connectionInput,
      id: uuidv4(),
    };

    set((state) => {
      const board = state.boards.find((b) => b.id === boardId);
      const groups = board?.groups ?? [];

      const fromGroup = groups.find((g) => g.moduleIds.includes(connectionInput.fromModuleId));
      const toGroup = groups.find((g) => g.moduleIds.includes(connectionInput.toModuleId));

      let pendingGroupInvite: CanvasStore["pendingGroupInvite"] = null;

      if (fromGroup && !fromGroup.moduleIds.includes(connectionInput.toModuleId)) {
        pendingGroupInvite = {
          groupId: fromGroup.id,
          groupName: fromGroup.name,
          candidateModuleId: connectionInput.toModuleId,
          boardId,
        };
      } else if (toGroup && !toGroup.moduleIds.includes(connectionInput.fromModuleId)) {
        pendingGroupInvite = {
          groupId: toGroup.id,
          groupName: toGroup.name,
          candidateModuleId: connectionInput.fromModuleId,
          boardId,
        };
      }

      return {
        boards: state.boards.map((b) =>
          b.id === boardId
            ? {
                ...b,
                connections: [...b.connections, newConnection],
                updatedAt: getTimestamp(),
              }
            : b
        ),
        pendingGroupInvite,
      };
    });

    debouncedSave?.();
    debouncedSupabaseSync?.();
  },

  removeConnection(boardId, connectionId) {
    get().pushHistory();
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

  updateConnection(boardId, connectionId, updates) {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              connections: b.connections.map((c) =>
                c.id === connectionId ? { ...c, ...updates } : c
              ),
              updatedAt: getTimestamp(),
            }
          : b
      ),
    }));
    debouncedSave?.();
    debouncedSupabaseSync?.();
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
    debouncedSupabaseSync?.();
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
    createClient().from("groups").delete().eq("id", groupId).then(() => {});
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
    debouncedSupabaseSync?.();
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
