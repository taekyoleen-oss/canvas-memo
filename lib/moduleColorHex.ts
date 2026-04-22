import type { ModuleColor } from "@/types";

/** 연결선·화살표 확장용 — 모듈 색상 키에 맞춘 가시성 있는 스트로크 색 */
export const MODULE_COLOR_STROKE_HEX: Record<ModuleColor, string> = {
  default: "#64748b",
  yellow: "#CA8A04",
  pink: "#BE185D",
  blue: "#2563eb",
  green: "#16a34a",
  purple: "#9333ea",
  orange: "#ea580c",
  teal: "#0d9488",
};

export function moduleColorToConnectionHex(color: ModuleColor): string {
  return MODULE_COLOR_STROKE_HEX[color] ?? MODULE_COLOR_STROKE_HEX.default;
}
