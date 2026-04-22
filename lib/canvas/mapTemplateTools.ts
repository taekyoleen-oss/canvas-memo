import type { BrainstormMapType } from "@/types";

export type MapToolKind = "memo" | "brainstorm" | "lane-memo";

export interface MapToolDef {
  id: string;
  label: string;
  kind: MapToolKind;
  hint?: string;
}

const DEFAULT_TOOLS: MapToolDef[] = [
  { id: "add-memo", label: "메모 카드", kind: "memo", hint: "자유 메모 블록" },
  { id: "add-brain", label: "브레인 카드", kind: "brainstorm", hint: "아이디어 리스트" },
];

/** 템플릿별로 우측 패널에 노출할 도구 */
const MAP_TEMPLATE_TOOLS: Partial<Record<BrainstormMapType, MapToolDef[]>> = {
  brainstorm: [
    { id: "add-memo", label: "메모", kind: "memo" },
    { id: "add-brain", label: "브레인", kind: "brainstorm" },
  ],
  process_map: [
    { id: "add-lane", label: "스윔 레인", kind: "lane-memo", hint: "가로 한 줄 레인" },
    { id: "add-memo", label: "메모", kind: "memo" },
    { id: "add-brain", label: "브레인", kind: "brainstorm" },
  ],
  mind_map: [
    { id: "add-memo", label: "가지 메모", kind: "memo", hint: "짧은 메모 블록" },
    { id: "add-brain", label: "브레인", kind: "brainstorm" },
  ],
  workflow_map: [
    { id: "add-memo", label: "단계 메모", kind: "memo" },
    { id: "add-brain", label: "브레인", kind: "brainstorm" },
  ],
  knowledge_map: DEFAULT_TOOLS,
  flowchart: [
    { id: "add-memo", label: "도형 메모", kind: "memo" },
    { id: "add-brain", label: "브레인", kind: "brainstorm" },
  ],
  concept_map: DEFAULT_TOOLS,
  strategy_map: DEFAULT_TOOLS,
  visual_map: DEFAULT_TOOLS,
  swot_map: [
    { id: "add-memo", label: "사분면 메모", kind: "memo" },
    { id: "add-brain", label: "브레인", kind: "brainstorm" },
  ],
  mental_map: DEFAULT_TOOLS,
};

export function getMapToolsForTemplate(id: BrainstormMapType): MapToolDef[] {
  return MAP_TEMPLATE_TOOLS[id] ?? DEFAULT_TOOLS;
}

export function findMapToolDef(
  templateId: BrainstormMapType,
  toolId: string
): MapToolDef | undefined {
  return getMapToolsForTemplate(templateId).find((t) => t.id === toolId);
}
