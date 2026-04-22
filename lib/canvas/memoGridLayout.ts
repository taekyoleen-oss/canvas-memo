import type { Connection, Module } from "@/types";

const GRID_MARGIN = 20;
const GAP_X = 14;
const GAP_Y = 14;
const SECTION_GAP = 40;
/** 연결 그래프 — 모듈 사이 가로(X) 여백 (기존 20의 4배) */
const FLOW_GAP_H = 80;
/** 연결 그래프 — 모듈 사이 세로(Y) 여백 (기존 20의 2배) */
const FLOW_GAP_V = 40;
/** 겹침 판정·밀어내기 시 최소 간격(축 혼합) */
const FLOW_GAP_OVERLAP = Math.max(FLOW_GAP_H, FLOW_GAP_V);
/** 부모에서 같은 방향으로 나가는 자식이 2개일 때, 별첨처럼 위·아래(또는 좌·우)로 갈라지는 각도(rad) */
const FAN_ANGLE_RAD = 0.38;

export interface MemoGridLayoutInput {
  modules: Module[];
  connections: Connection[];
  collapsedModuleIds: Set<string>;
  groupedModuleIds: Set<string>;
  containerWidthPx: number;
  zoom: number;
}

type LayoutDir = "right" | "left" | "down" | "up" | "fallback";

function isMemoOrSchedule(m: Module): boolean {
  return m.type === "memo" || m.type === "schedule";
}

function findConnection(
  connections: Connection[],
  a: string,
  b: string
): Connection | undefined {
  return connections.find(
    (c) =>
      (c.fromModuleId === a && c.toModuleId === b) ||
      (c.fromModuleId === b && c.toModuleId === a)
  );
}

/** parent 기준 child가 놓일 방향(연결 앵커 기준, 직선에 가깝게) */
function layoutDirParentToChild(
  parentId: string,
  childId: string,
  c: Connection
): LayoutDir {
  if (c.fromModuleId === parentId && c.toModuleId === childId) {
    if (c.fromAnchor === "right" && c.toAnchor === "left") return "right";
    if (c.fromAnchor === "left" && c.toAnchor === "right") return "left";
    if (c.fromAnchor === "bottom" && c.toAnchor === "top") return "down";
    if (c.fromAnchor === "top" && c.toAnchor === "bottom") return "up";
    return "fallback";
  }
  if (c.fromModuleId === childId && c.toModuleId === parentId) {
    if (c.fromAnchor === "right" && c.toAnchor === "left") return "left";
    if (c.fromAnchor === "left" && c.toAnchor === "right") return "right";
    if (c.fromAnchor === "bottom" && c.toAnchor === "top") return "up";
    if (c.fromAnchor === "top" && c.toAnchor === "bottom") return "down";
    return "fallback";
  }
  return "fallback";
}

function modH(m: Module): number {
  return Math.max(1, m.size.height);
}

function modW(m: Module): number {
  return Math.max(1, m.size.width);
}

function rectOf(
  id: string,
  rel: Map<string, { x: number; y: number }>,
  byId: Map<string, Module>
): { x: number; y: number; w: number; h: number } | null {
  const p = rel.get(id);
  const m = byId.get(id);
  if (!p || !m) return null;
  return { x: p.x, y: p.y, w: modW(m), h: modH(m) };
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap: number
): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

/**
 * 같은 부모·같은 축 방향 자식이 정확히 2개일 때, 별첨처럼 부모 앵커에서 갈라지는 부채꼴 배치.
 * (오른쪽: 위·아래 대각, 아래: V자 가로 펼침, 왼쪽/위는 대칭)
 */
function placeTwoChildrenFan(
  dir: "right" | "left" | "down" | "up",
  px: number,
  py: number,
  pw: number,
  ph: number,
  id0: string,
  id1: string,
  rel: Map<string, { x: number; y: number }>,
  byId: Map<string, Module>
): void {
  const m0 = byId.get(id0);
  const m1 = byId.get(id1);
  if (!m0 || !m1) return;
  const w0 = modW(m0);
  const h0 = modH(m0);
  const w1 = modW(m1);
  const h1 = modH(m1);
  const L = Math.max(FLOW_GAP_H + 52, ph * 0.55, pw * 0.45);

  if (dir === "right") {
    const ox = px + pw;
    const oy = py + ph / 2;
    const a0 = -FAN_ANGLE_RAD;
    const a1 = FAN_ANGLE_RAD;
    rel.set(id0, { x: ox + L * Math.cos(a0), y: oy + L * Math.sin(a0) - h0 / 2 });
    rel.set(id1, { x: ox + L * Math.cos(a1), y: oy + L * Math.sin(a1) - h1 / 2 });
    return;
  }
  if (dir === "left") {
    const ox = px;
    const oy = py + ph / 2;
    const a0 = Math.PI + FAN_ANGLE_RAD;
    const a1 = Math.PI - FAN_ANGLE_RAD;
    rel.set(id0, { x: ox + L * Math.cos(a0) - w0, y: oy + L * Math.sin(a0) - h0 / 2 });
    rel.set(id1, { x: ox + L * Math.cos(a1) - w1, y: oy + L * Math.sin(a1) - h1 / 2 });
    return;
  }
  if (dir === "down") {
    const ox = px + pw / 2;
    const oy = py + ph;
    const a0 = -FAN_ANGLE_RAD;
    const a1 = FAN_ANGLE_RAD;
    rel.set(id0, { x: ox + L * Math.sin(a0) - w0 / 2, y: oy + L * Math.cos(a0) });
    rel.set(id1, { x: ox + L * Math.sin(a1) - w1 / 2, y: oy + L * Math.cos(a1) });
    return;
  }
  const ox = px + pw / 2;
  const oy = py;
  const a0 = -FAN_ANGLE_RAD;
  const a1 = FAN_ANGLE_RAD;
  rel.set(id0, { x: ox + L * Math.sin(a0) - w0 / 2, y: oy - L * Math.cos(a0) - h0 });
  rel.set(id1, { x: ox + L * Math.sin(a1) - w1 / 2, y: oy - L * Math.cos(a1) - h1 });
}

/**
 * 메모·일정만 대상.
 * 1) 미연결: 별첨처럼 상단 한 줄, 가로 간격 유지(넓이가 들어가면 가운데 정렬).
 * 2) 연결 덩어리: 그 아래에 배치. 부모–자식 연결 앵커 방향별로 동서남북 배치.
 *    같은 방향 자식이 2개면 부모 앵커에서 갈라지는 부채꼴(대각 분산), 3개 이상이면 해당 축으로 일렬.
 * 3) 겹침 완화 패스.
 */
export function computeMemoLikeLayout(
  input: MemoGridLayoutInput
): Map<string, { x: number; y: number }> {
  const { modules, connections, collapsedModuleIds, groupedModuleIds, containerWidthPx, zoom } =
    input;
  const out = new Map<string, { x: number; y: number }>();

  const visible = modules.filter((m) => !collapsedModuleIds.has(m.id));
  const eligible = visible.filter(
    (m) => !groupedModuleIds.has(m.id) && isMemoOrSchedule(m)
  );
  const eligibleIds = new Set(eligible.map((m) => m.id));
  const byId = new Map(eligible.map((m) => [m.id, m]));

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

  const canvasLogicalWidth = Math.max(
    320,
    containerWidthPx / Math.max(zoom, 0.05) - GRID_MARGIN * 2
  );
  const lineRight = GRID_MARGIN + canvasLogicalWidth;
  const centerX = GRID_MARGIN + canvasLogicalWidth / 2;

  /** 미연결: 별첨처럼 상단 한 줄, 가로 간격 유지. 한 줄 너비가 들어가면 가운데 정렬 */
  const rowY = GRID_MARGIN;
  let gridBottom = GRID_MARGIN;
  if (unlinked.length > 0) {
    const maxRowH = Math.max(...unlinked.map(modH));
    const totalW =
      unlinked.reduce((s, m) => s + modW(m), 0) + GAP_X * Math.max(0, unlinked.length - 1);
    const spanW = lineRight - GRID_MARGIN;
    let startX = GRID_MARGIN;
    if (totalW <= spanW) startX = GRID_MARGIN + (spanW - totalW) / 2;
    let x = startX;
    for (const m of unlinked) {
      const w = modW(m);
      out.set(m.id, { x, y: rowY });
      x += w + GAP_X;
    }
    gridBottom = rowY + maxRowH;
  }

  if (linkedModules.length === 0) return out;

  const adj = new Map<string, Set<string>>();
  for (const m of linkedModules) adj.set(m.id, new Set());
  for (const c of connections) {
    if (!eligibleIds.has(c.fromModuleId) || !eligibleIds.has(c.toModuleId)) continue;
    adj.get(c.fromModuleId)?.add(c.toModuleId);
    adj.get(c.toModuleId)?.add(c.fromModuleId);
  }

  const linkedById = new Map(linkedModules.map((m) => [m.id, m]));
  const visitedComp = new Set<string>();
  const components: Module[][] = [];

  for (const m of linkedModules) {
    if (visitedComp.has(m.id)) continue;
    const comp: Module[] = [];
    const q = [m.id];
    visitedComp.add(m.id);
    while (q.length) {
      const id = q.shift()!;
      const mod = linkedById.get(id);
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

  components.sort((a, b) => {
    const ta = Math.min(...a.map((m) => new Date(m.createdAt).getTime()));
    const tb = Math.min(...b.map((m) => new Date(m.createdAt).getTime()));
    return ta - tb;
  });

  let stackY = gridBottom + SECTION_GAP;

  for (const comp of components) {
    const compIds = new Set(comp.map((m) => m.id));
    const compConns = connections.filter(
      (c) => compIds.has(c.fromModuleId) && compIds.has(c.toModuleId)
    );

    const root = [...comp].reduce((a, b) =>
      new Date(a.createdAt).getTime() < new Date(b.createdAt).getTime() ? a : b
    );

    const parentMap = new Map<string, string>();
    const depth = new Map<string, number>();
    const bfsOrder: string[] = [];
    {
      const q = [root.id];
      parentMap.set(root.id, root.id);
      depth.set(root.id, 0);
      while (q.length) {
        const u = q.shift()!;
        bfsOrder.push(u);
        const du = depth.get(u) ?? 0;
        for (const v of adj.get(u) ?? []) {
          if (!compIds.has(v) || parentMap.has(v)) continue;
          parentMap.set(v, u);
          depth.set(v, du + 1);
          q.push(v);
        }
      }
    }

    const childrenOf = new Map<string, string[]>();
    for (const id of compIds) {
      const par = parentMap.get(id);
      if (par === undefined || par === id) continue;
      if (!childrenOf.has(par)) childrenOf.set(par, []);
      childrenOf.get(par)!.push(id);
    }
    for (const arr of childrenOf.values()) arr.sort((a, b) => a.localeCompare(b));

    const rel = new Map<string, { x: number; y: number }>();
    rel.set(root.id, { x: 0, y: 0 });

    const uniqSort = (ids: string[]) => [...new Set(ids)].sort((a, b) => a.localeCompare(b));

    for (const p of bfsOrder) {
      const kids = childrenOf.get(p);
      if (!kids?.length) continue;
      const pu = rel.get(p);
      const modP = byId.get(p);
      if (!pu || !modP) continue;

      const px = pu.x;
      const py = pu.y;
      const pw = modW(modP);
      const ph = modH(modP);

      const buckets: Record<LayoutDir, string[]> = {
        right: [],
        left: [],
        down: [],
        up: [],
        fallback: [],
      };
      for (const child of kids) {
        const c = findConnection(compConns, p, child);
        if (!c) continue;
        buckets[layoutDirParentToChild(p, child, c)].push(child);
      }

      /**
       * 오른쪽·왼쪽: 자식 2개면 별첨처럼 부채꼴(상·하로 갈라짐), 3개 이상이면 한 축에 세로 스택.
       */
      const placeVertical = (eff: "right" | "left", ids: string[]) => {
        const uniq = uniqSort(ids);
        if (!uniq.length) return;
        const gH = FLOW_GAP_H;
        const gV = FLOW_GAP_V;
        if (uniq.length === 2) {
          placeTwoChildrenFan(
            eff,
            px,
            py,
            pw,
            ph,
            uniq[0]!,
            uniq[1]!,
            rel,
            byId
          );
          return;
        }
        const mods = uniq.map((id) => byId.get(id)!);
        const sumH = mods.reduce((s, m) => s + modH(m), 0);
        const totalH = sumH + (mods.length - 1) * gV;
        let y = py + ph / 2 - totalH / 2;
        if (eff === "right") {
          const childLeftX = px + pw + gH;
          for (const m of mods) {
            rel.set(m.id, { x: childLeftX, y });
            y += modH(m) + gV;
          }
        } else {
          const childRightX = px - gH;
          for (const m of mods) {
            const w = modW(m);
            rel.set(m.id, { x: childRightX - w, y });
            y += modH(m) + gV;
          }
        }
      };

      /**
       * 아래·위: 자식 2개면 V자(가로로 벌린 부채꼴), 3개 이상이면 한 줄 가로 정렬.
       * 아래는 오른쪽·왼쪽 블록 아래로 밀어 겹침을 피함(yOverride).
       */
      const placeHorizontal = (eff: "down" | "up", ids: string[], yOverride?: number) => {
        const uniq = uniqSort(ids);
        if (!uniq.length) return;
        const mods = uniq.map((id) => byId.get(id)!);
        const gH = FLOW_GAP_H;
        const gV = FLOW_GAP_V;
        if (uniq.length === 2 && eff === "down") {
          placeTwoChildrenFan("down", px, py, pw, ph, uniq[0]!, uniq[1]!, rel, byId);
          const rowY = yOverride ?? py + ph + gV;
          const y0 = rel.get(uniq[0]!)!.y;
          const y1 = rel.get(uniq[1]!)!.y;
          const minY = Math.min(y0, y1);
          const delta = rowY - minY;
          if (delta > 0) {
            for (const id of uniq) {
              const p0 = rel.get(id)!;
              rel.set(id, { x: p0.x, y: p0.y + delta });
            }
          }
          return;
        }
        if (uniq.length === 2 && eff === "up") {
          placeTwoChildrenFan("up", px, py, pw, ph, uniq[0]!, uniq[1]!, rel, byId);
          const maxH = Math.max(...mods.map(modH));
          const bottomY = yOverride !== undefined ? yOverride + maxH : py - gV;
          const bottoms = uniq.map((id) => rel.get(id)!.y + modH(byId.get(id)!));
          const curBottom = Math.max(...bottoms);
          const delta = bottomY - curBottom;
          for (const id of uniq) {
            const p0 = rel.get(id)!;
            rel.set(id, { x: p0.x, y: p0.y + delta });
          }
          return;
        }
        const totalW =
          mods.reduce((s, m) => s + modW(m), 0) + gH * Math.max(0, mods.length - 1);
        let xRow = px + pw / 2 - totalW / 2;
        if (eff === "down") {
          const rowY = yOverride ?? py + ph + gV;
          for (const m of mods) {
            const w = modW(m);
            rel.set(m.id, { x: xRow, y: rowY });
            xRow += w + gH;
          }
        } else {
          const maxH = Math.max(...mods.map(modH));
          const bottomY =
            yOverride !== undefined ? yOverride + maxH : py - gV;
          for (const m of mods) {
            const w = modW(m);
            const h = modH(m);
            rel.set(m.id, { x: xRow, y: bottomY - h });
            xRow += w + gH;
          }
        }
      };

      const sideBucketIds = uniqSort([
        ...buckets.right,
        ...buckets.fallback,
        ...buckets.left,
      ]);

      // 오른쪽·왼쪽 세로 스택 (애매한 연결은 오른쪽과 함께)
      placeVertical("right", [...buckets.right, ...buckets.fallback]);
      placeVertical("left", buckets.left);

      let blockBottom = py + ph;
      let blockTop = py;
      for (const bid of sideBucketIds) {
        const r = rectOf(bid, rel, byId);
        if (r) {
          blockBottom = Math.max(blockBottom, r.y + r.h);
          blockTop = Math.min(blockTop, r.y);
        }
      }
      const yForDown = Math.max(py + ph + FLOW_GAP_V, blockBottom + FLOW_GAP_V);
      placeHorizontal("down", buckets.down, yForDown);

      if (buckets.up.length) {
        const uniq = uniqSort(buckets.up);
        const mods = uniq.map((id) => byId.get(id)!);
        const maxH = Math.max(...mods.map(modH));
        const rowYDefault = py - FLOW_GAP_V - maxH;
        const rowY = Math.min(rowYDefault, blockTop - FLOW_GAP_V - maxH);
        placeHorizontal("up", buckets.up, rowY);
      }
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const m of comp) {
      const r = rel.get(m.id);
      if (!r) continue;
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + modW(m));
      maxY = Math.max(maxY, r.y + modH(m));
    }

    if (!Number.isFinite(minX)) {
      const sorted = [...comp].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const totalW =
        sorted.reduce((s, m) => s + modW(m), 0) + GAP_X * Math.max(0, sorted.length - 1);
      const maxH = Math.max(...sorted.map(modH));
      let cx = centerX - totalW / 2;
      for (const m of sorted) {
        out.set(m.id, { x: Math.round(cx), y: stackY });
        cx += modW(m) + GAP_X;
      }
      stackY += maxH + GAP_Y + 12;
      continue;
    }

    const ids = [...compIds].sort((a, b) => {
      const da = depth.get(a) ?? 0;
      const db = depth.get(b) ?? 0;
      if (da !== db) return da - db;
      return a.localeCompare(b);
    });

    const step = 8;
    const maxIter = 100;
    for (let iter = 0; iter < maxIter; iter++) {
      let any = false;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const ia = ids[i]!;
          const ib = ids[j]!;
          const ra = rectOf(ia, rel, byId);
          const rb = rectOf(ib, rel, byId);
          if (!ra || !rb || !overlaps(ra, rb, FLOW_GAP_OVERLAP)) continue;

          const da = depth.get(ia) ?? 0;
          const db = depth.get(ib) ?? 0;
          let moveId: string;
          let fixId: string;
          if (da > db) {
            moveId = ia;
            fixId = ib;
          } else if (db > da) {
            moveId = ib;
            fixId = ia;
          } else {
            moveId = ib;
            fixId = ia;
          }

          const rf = rectOf(fixId, rel, byId)!;
          const rm = rectOf(moveId, rel, byId)!;
          const cxm = rm.x + rm.w / 2;
          const cym = rm.y + rm.h / 2;
          const cxf = rf.x + rf.w / 2;
          const cyf = rf.y + rf.h / 2;
          let ddx = cxm - cxf;
          let ddy = cym - cyf;
          const len = Math.hypot(ddx, ddy);
          if (len < 1e-6) {
            ddx = 1;
            ddy = 0;
          } else {
            ddx /= len;
            ddy /= len;
          }

          const pm = rel.get(moveId)!;
          rel.set(moveId, { x: pm.x + ddx * step, y: pm.y + ddy * step });
          any = true;
        }
      }
      if (!any) break;
    }

    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (const m of comp) {
      const r = rel.get(m.id);
      if (!r) continue;
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + modW(m));
      maxY = Math.max(maxY, r.y + modH(m));
    }

    const compW = maxX - minX;
    const startX = Math.round(centerX - compW / 2 - minX);
    const startY = Math.round(stackY - minY);

    for (const m of comp) {
      const r = rel.get(m.id);
      if (!r) continue;
      out.set(m.id, { x: startX + Math.round(r.x), y: startY + Math.round(r.y) });
    }

    stackY = startY + Math.round(maxY - minY) + SECTION_GAP;
  }

  return out;
}
