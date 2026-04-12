/**
 * 두 터치 포인트 간의 유클리드 거리 계산
 */
export function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const t0 = touches[0];
  const t1 = touches[1];
  const dx = t1.clientX - t0.clientX;
  const dy = t1.clientY - t0.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 두 터치 포인트의 중간점(midpoint) 계산
 */
export function getTouchMidpoint(touches: TouchList): { x: number; y: number } {
  if (touches.length < 2) {
    return { x: touches[0].clientX, y: touches[0].clientY };
  }
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}
