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

// ── 연결 삭제 확인 다이얼로그 ──────────────────────────────────────────────
interface DeleteDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConnectionDialog({ onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-72 flex flex-col gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)] text-center">
          이 연결을 삭제하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 그룹 제거 확인 다이얼로그 ──────────────────────────────────────────────
interface GroupRemoveDialogProps {
  groupName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function GroupRemoveDialog({ groupName, onConfirm, onCancel }: GroupRemoveDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)] text-center">
          <span className="font-bold text-[var(--primary)]">&#39;{groupName}&#39;</span> 그룹에서도 제거하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            그룹 유지
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            그룹 제거
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConnectionLayer({ boardId, viewport }: ConnectionLayerProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const removeConnection = useCanvasStore((s) => s.removeConnection);
  const updateGroup = useCanvasStore((s) => s.updateGroup);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // 삭제 확인 dialog 상태
  const [pendingDelete, setPendingDelete] = useState<{
    connectionId: string;
    fromModuleId: string;
    toModuleId: string;
  } | null>(null);

  // 그룹 제거 확인 dialog 상태 (연결 삭제 후)
  const [pendingGroupRemove, setPendingGroupRemove] = useState<{
    groupId: string;
    groupName: string;
    moduleId: string;
  } | null>(null);

  if (!board || board.connections.length === 0) {
    return null;
  }

  // 접힌 그룹: moduleId → group 매핑
  const FOLDER_W = 90;
  const FOLDER_H = 76;
  const collapsedModuleToGroup = new Map(
    (board.groups ?? [])
      .filter((g) => g.isCollapsed)
      .flatMap((g) => g.moduleIds.map((id) => [id, g] as const))
  );

  // zoom에 무관하게 시각적 픽셀 크기를 일정하게 유지
  const sw = 2 / viewport.zoom;
  const swSelected = 2.5 / viewport.zoom;
  const hitSw = 18 / viewport.zoom;
  const badgeFontSize = 10 / viewport.zoom;
  const badgeW = 56 / viewport.zoom;
  const badgeH = 22 / viewport.zoom;
  const badgeRx = 11 / viewport.zoom;

  function handleConnectionClick(e: React.MouseEvent, connection: Connection) {
    e.stopPropagation();
    if (selectedConnectionId === connection.id) {
      // 삭제 dialog 열기
      setPendingDelete({
        connectionId: connection.id,
        fromModuleId: connection.fromModuleId,
        toModuleId: connection.toModuleId,
      });
    } else {
      setSelectedConnectionId(connection.id);
    }
  }

  function handleDeleteConfirm() {
    if (!pendingDelete) return;
    removeConnection(boardId, pendingDelete.connectionId);
    setSelectedConnectionId(null);

    // 삭제된 연결의 모듈이 그룹에 속해 있는지 확인
    const groups = board?.groups ?? [];
    const { fromModuleId, toModuleId } = pendingDelete;

    const fromGroup = groups.find((g) => g.moduleIds.includes(fromModuleId));
    const toGroup = groups.find((g) => g.moduleIds.includes(toModuleId));

    // 어느 쪽이든 그룹에 속해 있으면 그룹 제거 여부 묻기 (from 우선)
    if (fromGroup) {
      setPendingGroupRemove({
        groupId: fromGroup.id,
        groupName: fromGroup.name,
        moduleId: fromModuleId,
      });
    } else if (toGroup) {
      setPendingGroupRemove({
        groupId: toGroup.id,
        groupName: toGroup.name,
        moduleId: toModuleId,
      });
    }

    setPendingDelete(null);
  }

  function handleDeleteCancel() {
    setPendingDelete(null);
  }

  function handleGroupRemoveConfirm() {
    if (!pendingGroupRemove) return;
    const { groupId, moduleId } = pendingGroupRemove;
    const group = (board?.groups ?? []).find((g) => g.id === groupId);
    if (group) {
      updateGroup(boardId, groupId, {
        moduleIds: group.moduleIds.filter((id) => id !== moduleId),
      });
    }
    setPendingGroupRemove(null);
  }

  function handleGroupRemoveCancel() {
    setPendingGroupRemove(null);
  }

  const { x: vx, y: vy, zoom } = viewport;

  return (
    <>
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

            const fromCollapsedGroup = collapsedModuleToGroup.get(connection.fromModuleId);
            const toCollapsedGroup = collapsedModuleToGroup.get(connection.toModuleId);

            // 양쪽이 같은 접힌 그룹 내부이면 숨김
            if (
              fromCollapsedGroup &&
              toCollapsedGroup &&
              fromCollapsedGroup.id === toCollapsedGroup.id
            ) return null;

            // 접힌 그룹 아이콘을 가상 모듈로 변환하는 헬퍼
            const groupIconModule = (g: typeof fromCollapsedGroup) =>
              g
                ? { position: g.position, size: { width: FOLDER_W + 20, height: FOLDER_H } }
                : null;

            const fromEffective = groupIconModule(fromCollapsedGroup) ?? fromModule;
            const toEffective = groupIconModule(toCollapsedGroup) ?? toModule;

            const fromPos = getAnchorPosition(
              fromEffective as typeof fromModule,
              connection.fromAnchor as AnchorSide
            );
            const toPos = getAnchorPosition(
              toEffective as typeof toModule,
              connection.toAnchor as AnchorSide
            );

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

      {/* 연결 삭제 확인 dialog */}
      {pendingDelete && (
        <DeleteConnectionDialog
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      {/* 그룹 제거 확인 dialog */}
      {pendingGroupRemove && (
        <GroupRemoveDialog
          groupName={pendingGroupRemove.groupName}
          onConfirm={handleGroupRemoveConfirm}
          onCancel={handleGroupRemoveCancel}
        />
      )}
    </>
  );
}
