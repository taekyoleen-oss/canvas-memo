"use client";

import { useState } from "react";
import { useCanvasStore } from "@/store/canvas";
import { getAnchorPosition } from "@/lib/canvas/geometry";
import { getBezierPath } from "@/lib/canvas/bezier";
import type { AnchorSide } from "@/lib/canvas/geometry";
import type { Connection } from "@/types";

interface ConnectionLayerProps {
  boardId: string;
  viewport: { x: number; y: number; zoom: number };
}

export default function ConnectionLayer({ boardId, viewport }: ConnectionLayerProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const removeConnection = useCanvasStore((s) => s.removeConnection);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  if (!board || board.connections.length === 0) {
    return null;
  }

  // zoom에 무관하게 시각적 픽셀 크기를 일정하게 유지
  const sw = 2 / viewport.zoom;          // 기본 선 굵기 2px
  const swSelected = 2.5 / viewport.zoom;
  const hitSw = 18 / viewport.zoom;      // 히트 영역 18px
  const badgeFontSize = 10 / viewport.zoom;
  const badgeW = 56 / viewport.zoom;
  const badgeH = 22 / viewport.zoom;
  const badgeRx = 11 / viewport.zoom;

  function handleConnectionClick(e: React.MouseEvent, connection: Connection) {
    e.stopPropagation();
    if (selectedConnectionId === connection.id) {
      if (window.confirm("이 연결을 삭제하시겠습니까?")) {
        removeConnection(boardId, connection.id);
        setSelectedConnectionId(null);
      }
    } else {
      setSelectedConnectionId(connection.id);
    }
  }

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
      aria-label="커넥션 레이어"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="var(--connection-default)" opacity="0.85" />
        </marker>
        <marker
          id="arrowhead-selected"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)" />
        </marker>
      </defs>

      {/* 뷰포트 변환: canvas 좌표 → screen 좌표 */}
      <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
        {board.connections.map((connection) => {
          const fromModule = board.modules.find((m) => m.id === connection.fromModuleId);
          const toModule = board.modules.find((m) => m.id === connection.toModuleId);
          if (!fromModule || !toModule) return null;

          const fromPos = getAnchorPosition(fromModule, connection.fromAnchor as AnchorSide);
          const toPos = getAnchorPosition(toModule, connection.toAnchor as AnchorSide);

          const pathD = getBezierPath(
            fromPos,
            connection.fromAnchor as AnchorSide,
            toPos,
            connection.toAnchor as AnchorSide
          );

          const isSelected = selectedConnectionId === connection.id;
          const strokeColor = isSelected ? "var(--primary)" : (connection.color || "var(--connection-default)");
          const dashArray = connection.style === "dashed" ? `${8 / zoom} ${6 / zoom}` : undefined;
          const midX = (fromPos.x + toPos.x) / 2;
          const midY = (fromPos.y + toPos.y) / 2;

          return (
            <g key={connection.id}>
              {/* 히트 영역 */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={hitSw}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onClick={(e) => handleConnectionClick(e, connection)}
              />
              {/* 실제 선 */}
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isSelected ? swSelected : sw}
                strokeDasharray={dashArray}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isSelected ? 1 : 0.75}
                markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                style={{ pointerEvents: "none" }}
              />
              {/* 선택 시: 삭제 버튼 배지 */}
              {isSelected && (
                <g
                  style={{ pointerEvents: "all", cursor: "pointer" }}
                  onClick={(e) => handleConnectionClick(e, connection)}
                >
                  <rect
                    x={midX - badgeW / 2}
                    y={midY - badgeH / 2}
                    width={badgeW}
                    height={badgeH}
                    rx={badgeRx}
                    fill="var(--primary)"
                  />
                  <text
                    x={midX}
                    y={midY + badgeFontSize * 0.4}
                    textAnchor="middle"
                    fontSize={badgeFontSize}
                    fontWeight={600}
                    fill="white"
                    style={{ userSelect: "none" }}
                  >
                    ✕ 삭제
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
