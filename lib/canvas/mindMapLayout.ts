import type { Connection, Module } from "@/types";

const COL_GAP = 72;
const ROW_GAP = 20;

export interface MindMapLayoutInput {
  modules: Module[];
  connections: Connection[];
  collapsedModuleIds: Set<string>;
  groupedModuleIds: Set<string>;
}

function leftEdgeForColumn(
  rootX: number,
  colWidths: number[],
  depth: number
): number {
  let x = rootX;
  for (let i = 0; i < depth; i++) {
    x += colWidths[i] + COL_GAP;
  }
  return x;
}

/**
 * 메모·브레인스토밍만 대상으로, 연결 컴포넌트마다 가장 왼쪽 모듈을 루트로
 * BFS 깊이만큼 오른쪽 열로 펼칩니다.
 */
export function computeMindMapLayeredLayout(
  input: MindMapLayoutInput
): Map<string, { x: number; y: number }> {
  const { modules, connections, collapsedModuleIds, groupedModuleIds } = input;
  const out = new Map<string, { x: number; y: number }>();

  const visible = modules.filter((m) => !collapsedModuleIds.has(m.id));
  const eligible = visible.filter((m) => !groupedModuleIds.has(m.id));
  const eligibleIds = new Set(eligible.map((m) => m.id));

  const mind = eligible.filter((m) => m.type === "memo" || m.type === "brainstorm");
  const mindIds = new Set(mind.map((m) => m.id));
  if (mind.length === 0) return out;

  const adj = new Map<string, Set<string>>();
  for (const m of mind) adj.set(m.id, new Set());

  for (const c of connections) {
    if (!mindIds.has(c.fromModuleId) || !mindIds.has(c.toModuleId)) continue;
    if (!eligibleIds.has(c.fromModuleId) || !eligibleIds.has(c.toModuleId)) continue;
    adj.get(c.fromModuleId)?.add(c.toModuleId);
    adj.get(c.toModuleId)?.add(c.fromModuleId);
  }

  const linkedMind = mind.filter((m) => (adj.get(m.id)?.size ?? 0) > 0);
  if (linkedMind.length === 0) return out;

  const mindById = new Map(linkedMind.map((m) => [m.id, m]));
  const visitedComp = new Set<string>();
  const components: Module[][] = [];

  for (const m of linkedMind) {
    if (visitedComp.has(m.id)) continue;
    const comp: Module[] = [];
    const q = [m.id];
    visitedComp.add(m.id);
    while (q.length) {
      const id = q.shift()!;
      const mod = mindById.get(id);
      if (mod) comp.push(mod);
      for (const nb of adj.get(id) ?? []) {
        if (!visitedComp.has(nb)) {
          visitedComp.add(nb);
          q.push(nb);
        }
      }
    }
    if (comp.length) components.push(comp);
  }

  for (const comp of components) {
    // 메모만 있는 연결 덩어리는 마인드맵 배치 대상에서 제외 (메모형 자동정렬 사용)
    if (!comp.some((m) => m.type === "brainstorm")) continue;

    const root = [...comp].reduce((a, b) =>
      a.position.x < b.position.x ? a : a.position.x === b.position.x && a.position.y <= b.position.y ? a : b
    );

    const compIds = new Set(comp.map((m) => m.id));
    const depth = new Map<string, number>();
    depth.set(root.id, 0);
    const q = [root.id];
    while (q.length) {
      const u = q.shift()!;
      const du = depth.get(u)!;
      for (const v of adj.get(u) ?? []) {
        if (!compIds.has(v)) continue;
        if (depth.has(v)) continue;
        depth.set(v, du + 1);
        q.push(v);
      }
    }

    const byDepth = new Map<number, Module[]>();
    let maxD = 0;
    for (const mod of comp) {
      const d = depth.get(mod.id);
      if (d === undefined) continue;
      maxD = Math.max(maxD, d);
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(mod);
    }
    for (const arr of byDepth.values()) {
      arr.sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id));
    }

    const colWidths: number[] = [];
    for (let d = 0; d <= maxD; d++) {
      const row = byDepth.get(d) ?? [];
      colWidths[d] = row.reduce((mx, m) => Math.max(mx, m.size.width), 0);
    }

    const rootX = root.position.x;
    const rootY = root.position.y;

    for (let d = 0; d <= maxD; d++) {
      const row = byDepth.get(d) ?? [];
      if (row.length === 0) continue;
      const colLeft = leftEdgeForColumn(rootX, colWidths, d);
      if (d === 0) {
        for (const m of row) {
          out.set(m.id, { x: colLeft, y: rootY });
        }
        continue;
      }
      const totalH =
        row.reduce((s, m) => s + m.size.height, 0) +
        ROW_GAP * Math.max(0, row.length - 1);
      let y = rootY - totalH / 2;
      for (const m of row) {
        out.set(m.id, { x: colLeft, y });
        y += m.size.height + ROW_GAP;
      }
    }
  }

  return out;
}
