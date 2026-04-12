import type { Module } from "@/types";

export type AnchorSide = "top" | "right" | "bottom" | "left";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * 스크린 좌표 → 캔버스 좌표 변환
 * canvas = (screen - viewport.offset) / zoom
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: (screenX - viewport.x) / viewport.zoom,
    y: (screenY - viewport.y) / viewport.zoom,
  };
}

/**
 * 캔버스 좌표 → 스크린 좌표 변환
 * screen = canvas * zoom + viewport.offset
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: canvasX * viewport.zoom + viewport.x,
    y: canvasY * viewport.zoom + viewport.y,
  };
}

/**
 * 앵커 포인트의 캔버스 좌표 계산
 * module.position은 캔버스 좌표 기준
 */
export function getAnchorPosition(
  module: Module,
  anchor: AnchorSide
): { x: number; y: number } {
  const { x, y } = module.position;
  const { width, height } = module.size;

  switch (anchor) {
    case "top":
      return { x: x + width / 2, y };
    case "right":
      return { x: x + width, y: y + height / 2 };
    case "bottom":
      return { x: x + width / 2, y: y + height };
    case "left":
      return { x, y: y + height / 2 };
  }
}
