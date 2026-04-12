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

/**
 * 두 앵커 포인트 사이의 3차 베지어 SVG path 문자열 생성
 * control point 거리는 두 점 사이 거리의 절반 정도로 설정
 */
export function getBezierPath(
  from: { x: number; y: number },
  fromAnchor: AnchorSide,
  to: { x: number; y: number },
  toAnchor: AnchorSide
): string {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  // 컨트롤 포인트 거리: 두 점 사이 대각선의 40%, 최소 60px
  const dist = Math.max(Math.sqrt(dx * dx + dy * dy) * 0.4, 60);

  const fromTangent = getTangent(fromAnchor);
  const toTangent = getTangent(toAnchor);

  const cp1x = from.x + fromTangent.dx * dist;
  const cp1y = from.y + fromTangent.dy * dist;

  const cp2x = to.x + toTangent.dx * dist;
  const cp2y = to.y + toTangent.dy * dist;

  return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
}
