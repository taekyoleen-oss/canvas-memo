"use client";

import { useConnectionStore } from "@/store/connection";
import { useCanvasStore } from "@/store/canvas";
import { getAnchorPosition } from "@/lib/canvas/geometry";
import { getBezierPath } from "@/lib/canvas/bezier";
import type { AnchorSide } from "@/lib/canvas/geometry";

interface ConnectionPreviewProps {
  boardId: string;
}

export default function ConnectionPreview({ boardId }: ConnectionPreviewProps) {
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

  // 프리뷰 끝점은 커서/터치 위치 (이미 캔버스 좌표)
  const toPos = previewPos;

  // 프리뷰 to 앵커: 대략적으로 from의 반대 방향
  const oppositeAnchor: Record<AnchorSide, AnchorSide> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  const toAnchor = oppositeAnchor[fromAnchor as AnchorSide];

  const pathD = getBezierPath(fromPos, fromAnchor as AnchorSide, toPos, toAnchor);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
      aria-hidden="true"
    >
      <path
        d={pathD}
        fill="none"
        stroke="var(--primary)"
        strokeOpacity={0.6}
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
      {/* 끝점에 작은 원 */}
      <circle
        cx={toPos.x}
        cy={toPos.y}
        r={5}
        fill="var(--primary)"
        opacity={0.6}
      />
    </svg>
  );
}
