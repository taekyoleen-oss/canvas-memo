import type { BrainstormMapType } from "@/types";

export interface BrainstormMapOptionMeta {
  id: BrainstormMapType;
  label: string;
  shortLabel: string;
  hint: string;
}

export const BRAINSTORM_MAP_OPTIONS: BrainstormMapOptionMeta[] = [
  { id: "brainstorm", label: "브레인스토밍", shortLabel: "브레인", hint: "빠른 아이디어 리스트" },
  { id: "process_map", label: "프로세스 맵", shortLabel: "프로세스", hint: "스윔레인·부서별 흐름" },
  { id: "mind_map", label: "마인드 맵", shortLabel: "마인드", hint: "중심에서 방사형 확장" },
  { id: "workflow_map", label: "워크플로 맵", shortLabel: "워크플로", hint: "단계·순서 중심" },
  { id: "knowledge_map", label: "지식 맵", shortLabel: "지식", hint: "중심 허브·좌우 지식 가지" },
  { id: "flowchart", label: "플로우차트", shortLabel: "플로우", hint: "시작·판단·처리 도형" },
  { id: "concept_map", label: "컨셉 맵", shortLabel: "컨셉", hint: "개념·관계 라벨" },
  { id: "strategy_map", label: "전략 맵", shortLabel: "전략", hint: "밸런스드 스코어카드 4관점" },
  { id: "visual_map", label: "비주얼 맵", shortLabel: "비주얼", hint: "공간 배치·격자" },
  { id: "swot_map", label: "SWOT 맵", shortLabel: "SWOT", hint: "강점·약점·기회·위협" },
  { id: "mental_map", label: "멘탈 맵", shortLabel: "멘탈", hint: "판단·가지 결정 트리" },
];
