"use client";

import { useConnectionStore } from "@/store/connection";
import { useCanvasStore } from "@/store/canvas";
import { getAnchorPosition } from "@/lib/canvas/geometry";
import { getBezierPath } from "@/lib/canvas/bezier";
import type { AnchorSide } from "@/lib/canvas/geometry";

interface ConnectionPreviewProps {
  boardId: string;
  viewport: { x: number; y: number; zoom: number };
}

export default function ConnectionPreview({ boardId, viewport }: ConnectionPreviewProps) {
  const mode = useConnectionStore((s) => s.mode);
  const fromModuleId = useConnectionStore((s) => s.fromModuleId);
  const fromAnchor = useConnectionStore((s) => s.fromAnchor);
  const previewPos = useConnectionStore((s) => s.previewPos);

  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));

  if (mode !== "connecting" || !fromModuleId || !fromAnchor || !previewPos || !board) {
    return null;
  }

  const fromModule = board.modules.find((m) => m.id === fromModuleId);
  if (!fromModule) return null;

  const fromPos = getAnchorPosition(fromModule, fromAnchor as AnchorSide);
  const toPos = previewPos;

  const oppositeAnchor: Record<AnchorSide, AnchorSide> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  const toAnchor = oppositeAnchor[fromAnchor as AnchorSide];

  const pathD = getBezierPath(fromPos, fromAnchor as AnchorSide, toPos, toAnchor);

  const sw = 2 / viewport.zoom;
  const circleR = 5 / viewport.zoom;
  const { x: vx, y: vy, zoom } = viewport;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {/* 뷰포트 변환: canvas 좌표 → screen 좌표 */}
      <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
        <path
          d={pathD}
          fill="none"
          stroke="var(--primary)"
          strokeOpacity={0.6}
          strokeWidth={sw}
          strokeDasharray={`${6 / zoom} ${4 / zoom}`}
          strokeLinecap="round"
        />
        {/* 끝점에 작은 원 */}
        <circle
          cx={toPos.x}
          cy={toPos.y}
          r={circleR}
          fill="var(--primary)"
          opacity={0.6}
        />
      </g>
    </svg>
  );
}
