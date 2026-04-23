import type { ModuleType } from "@/types";

/** 캔버스에 올리는 일반 모듈 (툴바·FAB 공통) */
export const STANDARD_MODULE_OPTIONS: { type: ModuleType; icon: string; label: string }[] = [
  { type: "memo",     icon: "📝", label: "메모" },
  { type: "schedule", icon: "✅", label: "일정" },
  { type: "image",    icon: "🖼", label: "이미지" },
  { type: "link",     icon: "🔗", label: "링크" },
  { type: "file",     icon: "📎", label: "파일" },
  { type: "table",    icon: "▦", label: "표" },
];

/** 메모 및 일정 보드 전용 */
export const MEMO_SCHEDULE_MODULE_OPTIONS: { type: ModuleType; icon: string; label: string }[] = [
  { type: "memo", icon: "📝", label: "메모" },
  { type: "schedule", icon: "✅", label: "일정" },
  { type: "image", icon: "🖼", label: "이미지" },
  { type: "link", icon: "🔗", label: "링크" },
  { type: "file", icon: "📎", label: "파일" },
  { type: "table", icon: "▦", label: "표" },
];

/** 주제별(노트) 보드 — 메모 슬롯은 넓은 범위의 노트로 표기 */
export const TOPIC_NOTES_MODULE_OPTIONS: { type: ModuleType; icon: string; label: string }[] = [
  { type: "memo", icon: "📓", label: "노트" },
  { type: "schedule", icon: "✅", label: "일정" },
  { type: "image", icon: "🖼", label: "이미지" },
  { type: "link", icon: "🔗", label: "링크" },
  { type: "file", icon: "📎", label: "파일" },
  { type: "table", icon: "▦", label: "표" },
];

export const BRAINSTORM_ADD_OPTION = {
  type: "brainstorm" as const,
  icon: "💡",
  label: "브레인스토밍",
};
