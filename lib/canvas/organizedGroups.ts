import type {
  Module,
  Connection,
  Group,
  DisplayEntry,
  OrganizedSortKey,
} from "@/types";

/**
 * 정리 뷰(Organized View)의 그래프/정렬 순수 로직.
 *
 * 외부 상태/스토어/localStorage 에 직접 접근하지 않는다. 입력 → 출력이 결정적이며,
 * 동일 입력은 매 렌더마다 동일한 결과를 반환한다(안정적 tie-break).
 *
 * - `buildOrganizedEntries(input)` : 모듈/연결/그룹/맵묶음 → `DisplayEntry[]`
 * - `sortEntries(entries, sortKey)` : anchor 기준 정렬
 *
 * 설계 스펙: docs/superpowers/specs/2026-06-06-organized-view-design.md §4~§6, §9
 */

// ── 입력 형태 ─────────────────────────────────────────────────────────────

export interface BuildOrganizedInput {
  modules: Module[];
  connections: Connection[];
  groups: Group[];
  /**
   * 수동 대표 지정. `groupKey → moduleId`.
   * viewPrefs.primary[boardId] 를 그대로 넘기면 된다(없으면 생략 가능).
   * 지정된 moduleId 가 해당 그룹의 멤버가 아니면 무시(자동 규칙 폴백).
   */
  primaryOverrides?: Record<string, string>;
}

// ── 시간/제목 유틸 ─────────────────────────────────────────────────────────

/** ISO 문자열을 epoch ms 로. 파싱 불가 시 0(가장 오래된 것으로 취급). */
function timeOf(iso: string | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 모듈 표시 제목 추출. 타입별 우선순위(title → fileName → url).
 * arrangeLayouts 의 safeTitle 을 일반화(원문 보존 + 옵션 lowercase).
 */
export function entryTitle(m: Module): string {
  const d = m.data as { title?: string; fileName?: string; url?: string };
  return (d.title ?? d.fileName ?? d.url ?? "").toString().trim();
}

// ── createdAt 오름차순 + id tie-break (멤버 정렬 공용) ──────────────────────

function byCreatedAscThenId(a: Module, b: Module): number {
  const ta = timeOf(a.createdAt);
  const tb = timeOf(b.createdAt);
  if (ta !== tb) return ta - tb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ── 연결 그래프(무향) ──────────────────────────────────────────────────────

/**
 * 주어진 모듈 집합 내부에서만 유효한 무향 인접 리스트와 차수를 만든다.
 * - 자기연결(from===to)은 무시.
 * - 양 끝점이 모두 후보 집합에 있는 connection 만 반영.
 * - 같은 쌍의 중복 연결은 degree 를 한 번만 올린다(중복 간선 정규화).
 */
function buildAdjacency(
  candidateIds: Set<string>,
  connections: Connection[]
): { adj: Map<string, Set<string>>; degree: Map<string, number> } {
  const adj = new Map<string, Set<string>>();
  const degree = new Map<string, number>();
  for (const id of candidateIds) {
    adj.set(id, new Set());
    degree.set(id, 0);
  }
  for (const c of connections) {
    const a = c.fromModuleId;
    const b = c.toModuleId;
    if (a === b) continue; // 자기연결 무시
    if (!candidateIds.has(a) || !candidateIds.has(b)) continue;
    const sa = adj.get(a)!;
    const sb = adj.get(b)!;
    if (sa.has(b)) continue; // 중복 간선 정규화
    sa.add(b);
    sb.add(a);
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }
  return { adj, degree };
}

/**
 * 후보 집합에서 연결 컴포넌트를 추출. 결정성을 위해 시작 노드 순서를 id 사전순으로 둔다.
 * 반환 컴포넌트 내부 id 도 정렬해 둔다.
 */
function connectedComponents(
  candidateIds: Set<string>,
  adj: Map<string, Set<string>>
): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];
  const ordered = [...candidateIds].sort();
  for (const start of ordered) {
    if (visited.has(start)) continue;
    const comp: string[] = [];
    const stack = [start];
    visited.add(start);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      comp.push(cur);
      // 인접 노드도 결정적 순서로 push
      const neighbors = [...(adj.get(cur) ?? new Set<string>())].sort();
      for (const nb of neighbors) {
        if (!visited.has(nb)) {
          visited.add(nb);
          stack.push(nb);
        }
      }
    }
    comp.sort();
    components.push(comp);
  }
  return components;
}

// ── groupKey 생성 ──────────────────────────────────────────────────────────

/**
 * 연결 컴포넌트 서명 키. 멤버 집합이 같으면 항상 동일 키.
 * 정렬된 멤버 id 들을 FNV-1a 32bit 해시로 압축(+개수 prefix 로 충돌 완화).
 */
export function connectionGroupKey(memberIds: string[]): string {
  const sorted = [...memberIds].sort();
  let h = 0x811c9dc5; // FNV offset basis
  const joined = sorted.join("");
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    // FNV prime 16777619, >>>0 로 32bit unsigned 유지
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, "0");
  return `c:${sorted.length}:${hex}`;
}

// ── 대표(anchor) 선정 ──────────────────────────────────────────────────────

/**
 * 그룹 멤버 중 대표 선정.
 * (a) primaryOverride 가 멤버에 있으면 그 모듈
 * (b) 그룹 내 연결 차수(degree) 최다
 * (c) 동률이면 createdAt 오름차순(가장 오래된 것)
 * (d) 그래도 동률이면 id 사전순
 *
 * members 는 비어 있지 않다고 가정(호출부에서 보장).
 */
function pickAnchor(
  members: Module[],
  degree: Map<string, number>,
  override: string | undefined
): Module {
  if (override) {
    const found = members.find((m) => m.id === override);
    if (found) return found;
    // 멤버 이탈 등 무효 지정 → 자동 규칙 폴백
  }
  let best = members[0];
  let bestDeg = degree.get(best.id) ?? 0;
  for (let i = 1; i < members.length; i++) {
    const m = members[i];
    const deg = degree.get(m.id) ?? 0;
    if (deg > bestDeg) {
      best = m;
      bestDeg = deg;
      continue;
    }
    if (deg === bestDeg) {
      // createdAt 오름차순 → id 사전순
      if (byCreatedAscThenId(m, best) < 0) {
        best = m;
      }
    }
  }
  return best;
}

/** 대표를 [0]에, 나머지를 createdAt 오름차순(+id)으로 정렬한 멤버 배열. */
function orderMembers(members: Module[], anchor: Module): Module[] {
  const rest = members
    .filter((m) => m.id !== anchor.id)
    .sort(byCreatedAscThenId);
  return [anchor, ...rest];
}

// ── 메인: buildOrganizedEntries ────────────────────────────────────────────

/**
 * 모듈을 정확히 하나의 표시 그룹(single | group)에 배정해 DisplayEntry[] 를 만든다.
 *
 * 소속 우선순위:
 *  1) 명시적 Group(moduleIds)
 *  2) 맵 묶음 mapTemplateBundleId
 *  3) connections 무향 연결 컴포넌트(크기 ≥ 2)
 *  4) 단일(single)
 *
 * 상위 단계에서 배정된 모듈은 하위 단계 후보에서 제외(중복 표시 금지).
 *
 * 출력 순서는 안정적이지만 정렬되어 있지 않다. UI 는 sortEntries 로 정렬한다.
 */
export function buildOrganizedEntries(
  input: BuildOrganizedInput
): DisplayEntry[] {
  const { modules, connections, groups, primaryOverrides = {} } = input;

  // 빈 입력 가드
  if (!modules || modules.length === 0) return [];

  const byId = new Map<string, Module>();
  for (const m of modules) byId.set(m.id, m);

  const assigned = new Set<string>(); // 이미 그룹/single 로 소비된 모듈
  const entries: DisplayEntry[] = [];

  // degree 는 "전체 유효 모듈" 기준으로 한 번 계산(스펙 §5: 그룹 내부/외부 무관).
  // 후보 = 현재 보드에 실재하는 모든 모듈 id.
  const allIds = new Set<string>(byId.keys());
  const { degree: globalDegree } = buildAdjacency(allIds, connections);

  const makeGroupEntry = (
    memberModules: Module[],
    source: "group" | "mapBundle" | "connection",
    groupKey: string,
    override: string | undefined
  ): DisplayEntry => {
    const anchor = pickAnchor(memberModules, globalDegree, override);
    const ordered = orderMembers(memberModules, anchor);
    return {
      kind: "group",
      anchor,
      members: ordered,
      groupSource: source,
      groupKey,
    };
  };

  // ── 1) 명시적 Group ──────────────────────────────────────────────────────
  for (const g of groups ?? []) {
    const memberModules: Module[] = [];
    const seen = new Set<string>();
    for (const mid of g.moduleIds) {
      if (assigned.has(mid)) continue; // 이미 다른 그룹에 소비됨(이론상 없음)
      if (seen.has(mid)) continue; // Group 내 중복 id 방지
      const m = byId.get(mid);
      if (!m) continue; // 존재하지 않는 id 참조 무시
      memberModules.push(m);
      seen.add(mid);
    }
    if (memberModules.length === 0) continue; // 빈/유령 그룹 무시
    for (const m of memberModules) assigned.add(m.id);
    if (memberModules.length === 1) {
      // 멤버 1개만 유효 → single 취급(스펙 §9)
      entries.push({ kind: "single", anchor: memberModules[0] });
      continue;
    }
    entries.push(
      makeGroupEntry(memberModules, "group", `g:${g.id}`, primaryOverrides[`g:${g.id}`])
    );
  }

  // ── 2) 맵 묶음 mapTemplateBundleId ──────────────────────────────────────
  const bundles = new Map<string, Module[]>();
  for (const m of modules) {
    if (assigned.has(m.id)) continue;
    const bid = m.mapTemplateBundleId;
    if (!bid) continue;
    if (!bundles.has(bid)) bundles.set(bid, []);
    bundles.get(bid)!.push(m);
  }
  // bundleId 사전순으로 결정적 처리
  for (const bid of [...bundles.keys()].sort()) {
    const memberModules = bundles.get(bid)!;
    for (const m of memberModules) assigned.add(m.id);
    if (memberModules.length === 1) {
      entries.push({ kind: "single", anchor: memberModules[0] });
      continue;
    }
    entries.push(
      makeGroupEntry(memberModules, "mapBundle", `b:${bid}`, primaryOverrides[`b:${bid}`])
    );
  }

  // ── 3) 연결 컴포넌트(크기 ≥ 2) ──────────────────────────────────────────
  const remaining = new Set<string>();
  for (const m of modules) {
    if (!assigned.has(m.id)) remaining.add(m.id);
  }
  const { adj } = buildAdjacency(remaining, connections);
  const components = connectedComponents(remaining, adj);
  for (const comp of components) {
    if (comp.length < 2) continue; // 1-노드 컴포넌트는 single 단계로
    const memberModules = comp
      .map((id) => byId.get(id))
      .filter((m): m is Module => !!m);
    if (memberModules.length < 2) continue;
    for (const m of memberModules) assigned.add(m.id);
    const key = connectionGroupKey(memberModules.map((m) => m.id));
    entries.push(
      makeGroupEntry(memberModules, "connection", key, primaryOverrides[key])
    );
  }

  // ── 4) 단일(single) — 남은 모든 모듈 ────────────────────────────────────
  for (const m of modules) {
    if (assigned.has(m.id)) continue;
    assigned.add(m.id);
    entries.push({ kind: "single", anchor: m });
  }

  return entries;
}

// ── 엔트리 식별 key (사용자정의 순서·React key 공용) ─────────────────────────

/**
 * DisplayEntry 의 안정적 식별 key.
 * - group: `g:${groupKey ?? anchor.id}`  (멤버 집합이 같으면 동일 key)
 * - single: `s:${anchor.id}`
 *
 * 사용자정의 순서 저장(viewPrefs.customOrder)과 UI React key 가 같은 규칙을
 * 쓰도록 단일 출처로 둔다.
 */
export function entryKeyOf(entry: DisplayEntry): string {
  return entry.kind === "group"
    ? `g:${entry.groupKey ?? entry.anchor.id}`
    : `s:${entry.anchor.id}`;
}

// ── 정렬: sortEntries ──────────────────────────────────────────────────────

/**
 * DisplayEntry[] 를 anchor 기준으로 정렬한 새 배열을 반환(입력 불변).
 *
 * - createdDesc(기본): anchor.createdAt 내림차순(최신 먼저)
 * - title: anchor 제목 localeCompare(ko). 제목 없으면 뒤로.
 * - updatedDesc: anchor.updatedAt 내림차순
 * - custom: customOrder(엔트리 key 배열) 순서. 목록에 없는(새) 엔트리는 뒤로
 *   밀고 createdDesc 로 tie-break.
 *
 * 모든 키에서 동률 시 createdAt desc → id 로 결정적 tie-break(안정).
 */
export function sortEntries(
  entries: DisplayEntry[],
  sortKey: OrganizedSortKey,
  customOrder?: string[]
): DisplayEntry[] {
  const arr = [...entries];

  const finalTie = (a: DisplayEntry, b: DisplayEntry): number => {
    const ca = timeOf(a.anchor.createdAt);
    const cb = timeOf(b.anchor.createdAt);
    if (ca !== cb) return cb - ca; // createdAt desc
    return a.anchor.id < b.anchor.id ? -1 : a.anchor.id > b.anchor.id ? 1 : 0;
  };

  if (sortKey === "custom") {
    const rank = new Map<string, number>();
    (customOrder ?? []).forEach((k, i) => {
      if (!rank.has(k)) rank.set(k, i);
    });
    const UNKNOWN = Number.MAX_SAFE_INTEGER;
    arr.sort((a, b) => {
      const ra = rank.get(entryKeyOf(a)) ?? UNKNOWN;
      const rb = rank.get(entryKeyOf(b)) ?? UNKNOWN;
      if (ra !== rb) return ra - rb;
      return finalTie(a, b); // 미등록(신규) 엔트리는 최신순으로 뒤에 붙음
    });
    return arr;
  }

  if (sortKey === "title") {
    arr.sort((a, b) => {
      const ta = entryTitle(a.anchor);
      const tb = entryTitle(b.anchor);
      if (!ta && tb) return 1; // 제목 없으면 뒤로
      if (ta && !tb) return -1;
      if (ta && tb) {
        const cmp = ta.localeCompare(tb, "ko");
        if (cmp !== 0) return cmp;
      }
      return finalTie(a, b);
    });
    return arr;
  }

  if (sortKey === "updatedDesc") {
    arr.sort((a, b) => {
      const ua = timeOf(a.anchor.updatedAt);
      const ub = timeOf(b.anchor.updatedAt);
      if (ua !== ub) return ub - ua; // updatedAt desc
      return finalTie(a, b);
    });
    return arr;
  }

  // createdDesc (default)
  arr.sort((a, b) => finalTie(a, b));
  return arr;
}
