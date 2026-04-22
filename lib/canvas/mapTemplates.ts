import type {
  BrainstormMapType,
  ModuleColor,
  ModuleShape,
  ConnectionPathStyle,
} from "@/types";
import type { AnchorSide } from "@/lib/canvas/geometry";

export interface MapTemplateCellSpec {
  relX: number;
  relY: number;
  width: number;
  height: number;
  type: "memo" | "brainstorm";
  color: ModuleColor;
  shape?: ModuleShape;
  isExpanded?: boolean;
  memoTitle?: string;
  memoContent?: string;
  brainTitle?: string;
}

export interface MapTemplateConnSpec {
  from: number;
  to: number;
  fromAnchor: AnchorSide;
  toAnchor: AnchorSide;
  label?: string;
  pathStyle?: ConnectionPathStyle;
}

export interface BuiltCanvasMapTemplate {
  cells: MapTemplateCellSpec[];
  connections: MapTemplateConnSpec[];
}

function bboxOf(cells: MapTemplateCellSpec[]): { width: number; height: number } {
  let w = 0;
  let h = 0;
  for (const c of cells) {
    w = Math.max(w, c.relX + c.width);
    h = Math.max(h, c.relY + c.height);
  }
  return { width: w, height: h };
}

/** 화면 중앙에 놓을 때 템플릿 바운딩 크기 */
export function getCanvasMapTemplateSize(id: BrainstormMapType): { width: number; height: number } {
  return bboxOf(buildCanvasMapTemplate(id).cells);
}

export function buildCanvasMapTemplate(id: BrainstormMapType): BuiltCanvasMapTemplate {
  switch (id) {
    case "brainstorm": {
      const cells: MapTemplateCellSpec[] = [
        {
          relX: 0,
          relY: 0,
          width: 300,
          height: 220,
          type: "brainstorm",
          color: "blue",
          shape: "rounded",
          isExpanded: true,
          brainTitle: "브레인스토밍",
        },
      ];
      return { cells, connections: [] };
    }
    case "process_map": {
      const W = 560;
      const H = 96;
      const G = 12;
      const lanes = ["고객", "영업", "물류·창고", "결제"];
      const cells: MapTemplateCellSpec[] = lanes.map((title, i) => ({
        relX: 0,
        relY: i * (H + G),
        width: W,
        height: H,
        type: "memo" as const,
        color: (["yellow", "blue", "green", "purple"] as ModuleColor[])[i],
        shape: "rounded" as const,
        memoTitle: title,
        memoContent: `<p><strong>${title}</strong> 단계</p><p></p>`,
      }));
      const connections: MapTemplateConnSpec[] = [];
      for (let i = 0; i < cells.length - 1; i++) {
        connections.push({
          from: i,
          to: i + 1,
          fromAnchor: "bottom",
          toAnchor: "top",
          pathStyle: "orthogonal",
        });
      }
      return { cells, connections };
    }
    case "mind_map": {
      const cells: MapTemplateCellSpec[] = [
        {
          relX: 300,
          relY: 260,
          width: 280,
          height: 200,
          type: "brainstorm",
          color: "blue",
          shape: "ellipse",
          isExpanded: true,
          brainTitle: "중심 주제",
        },
        {
          relX: 340,
          relY: 40,
          width: 200,
          height: 88,
          type: "memo",
          color: "green",
          shape: "pill",
          memoTitle: "가지 1",
        },
        {
          relX: 640,
          relY: 300,
          width: 200,
          height: 88,
          type: "memo",
          color: "orange",
          shape: "pill",
          memoTitle: "가지 2",
        },
        {
          relX: 340,
          relY: 500,
          width: 200,
          height: 88,
          type: "memo",
          color: "teal",
          shape: "pill",
          memoTitle: "가지 3",
        },
        {
          relX: 40,
          relY: 300,
          width: 200,
          height: 88,
          type: "memo",
          color: "pink",
          shape: "pill",
          memoTitle: "가지 4",
        },
      ];
      const connections: MapTemplateConnSpec[] = [
        { from: 0, to: 1, fromAnchor: "top", toAnchor: "bottom", pathStyle: "bezier" },
        { from: 0, to: 2, fromAnchor: "right", toAnchor: "left", pathStyle: "bezier" },
        { from: 0, to: 3, fromAnchor: "bottom", toAnchor: "top", pathStyle: "bezier" },
        { from: 0, to: 4, fromAnchor: "left", toAnchor: "right", pathStyle: "bezier" },
      ];
      return { cells, connections };
    }
    case "workflow_map": {
      const W = 300;
      const H = 86;
      const G = 16;
      const titles = ["요청 접수", "검토", "승인", "처리", "완료"];
      const cells: MapTemplateCellSpec[] = titles.map((t, i) => ({
        relX: 40,
        relY: i * (H + G),
        width: W,
        height: H,
        type: "memo" as const,
        color: "blue",
        shape: "rounded" as const,
        memoTitle: t,
      }));
      const connections: MapTemplateConnSpec[] = [];
      for (let i = 0; i < cells.length - 1; i++) {
        connections.push({
          from: i,
          to: i + 1,
          fromAnchor: "bottom",
          toAnchor: "top",
          pathStyle: "orthogonal",
        });
      }
      return { cells, connections };
    }
    case "knowledge_map": {
      const cells: MapTemplateCellSpec[] = [
        {
          relX: 0,
          relY: 120,
          width: 220,
          height: 180,
          type: "memo",
          color: "green",
          memoTitle: "지식 A",
        },
        {
          relX: 260,
          relY: 80,
          width: 300,
          height: 240,
          type: "brainstorm",
          color: "blue",
          shape: "ellipse",
          isExpanded: true,
          brainTitle: "지식 허브",
        },
        {
          relX: 600,
          relY: 120,
          width: 220,
          height: 180,
          type: "memo",
          color: "purple",
          memoTitle: "지식 B",
        },
      ];
      const connections: MapTemplateConnSpec[] = [
        { from: 1, to: 0, fromAnchor: "left", toAnchor: "right", pathStyle: "orthogonal" },
        { from: 1, to: 2, fromAnchor: "right", toAnchor: "left", pathStyle: "orthogonal" },
      ];
      return { cells, connections };
    }
    case "flowchart": {
      const cells: MapTemplateCellSpec[] = [
        {
          relX: 200,
          relY: 0,
          width: 200,
          height: 72,
          type: "memo",
          color: "green",
          shape: "pill",
          memoTitle: "시작",
        },
        {
          relX: 200,
          relY: 100,
          width: 200,
          height: 88,
          type: "memo",
          color: "blue",
          shape: "rounded",
          memoTitle: "처리",
        },
        {
          relX: 200,
          relY: 210,
          width: 200,
          height: 100,
          type: "memo",
          color: "yellow",
          shape: "diamond",
          memoTitle: "판단?",
        },
        {
          relX: 200,
          relY: 340,
          width: 200,
          height: 88,
          type: "memo",
          color: "blue",
          shape: "rounded",
          memoTitle: "처리 2",
        },
        {
          relX: 200,
          relY: 450,
          width: 200,
          height: 72,
          type: "memo",
          color: "green",
          shape: "pill",
          memoTitle: "종료",
        },
      ];
      const connections: MapTemplateConnSpec[] = [
        { from: 0, to: 1, fromAnchor: "bottom", toAnchor: "top", pathStyle: "orthogonal" },
        { from: 1, to: 2, fromAnchor: "bottom", toAnchor: "top", pathStyle: "orthogonal" },
        { from: 2, to: 3, fromAnchor: "bottom", toAnchor: "top", label: "Yes", pathStyle: "orthogonal" },
        { from: 3, to: 4, fromAnchor: "bottom", toAnchor: "top", pathStyle: "orthogonal" },
      ];
      return { cells, connections };
    }
    case "concept_map": {
      const cells: MapTemplateCellSpec[] = [
        {
          relX: 260,
          relY: 40,
          width: 240,
          height: 160,
          type: "brainstorm",
          color: "orange",
          isExpanded: true,
          brainTitle: "핵심 개념",
        },
        {
          relX: 40,
          relY: 260,
          width: 220,
          height: 140,
          type: "brainstorm",
          color: "teal",
          isExpanded: true,
          brainTitle: "연관 개념 A",
        },
        {
          relX: 500,
          relY: 260,
          width: 220,
          height: 140,
          type: "brainstorm",
          color: "pink",
          isExpanded: true,
          brainTitle: "연관 개념 B",
        },
      ];
      const connections: MapTemplateConnSpec[] = [
        { from: 0, to: 1, fromAnchor: "bottom", toAnchor: "top", label: "포함", pathStyle: "bezier" },
        { from: 0, to: 2, fromAnchor: "bottom", toAnchor: "top", label: "영향", pathStyle: "bezier" },
      ];
      return { cells, connections };
    }
    case "strategy_map": {
      const titles = ["재무", "고객", "내부 프로세스", "학습·성장"];
      const cells: MapTemplateCellSpec[] = titles.map((t, i) => ({
        relX: 40,
        relY: i * 108,
        width: 520,
        height: 96,
        type: "memo" as const,
        color: (["default", "blue", "green", "purple"] as ModuleColor[])[i],
        shape: "rounded" as const,
        memoTitle: t,
        memoContent: `<p><strong>${t}</strong> 관점 목표</p>`,
      }));
      const connections: MapTemplateConnSpec[] = [
        { from: 3, to: 2, fromAnchor: "top", toAnchor: "bottom", pathStyle: "orthogonal" },
        { from: 2, to: 1, fromAnchor: "top", toAnchor: "bottom", pathStyle: "orthogonal" },
        { from: 1, to: 0, fromAnchor: "top", toAnchor: "bottom", pathStyle: "orthogonal" },
      ];
      return { cells, connections };
    }
    case "visual_map": {
      const cells: MapTemplateCellSpec[] = [];
      const cw = 200;
      const ch = 100;
      const gx = 220;
      const gy = 120;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          cells.push({
            relX: col * gx,
            relY: row * gy,
            width: cw,
            height: ch,
            type: "memo",
            color: (["yellow", "blue", "green", "pink", "orange", "teal"] as ModuleColor[])[
              row * 3 + col
            ],
            shape: "rectangle",
            memoTitle: `영역 ${row * 3 + col + 1}`,
          });
        }
      }
      return { cells, connections: [] };
    }
    case "swot_map": {
      const cells: MapTemplateCellSpec[] = [
        {
          relX: 0,
          relY: 0,
          width: 260,
          height: 140,
          type: "memo",
          color: "green",
          memoTitle: "Strengths · 강점",
        },
        {
          relX: 280,
          relY: 0,
          width: 260,
          height: 140,
          type: "memo",
          color: "yellow",
          memoTitle: "Weaknesses · 약점",
        },
        {
          relX: 0,
          relY: 160,
          width: 260,
          height: 140,
          type: "memo",
          color: "blue",
          memoTitle: "Opportunities · 기회",
        },
        {
          relX: 280,
          relY: 160,
          width: 260,
          height: 140,
          type: "memo",
          color: "pink",
          memoTitle: "Threats · 위협",
        },
        {
          relX: 210,
          relY: 70,
          width: 120,
          height: 80,
          type: "memo",
          color: "default",
          shape: "circle",
          memoTitle: "SWOT",
        },
      ];
      return { cells, connections: [] };
    }
    case "mental_map": {
      const cells: MapTemplateCellSpec[] = [
        {
          relX: 0,
          relY: 40,
          width: 200,
          height: 88,
          type: "memo",
          color: "green",
          shape: "pill",
          memoTitle: "질문 / 시작",
        },
        {
          relX: 240,
          relY: 40,
          width: 200,
          height: 88,
          type: "memo",
          color: "yellow",
          shape: "pill",
          memoTitle: "고려 사항",
        },
        {
          relX: 480,
          relY: 40,
          width: 200,
          height: 88,
          type: "memo",
          color: "orange",
          shape: "pill",
          memoTitle: "판단",
        },
        {
          relX: 720,
          relY: 40,
          width: 200,
          height: 88,
          type: "memo",
          color: "blue",
          shape: "pill",
          memoTitle: "결론",
        },
      ];
      const connections: MapTemplateConnSpec[] = [
        { from: 0, to: 1, fromAnchor: "right", toAnchor: "left", pathStyle: "orthogonal" },
        { from: 1, to: 2, fromAnchor: "right", toAnchor: "left", pathStyle: "orthogonal" },
        { from: 2, to: 3, fromAnchor: "right", toAnchor: "left", label: "Yes", pathStyle: "orthogonal" },
      ];
      return { cells, connections };
    }
    default:
      return buildCanvasMapTemplate("brainstorm");
  }
}
