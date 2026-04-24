import type { Board, BrainstormMapType } from "@/types";
import { getCanvasMapTemplateSize } from "@/lib/canvas/mapTemplates";

/** 툴바 등에서 맵 템플릿을 열 때 — 화면 중심 대신 보드 콘텐츠 중심에 가깝게 배치 */
export function defaultMapTemplateOrigin(
  board: Board | undefined,
  templateId: BrainstormMapType
): { x: number; y: number } {
  const { width, height } = getCanvasMapTemplateSize(templateId);
  const modules = board?.modules ?? [];
  if (modules.length === 0) {
    return { x: 100, y: 100 };
  }
  const minX = Math.min(...modules.map((m) => m.position.x));
  const minY = Math.min(...modules.map((m) => m.position.y));
  const maxX = Math.max(...modules.map((m) => m.position.x + m.size.width));
  const maxY = Math.max(
    ...modules.map((m) => m.position.y + (m.isExpanded ? m.size.height : 68))
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { x: Math.round(cx - width / 2), y: Math.round(cy - height / 2) };
}
