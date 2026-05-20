import type { Module, ModuleType } from "@/types";

export type ArrangeMode = "grid" | "list" | "byType" | "compact";
export type ArrangeSortKey = "created" | "updated" | "title" | "type";

const MARGIN = 24;
const GAP_X = 16;
const GAP_Y = 16;
const SECTION_GAP = 32;
/** 그리드 모드에서 한 칸 가로 폭(접힌 카드 기준) */
const GRID_COL_W = 260;
/** 목록 모드 단일 열 폭 */
const LIST_MAX_COL_W = 720;
const LIST_MIN_COL_W = 320;

const TYPE_ORDER: ModuleType[] = [
  "memo",
  "schedule",
  "brainstorm",
  "link",
  "image",
  "file",
  "table",
];

const TYPE_LABEL: Record<ModuleType, string> = {
  memo: "메모",
  schedule: "일정",
  brainstorm: "브레인스토밍",
  link: "링크",
  image: "이미지",
  file: "파일",
  table: "표",
};

export function arrangeModeLabel(mode: ArrangeMode): string {
  if (mode === "grid") return "격자";
  if (mode === "list") return "목록";
  if (mode === "byType") return "종류별";
  return "컴팩트";
}

export function arrangeSortLabel(key: ArrangeSortKey): string {
  if (key === "created") return "만든순";
  if (key === "updated") return "최근 수정순";
  if (key === "title") return "제목";
  return "종류";
}

export function arrangeTypeLabel(type: ModuleType): string {
  return TYPE_LABEL[type] ?? type;
}

function safeTitle(m: Module): string {
  const d = m.data as { title?: string; fileName?: string; url?: string };
  const t = (d.title ?? d.fileName ?? d.url ?? "").toString().trim();
  return t.toLowerCase();
}

function moduleH(m: Module): number {
  return Math.max(1, m.isExpanded ? m.size.height : 68);
}

function moduleW(m: Module): number {
  return Math.max(1, m.size.width);
}

function sortModules(modules: Module[], key: ArrangeSortKey): Module[] {
  const arr = [...modules];
  if (key === "created") {
    arr.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } else if (key === "updated") {
    arr.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } else if (key === "title") {
    arr.sort((a, b) => {
      const ta = safeTitle(a);
      const tb = safeTitle(b);
      if (!ta && tb) return 1;
      if (ta && !tb) return -1;
      return ta.localeCompare(tb);
    });
  } else if (key === "type") {
    arr.sort((a, b) => {
      const oa = TYPE_ORDER.indexOf(a.type);
      const ob = TYPE_ORDER.indexOf(b.type);
      if (oa !== ob) return oa - ob;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }
  return arr;
}

export interface ArrangeLayoutInput {
  modules: Module[];
  collapsedModuleIds: Set<string>;
  groupedModuleIds: Set<string>;
  containerWidthPx: number;
  zoom: number;
  mode: ArrangeMode;
  sortKey: ArrangeSortKey;
  /** byType 모드에서 섹션 라벨이 들어갈 자리를 확보하기 위한 추가 상단 여백(논리 px) */
  byTypeSectionLabelHeight?: number;
}

export interface ArrangeLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  /** 모드별 컨테이너 픽셀 (전체 폭/가용 폭 사용). 호출자가 fit 줌에 사용. */
  contentBox: { x: number; y: number; width: number; height: number };
  /** byType: 섹션 시작 y 좌표(논리 px)별 라벨. UI에서 안내용으로만 사용. */
  sectionLabels?: { y: number; label: string; type: ModuleType; count: number }[];
}

/**
 * 가시성·정리 우선의 정렬 레이아웃을 계산합니다.
 * 사용자가 자유 배치한 캔버스 위에 그리드/목록/종류별/컴팩트 정렬을 덮어씌웁니다.
 *
 * - 그룹·접힌 그룹 모듈, 맵 템플릿 묶음 모듈은 제외(자유 배치 유지)
 * - 위치만 변경. 모듈 크기는 유지.
 */
export function computeArrangeLayout(
  input: ArrangeLayoutInput
): ArrangeLayoutResult {
  const {
    modules,
    collapsedModuleIds,
    groupedModuleIds,
    containerWidthPx,
    zoom,
    mode,
    sortKey,
    byTypeSectionLabelHeight = 26,
  } = input;

  const visible = modules.filter(
    (m) =>
      !collapsedModuleIds.has(m.id) &&
      !groupedModuleIds.has(m.id) &&
      !m.mapTemplateBundleId
  );

  const sorted = sortModules(visible, sortKey);
  const out = new Map<string, { x: number; y: number }>();

  const usableW = Math.max(
    480,
    containerWidthPx / Math.max(zoom, 0.05) - MARGIN * 2
  );
  let maxRight = MARGIN;
  let maxBottom = MARGIN;

  if (mode === "list") {
    const colW = Math.max(LIST_MIN_COL_W, Math.min(LIST_MAX_COL_W, usableW));
    const colX = MARGIN + (usableW - colW) / 2;
    let y = MARGIN;
    for (const m of sorted) {
      out.set(m.id, { x: Math.round(colX), y: Math.round(y) });
      y += moduleH(m) + GAP_Y;
    }
    maxRight = colX + colW;
    maxBottom = y;
    return {
      positions: out,
      contentBox: {
        x: MARGIN,
        y: MARGIN,
        width: maxRight - MARGIN,
        height: maxBottom - MARGIN,
      },
    };
  }

  if (mode === "byType") {
    const buckets = new Map<ModuleType, Module[]>();
    for (const m of sorted) {
      if (!buckets.has(m.type)) buckets.set(m.type, []);
      buckets.get(m.type)!.push(m);
    }
    let y = MARGIN;
    const sectionLabels: ArrangeLayoutResult["sectionLabels"] = [];
    for (const type of TYPE_ORDER) {
      const list = buckets.get(type);
      if (!list || list.length === 0) continue;
      sectionLabels.push({
        y: y,
        label: arrangeTypeLabel(type),
        type,
        count: list.length,
      });
      y += byTypeSectionLabelHeight;
      let x = MARGIN;
      let rowH = 0;
      for (const m of list) {
        const w = moduleW(m);
        if (x !== MARGIN && x + w > MARGIN + usableW) {
          x = MARGIN;
          y += rowH + GAP_Y;
          rowH = 0;
        }
        out.set(m.id, { x: Math.round(x), y: Math.round(y) });
        x += w + GAP_X;
        rowH = Math.max(rowH, moduleH(m));
        maxRight = Math.max(maxRight, x);
      }
      y += rowH + SECTION_GAP;
      maxBottom = Math.max(maxBottom, y);
    }
    return {
      positions: out,
      contentBox: {
        x: MARGIN,
        y: MARGIN,
        width: maxRight - MARGIN,
        height: maxBottom - MARGIN,
      },
      sectionLabels,
    };
  }

  if (mode === "compact") {
    let x = MARGIN;
    let y = MARGIN;
    let rowH = 0;
    for (const m of sorted) {
      const w = moduleW(m);
      const h = moduleH(m);
      if (x !== MARGIN && x + w > MARGIN + usableW) {
        x = MARGIN;
        y += rowH + GAP_Y;
        rowH = 0;
      }
      out.set(m.id, { x: Math.round(x), y: Math.round(y) });
      x += w + GAP_X;
      rowH = Math.max(rowH, h);
      maxRight = Math.max(maxRight, x);
    }
    maxBottom = y + rowH;
    return {
      positions: out,
      contentBox: {
        x: MARGIN,
        y: MARGIN,
        width: maxRight - MARGIN,
        height: maxBottom - MARGIN,
      },
    };
  }

  // grid (default): uniform columns by GRID_COL_W, row height per row
  const cols = Math.max(
    1,
    Math.floor((usableW + GAP_X) / (GRID_COL_W + GAP_X))
  );
  const rowMods: Module[][] = [];
  for (let i = 0; i < sorted.length; i += cols) {
    rowMods.push(sorted.slice(i, i + cols));
  }
  let y = MARGIN;
  for (const row of rowMods) {
    const rowH = Math.max(...row.map(moduleH));
    let x = MARGIN;
    for (const m of row) {
      out.set(m.id, { x: Math.round(x), y: Math.round(y) });
      x += GRID_COL_W + GAP_X;
      maxRight = Math.max(maxRight, x);
    }
    y += rowH + GAP_Y;
    maxBottom = Math.max(maxBottom, y);
  }

  return {
    positions: out,
    contentBox: {
      x: MARGIN,
      y: MARGIN,
      width: maxRight - MARGIN,
      height: maxBottom - MARGIN,
    },
  };
}
