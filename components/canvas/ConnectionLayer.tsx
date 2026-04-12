"use client";

import { useState } from "react";
import { useCanvasStore } from "@/store/canvas";
import { getAnchorPosition } from "@/lib/canvas/geometry";
import { getBezierPath } from "@/lib/canvas/bezier";
import type { AnchorSide } from "@/lib/canvas/geometry";
import type { Connection } from "@/types";

interface ConnectionLayerProps {
  boardId: string;
}

export default function ConnectionLayer({ boardId }: ConnectionLayerProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const removeConnection = useCanvasStore((s) => s.removeConnection);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  if (!board || board.connections.length === 0) {
    return null;
  }

  function handleConnectionClick(e: React.MouseEvent, connection: Connection) {
    e.stopPropagation();
    if (selectedConnectionId === connection.id) {
      // 두 번 탭 → 삭제 확인
      if (window.confirm("이 연결을 삭제하시겠습니까?")) {
        removeConnection(boardId, connection.id);
        setSelectedConnectionId(null);
      }
    } else {
      setSelectedConnectionId(connection.id);
    }
  }

  function handleBackgroundClick() {
    setSelectedConnectionId(null);
  }

  return (
    <svg
      className="absolute inset-0"
      style={{ width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
      onClick={handleBackgroundClick}
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
        >
          <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)" />
        </marker>
      </defs>

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
        const dashArray = connection.style === "dashed" ? "8 6" : undefined;
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;

        return (
          <g key={connection.id}>
            {/* 히트 영역 */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={(e) => handleConnectionClick(e, connection)}
            />
            {/* 실제 선 */}
            <path
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 2}
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
                  x={midX - 28}
                  y={midY - 11}
                  width={56}
                  height={22}
                  rx={11}
                  fill="var(--primary)"
                />
                <text
                  x={midX}
                  y={midY + 4}
                  textAnchor="middle"
                  fontSize={10}
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
    </svg>
  );
}
