"use client";

interface CanvasGridProps {
  viewport: { x: number; y: number; zoom: number };
}

const DOT_SIZE = 1.5;
const GRID_SPACING = 20;

export default function CanvasGrid({ viewport }: CanvasGridProps) {
  // 패턴은 zoom에 따라 크기 변환, offset은 viewport 이동에 따라 이동
  const patternSize = GRID_SPACING * viewport.zoom;
  // offset: viewport translate를 패턴 크기로 나눈 나머지 (패턴 반복)
  const offsetX = viewport.x % patternSize;
  const offsetY = viewport.y % patternSize;

  const patternId = "canvas-grid-dots";

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={patternId}
          x={offsetX}
          y={offsetY}
          width={patternSize}
          height={patternSize}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={patternSize / 2}
            cy={patternSize / 2}
            r={DOT_SIZE / 2 * viewport.zoom}
            fill="var(--canvas-grid)"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
