import type { AnchorSide } from "./geometry";

/**
 * 앵커 방향에 따른 탄젠트 벡터 반환
 * 커브가 앵커에서 자연스럽게 빠져나오도록 방향성 부여
 */
function getTangent(anchor: AnchorSide): { dx: number; dy: number } {
  switch (anchor) {
    case "top":
      return { dx: 0, dy: -1 };
    case "right":
      return { dx: 1, dy: 0 };
    case "bottom":
      return { dx: 0, dy: 1 };
    case "left":
      return { dx: -1, dy: 0 };
  }
}

/** 베지어 컨트롤 포인트 계산 (내부 공유 헬퍼) */
function getControlPoints(
  from: { x: number; y: number },
  fromAnchor: AnchorSide,
  to: { x: number; y: number },
  toAnchor: AnchorSide
) {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const dist = Math.max(Math.sqrt(dx * dx + dy * dy) * 0.4, 60);

  const fromTangent = getTangent(fromAnchor);
  const toTangent = getTangent(toAnchor);

  return {
    cp1x: from.x + fromTangent.dx * dist,
    cp1y: from.y + fromTangent.dy * dist,
    cp2x: to.x + toTangent.dx * dist,
    cp2y: to.y + toTangent.dy * dist,
  };
}

/**
 * 두 앵커 포인트 사이의 3차 베지어 SVG path 문자열 생성
 */
export function getBezierPath(
  from: { x: number; y: number },
  fromAnchor: AnchorSide,
  to: { x: number; y: number },
  toAnchor: AnchorSide
): string {
  const { cp1x, cp1y, cp2x, cp2y } = getControlPoints(from, fromAnchor, to, toAnchor);
  return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
}

/**
 * 베지어 곡선 위 t=0.5 지점의 좌표 반환 (시각적 중점)
 * 공식: B(0.5) = (P0 + 3·P1 + 3·P2 + P3) / 8
 */
export function getBezierMidpoint(
  from: { x: number; y: number },
  fromAnchor: AnchorSide,
  to: { x: number; y: number },
  toAnchor: AnchorSide
): { x: number; y: number } {
  const { cp1x, cp1y, cp2x, cp2y } = getControlPoints(from, fromAnchor, to, toAnchor);
  return {
    x: (from.x + 3 * cp1x + 3 * cp2x + to.x) / 8,
    y: (from.y + 3 * cp1y + 3 * cp2y + to.y) / 8,
  };
}
