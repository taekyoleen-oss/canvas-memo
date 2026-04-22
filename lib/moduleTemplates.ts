import { v4 as uuidv4 } from "uuid";
import type { BrainstormData, MemoData, ModuleType } from "@/types";

export interface ModuleTemplateMeta {
  id: string;
  label: string;
  description?: string;
  forTypes: ModuleType[];
}

export const MODULE_TEMPLATE_METAS: ModuleTemplateMeta[] = [
  { id: "blank", label: "빈 카드", forTypes: ["memo", "brainstorm"] },
  {
    id: "memo-meeting",
    label: "회의 메모",
    description: "안건·결정",
    forTypes: ["memo"],
  },
  {
    id: "memo-decision",
    label: "의사결정",
    description: "선택지·결론",
    forTypes: ["memo"],
  },
  {
    id: "brain-5w1h",
    label: "5W1H",
    forTypes: ["brainstorm"],
  },
  {
    id: "brain-procon",
    label: "찬반",
    forTypes: ["brainstorm"],
  },
  {
    id: "brain-mind-branch",
    label: "가지치기(중심→가지)",
    forTypes: ["brainstorm"],
  },
];

export function templatesForModuleType(type: ModuleType): ModuleTemplateMeta[] {
  return MODULE_TEMPLATE_METAS.filter((t) => t.forTypes.includes(type));
}

export function buildTemplateData(
  type: "memo" | "brainstorm",
  templateId: string | undefined
): MemoData | BrainstormData {
  const id = templateId && templateId !== "blank" ? templateId : "blank";
  if (type === "memo") {
    switch (id) {
      case "memo-meeting":
        return {
          title: "회의",
          content:
            "<p><strong>참석</strong></p><p></p><p><strong>안건</strong></p><p></p><p><strong>결정</strong></p><p></p><p><strong>다음 액션</strong></p><p></p>",
          previewLines: 2,
        };
      case "memo-decision":
        return {
          title: "의사결정",
          content:
            "<p><strong>배경</strong></p><p></p><p><strong>선택지 A / B</strong></p><p></p><p><strong>결론</strong></p><p></p>",
          previewLines: 2,
        };
      default:
        return { title: "새 메모", content: "", previewLines: 2 };
    }
  }

  switch (id) {
    case "brain-5w1h": {
      const items = [
        { id: uuidv4(), text: "Who (누가)" },
        { id: uuidv4(), text: "What (무엇을)" },
        { id: uuidv4(), text: "When (언제)" },
        { id: uuidv4(), text: "Where (어디서)" },
        { id: uuidv4(), text: "Why (왜)" },
        { id: uuidv4(), text: "How (어떻게)" },
      ];
      return { title: "5W1H", items, previewCount: 4, itemLinks: [] };
    }
    case "brain-procon": {
      const pro = uuidv4();
      const con = uuidv4();
      return {
        title: "찬반",
        items: [
          { id: pro, text: "찬성 / 장점" },
          { id: con, text: "반대 / 단점" },
        ],
        previewCount: 4,
        itemLinks: [],
      };
    }
    case "brain-mind-branch": {
      const center = uuidv4();
      const b1 = uuidv4();
      const b2 = uuidv4();
      return {
        title: "중심 주제",
        items: [
          { id: center, text: "중심 아이디어" },
          { id: b1, text: "가지 1" },
          { id: b2, text: "가지 2" },
        ],
        previewCount: 4,
        itemLinks: [
          { id: uuidv4(), fromItemId: center, toItemId: b1 },
          { id: uuidv4(), fromItemId: center, toItemId: b2 },
        ],
      };
    }
    default:
      return { title: "아이디어", items: [], previewCount: 4, itemLinks: [] };
  }
}
