import type { Connection, Module } from "@/types";

const GRID_MARGIN = 20;
const GAP_X = 14;
const GAP_Y = 14;
const COL_W = 260;
const SLOT_STEP_X = COL_W + GAP_X;
const SECTION_GAP = 36;

export interface MemoGridLayoutInput {
  modules: Module[];
  connections: Connection[];
  /** 접힌 그룹에 속해 캔버스에 안 보이는 모듈 */
  collapsedModuleIds: Set<string>;
  /** 어떤 그룹에라도 속한 모듈은 자동 배치에서 제외 (그룹 프레임 유지) */
  groupedModuleIds: Set<string>;
  /** 캔버스 컨테이너 가로 px (줌 적용 전 화면 크기) */
  containerWidthPx: number;
  zoom: number;
}

/**
 * 미연결 모듈: 네이버 메모처럼 가로로 채우고 줄바꿈.
 * 연결된 모듈(서로 연결선이 있는 컴포넌트): 그 아래 가로로 묶어 화면 중앙 정렬.
 * 그룹에 속한 모듈·접힌 그룹 모듈은 건드리지 않음.
 */
export function computeMemoLikeLayout(input: MemoGridLayoutInput): Map<string, { x: number; y: number }> {
  const { modules, connections, collapsedModuleIds, groupedModuleIds, containerWidthPx, zoom } = input;
  const out = new Map<string, { x: number; y: number }>();

  const visible = modules.filter((m) => !collapsedModuleIds.has(m.id));
  const eligible = visible.filter((m) => !groupedModuleIds.has(m.id));
  const eligibleIds = new Set(eligible.map((m) => m.id));

  const linkedIds = new Set<string>();
  for (const c of connections) {
    if (eligibleIds.has(c.fromModuleId) && eligibleIds.has(c.toModuleId)) {
      linkedIds.add(c.fromModuleId);
      linkedIds.add(c.toModuleId);
    }
  }

  const unlinked = eligible
    .filter((m) => !linkedIds.has(m.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const linkedModules = eligible.filter((m) => linkedIds.has(m.id));

  const canvasLogicalWidth = Math.max(320, containerWidthPx / Math.max(zoom, 0.05) - GRID_MARGIN * 2);
  const ncols = Math.max(1, Math.floor((canvasLogicalWidth + GAP_X) / SLOT_STEP_X));

  let y = GRID_MARGIN;
  let row: Module[] = [];

  function flushRow() {
    if (row.length === 0) return;
    const rowH = Math.max(68, ...row.map((m) => m.size.height));
    let x = GRID_MARGIN;
    for (const m of row) {
      out.set(m.id, { x, y });
      x += SLOT_STEP_X;
    }
    y += rowH + GAP_Y;
    row = [];
  }

  for (const m of unlinked) {
    if (row.length >= ncols) flushRow();
    row.push(m);
  }
  flushRow();

  const gridContentW = ncols * SLOT_STEP_X - GAP_X;
  const centerX = GRID_MARGIN + gridContentW / 2;

  if (linkedModules.length === 0) return out;

  const adj = new Map<string, Set<string>>();
  for (const m of linkedModules) adj.set(m.id, new Set());
  for (const c of connections) {
    if (!eligibleIds.has(c.fromModuleId) || !eligibleIds.has(c.toModuleId)) continue;
    adj.get(c.fromModuleId)?.add(c.toModuleId);
    adj.get(c.toModuleId)?.add(c.fromModuleId);
  }

  const linkedById = new Map(linkedModules.map((m) => [m.id, m]));
  const visited = new Set<string>();
  const components: Module[][] = [];

  for (const m of linkedModules) {
    if (visited.has(m.id)) continue;
    const comp: Module[] = [];
    const q = [m.id];
    visited.add(m.id);
    while (q.length) {
      const id = q.shift()!;
      const mod = linkedById.get(id);
      if (mod) comp.push(mod);
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          q.push(nb);
        }
      }
    }
    if (comp.length) components.push(comp);
  }

  components.sort((a, b) => {
    const ta = Math.min(...a.map((m) => new Date(m.createdAt).getTime()));
    const tb = Math.min(...b.map((m) => new Date(m.createdAt).getTime()));
    return ta - tb;
  });

  let stackY = y + SECTION_GAP;

  for (const comp of components) {
    const sorted = [...comp].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const totalW =
      sorted.reduce((s, m) => s + m.size.width, 0) + GAP_X * Math.max(0, sorted.length - 1);
    const maxH = Math.max(...sorted.map((m) => m.size.height));
    let x = centerX - totalW / 2;
    for (const m of sorted) {
      out.set(m.id, { x, y: stackY });
      x += m.size.width + GAP_X;
    }
    stackY += maxH + GAP_Y + 12;
  }

  return out;
}
