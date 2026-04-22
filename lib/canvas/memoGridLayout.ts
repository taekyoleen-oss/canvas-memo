import type { Connection, Module } from "@/types";

const GRID_MARGIN = 20;
const GAP_X = 14;
const GAP_Y = 14;
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
 * 미연결 모듈: 각 모듈 실제 너비로 가로 채우고, 넘치면 다음 줄(네이버 메모 스타일).
 * 연결된 모듈: 그 아래에서 컴포넌트별 가로 배치 후 가로 중앙 정렬.
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
  const lineRight = GRID_MARGIN + canvasLogicalWidth;
  const centerX = GRID_MARGIN + canvasLogicalWidth / 2;

  let x = GRID_MARGIN;
  let cumY = GRID_MARGIN;
  let rowH = 0;

  for (const m of unlinked) {
    const w = Math.max(1, m.size.width);
    const h = Math.max(1, m.size.height);
    if (x > GRID_MARGIN && x + w > lineRight) {
      cumY += rowH + GAP_Y;
      x = GRID_MARGIN;
      rowH = 0;
    }
    out.set(m.id, { x, y: cumY });
    rowH = Math.max(rowH, h);
    x += w + GAP_X;
  }

  const gridBottom = unlinked.length > 0 ? cumY + rowH : GRID_MARGIN;

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

  let stackY = gridBottom + SECTION_GAP;

  for (const comp of components) {
    const sorted = [...comp].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const totalW =
      sorted.reduce((s, m) => s + m.size.width, 0) + GAP_X * Math.max(0, sorted.length - 1);
    const maxH = Math.max(...sorted.map((m) => m.size.height));
    let cx = centerX - totalW / 2;
    for (const m of sorted) {
      out.set(m.id, { x: cx, y: stackY });
      cx += m.size.width + GAP_X;
    }
    stackY += maxH + GAP_Y + 12;
  }

  return out;
}
