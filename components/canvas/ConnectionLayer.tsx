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
      <div
        className="relative rounded-2xl p-6 flex flex-col gap-4"
        style={{
          width: 288,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <p className="text-sm font-medium text-center" style={{ color: "var(--text-primary)" }}>
          이 연결을 삭제하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm transition-colors"
            style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "#EF4444", color: "#fff", border: "none", cursor: "pointer" }}
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
      <div
        className="relative rounded-2xl p-6 flex flex-col gap-4"
        style={{
          width: 320,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <p className="text-sm font-medium text-center" style={{ color: "var(--text-primary)" }}>
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>&#39;{groupName}&#39;</span> 그룹에서도 제거하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm transition-colors"
            style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            그룹 유지
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "#EF4444", color: "#fff", border: "none", cursor: "pointer" }}
          >
            그룹 제거
          </button>
        </div>
      </div>
    </div>
  );
}

const CONNECTION_COLORS = [
  { label: "기본", value: "" },
  { label: "빨강", value: "#EF4444" },
  { label: "초록", value: "#22C55E" },
  { label: "파랑", value: "#6366F1" },
  { label: "주황", value: "#F97316" },
  { label: "보라", value: "#A855F7" },
];

export default function ConnectionLayer({ boardId, viewport }: ConnectionLayerProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const removeConnection = useCanvasStore((s) => s.removeConnection);
  const updateConnection = useCanvasStore((s) => s.updateConnection);
  const updateGroup = useCanvasStore((s) => s.updateGroup);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  // 편집 패널 위치 (캔버스 좌표)
  const [editPanelPos, setEditPanelPos] = useState<{ x: number; y: number } | null>(null);

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

  function handleConnectionClick(e: React.MouseEvent, connection: Connection, midX: number, midY: number) {
    e.stopPropagation();
    if (selectedConnectionId === connection.id) {
      // 이미 선택된 상태에서 다시 클릭 → 편집 패널 토글 (닫기)
      setSelectedConnectionId(null);
      setEditPanelPos(null);
    } else {
      setSelectedConnectionId(connection.id);
      setEditPanelPos({ x: midX, y: midY });
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
                  onClick={(e) => handleConnectionClick(e, connection, midX, midY)}
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
                {/* 라벨 텍스트 */}
                {connection.label && (
                  <g style={{ pointerEvents: "none" }}>
                    <rect
                      x={midX - badgeW / 2}
                      y={midY - badgeH / 2}
                      width={badgeW}
                      height={badgeH}
                      rx={badgeRx}
                      fill="var(--surface-elevated)"
                      stroke={strokeColor}
                      strokeWidth={sw * 0.6}
                      opacity={0.95}
                    />
                    <text
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={badgeFontSize}
                      fill={isSelected ? "var(--primary)" : "var(--text-primary)"}
                      fontWeight={isSelected ? "600" : "400"}
                    >
                      {connection.label.length > 8
                        ? connection.label.slice(0, 7) + "…"
                        : connection.label}
                    </text>
                  </g>
                )}
                {/* 선택 시: 라벨 없을 때만 편집 표시 점 */}
                {isSelected && !connection.label && (
                  <circle
                    cx={midX}
                    cy={midY}
                    r={5 / zoom}
                    fill="var(--primary)"
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* 연결 편집 패널 */}
      {selectedConnectionId && editPanelPos && (() => {
        const conn = board.connections.find((c) => c.id === selectedConnectionId);
        if (!conn) return null;
        const { x: vx, y: vy, zoom } = viewport;
        const screenX = editPanelPos.x * zoom + vx;
        const screenY = editPanelPos.y * zoom + vy;
        return (
          <div
            style={{
              position: "absolute",
              left: screenX,
              top: screenY + 14,
              transform: "translateX(-50%)",
              zIndex: 60,
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              boxShadow: "var(--shadow-lg)",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minWidth: 200,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 라벨 입력 */}
            <input
              type="text"
              value={conn.label ?? ""}
              onChange={(e) => updateConnection(boardId, conn.id, { label: e.target.value })}
              placeholder="연결 라벨 (선택)"
              style={{
                height: 30,
                padding: "0 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: 12,
                outline: "none",
                width: "100%",
              }}
            />

            {/* 스타일: 실선/점선 */}
            <div style={{ display: "flex", gap: 6 }}>
              {(["solid", "dashed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateConnection(boardId, conn.id, { style: s })}
                  style={{
                    flex: 1,
                    height: 28,
                    borderRadius: 6,
                    border: (conn.style ?? "solid") === s
                      ? "2px solid var(--primary)"
                      : "1px solid var(--border)",
                    background: (conn.style ?? "solid") === s ? "var(--primary-soft)" : "transparent",
                    cursor: "pointer",
                    fontSize: 11,
                    color: (conn.style ?? "solid") === s ? "var(--primary)" : "var(--text-secondary)",
                    fontWeight: (conn.style ?? "solid") === s ? 600 : 400,
                  }}
                >
                  {s === "solid" ? "실선" : "점선"}
                </button>
              ))}
            </div>

            {/* 색상 선택 */}
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {CONNECTION_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => updateConnection(boardId, conn.id, { color: c.value })}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: (conn.color ?? "") === c.value
                      ? "3px solid var(--text-primary)"
                      : "2px solid var(--border)",
                    background: c.value || "var(--connection-default)",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {/* 삭제 버튼 */}
            <button
              onClick={() => {
                setPendingDelete({
                  connectionId: conn.id,
                  fromModuleId: conn.fromModuleId,
                  toModuleId: conn.toModuleId,
                });
                setSelectedConnectionId(null);
                setEditPanelPos(null);
              }}
              style={{
                height: 28,
                borderRadius: 6,
                border: "none",
                background: "#EF4444",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              연결 삭제
            </button>
          </div>
        );
      })()}

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
