"use client";

import { useState } from "react";
import { useCanvasStore } from "@/store/canvas";
import { getAnchorPosition } from "@/lib/canvas/geometry";
import { getBezierPath, getBezierMidpoint } from "@/lib/canvas/bezier";
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

// 각 연결선의 렌더 데이터
interface ConnRenderItem {
  connection: Connection;
  pathD: string;
  midX: number;   // canvas 좌표
  midY: number;
  screenMidX: number;  // screen 좌표
  screenMidY: number;
  isSelected: boolean;
  strokeColor: string;
  dashArray: string | undefined;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
}

// toAnchor 방향에 따른 화살표 방향 (선이 toPos에 도착할 때 이동 방향 = -toTangent)
const ARROW_DIR: Record<AnchorSide, { dx: number; dy: number }> = {
  top:    { dx:  0, dy:  1 },  // top 앵커: cp2가 위쪽 → 선이 아래로 들어옴
  bottom: { dx:  0, dy: -1 },  // bottom 앵커: cp2가 아래쪽 → 선이 위로 들어옴
  left:   { dx:  1, dy:  0 },  // left 앵커: cp2가 왼쪽 → 선이 오른쪽으로 들어옴
  right:  { dx: -1, dy:  0 },  // right 앵커: cp2가 오른쪽 → 선이 왼쪽으로 들어옴
};

export default function ConnectionLayer({ boardId, viewport }: ConnectionLayerProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const removeConnection = useCanvasStore((s) => s.removeConnection);
  const updateConnection = useCanvasStore((s) => s.updateConnection);
  const updateGroup = useCanvasStore((s) => s.updateGroup);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [editPanelPos, setEditPanelPos] = useState<{ x: number; y: number } | null>(null);

  const [pendingDelete, setPendingDelete] = useState<{
    connectionId: string;
    fromModuleId: string;
    toModuleId: string;
  } | null>(null);

  const [pendingGroupRemove, setPendingGroupRemove] = useState<{
    groupId: string;
    groupName: string;
    moduleId: string;
  } | null>(null);

  const { x: vx, y: vy, zoom } = viewport;

  // ── 이벤트 핸들러 ────────────────────────────────────────────────────────

  function handleConnectionClick(e: React.MouseEvent, connection: Connection, midX: number, midY: number) {
    e.stopPropagation();
    if (selectedConnectionId === connection.id) {
      setSelectedConnectionId(null);
      setEditPanelPos(null);
    } else {
      setSelectedConnectionId(connection.id);
      setEditPanelPos({ x: midX, y: midY });
    }
  }

  function handleQuickDelete(e: React.MouseEvent, connection: Connection) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedConnectionId(null);
    setEditPanelPos(null);
    setPendingDelete({
      connectionId: connection.id,
      fromModuleId: connection.fromModuleId,
      toModuleId: connection.toModuleId,
    });
  }

  function handleDeleteConfirm() {
    if (!pendingDelete) return;
    removeConnection(boardId, pendingDelete.connectionId);
    setSelectedConnectionId(null);

    const groups = board?.groups ?? [];
    const { fromModuleId, toModuleId } = pendingDelete;
    const fromGroup = groups.find((g) => g.moduleIds.includes(fromModuleId));
    const toGroup = groups.find((g) => g.moduleIds.includes(toModuleId));

    if (fromGroup) {
      setPendingGroupRemove({ groupId: fromGroup.id, groupName: fromGroup.name, moduleId: fromModuleId });
    } else if (toGroup) {
      setPendingGroupRemove({ groupId: toGroup.id, groupName: toGroup.name, moduleId: toModuleId });
    }

    setPendingDelete(null);
  }

  function handleGroupRemoveConfirm() {
    if (!pendingGroupRemove) return;
    const { groupId, moduleId } = pendingGroupRemove;
    const group = (board?.groups ?? []).find((g) => g.id === groupId);
    if (group) {
      updateGroup(boardId, groupId, { moduleIds: group.moduleIds.filter((id) => id !== moduleId) });
    }
    setPendingGroupRemove(null);
  }

  if (!board) return null;

  // 접힌 그룹: moduleId → group 매핑
  const FOLDER_W = 90;
  const FOLDER_H = 76;
  const collapsedModuleToGroup = new Map(
    (board.groups ?? [])
      .filter((g) => g.isCollapsed)
      .flatMap((g) => g.moduleIds.map((id) => [id, g] as const))
  );

  // zoom에 무관한 시각적 크기 유지
  const sw = 2 / zoom;
  const swSelected = 2.5 / zoom;
  const hitSw = 18 / zoom;
  const badgeFontSize = 10 / zoom;
  const badgeW = 56 / zoom;
  const badgeH = 22 / zoom;
  const badgeRx = 11 / zoom;

  // ── 모든 연결선 렌더 데이터를 미리 계산 ──────────────────────────────────
  const renderItems: ConnRenderItem[] = [];

  for (const connection of board.connections) {
    const fromModule = board.modules.find((m) => m.id === connection.fromModuleId);
    const toModule = board.modules.find((m) => m.id === connection.toModuleId);
    if (!fromModule || !toModule) continue;

    const fromCollapsedGroup = collapsedModuleToGroup.get(connection.fromModuleId);
    const toCollapsedGroup = collapsedModuleToGroup.get(connection.toModuleId);

    if (
      fromCollapsedGroup &&
      toCollapsedGroup &&
      fromCollapsedGroup.id === toCollapsedGroup.id
    ) continue;

    const groupIconModule = (g: typeof fromCollapsedGroup) =>
      g ? { position: g.position, size: { width: FOLDER_W + 20, height: FOLDER_H } } : null;

    const fromEffective = groupIconModule(fromCollapsedGroup) ?? fromModule;
    const toEffective = groupIconModule(toCollapsedGroup) ?? toModule;

    const fromPos = getAnchorPosition(fromEffective as typeof fromModule, connection.fromAnchor as AnchorSide);
    const toPos = getAnchorPosition(toEffective as typeof toModule, connection.toAnchor as AnchorSide);

    const pathD = getBezierPath(fromPos, connection.fromAnchor as AnchorSide, toPos, connection.toAnchor as AnchorSide);

    const isSelected = selectedConnectionId === connection.id;
    const strokeColor = isSelected ? "var(--primary)" : (connection.color || "var(--connection-default)");
    const dashArray = connection.style === "dashed" ? `${8 / zoom} ${6 / zoom}` : undefined;

    // 베지어 곡선의 실제 시각적 중점 (t=0.5)
    const { x: midX, y: midY } = getBezierMidpoint(
      fromPos, connection.fromAnchor as AnchorSide,
      toPos, connection.toAnchor as AnchorSide
    );

    renderItems.push({
      connection,
      pathD,
      midX,
      midY,
      screenMidX: midX * zoom + vx,
      screenMidY: midY * zoom + vy,
      isSelected,
      strokeColor,
      dashArray,
      fromPos,
      toPos,
    });
  }

  if (renderItems.length === 0 && !pendingDelete && !pendingGroupRemove) return null;

  return (
    <>
      {/* ── SVG: 연결선 + 라벨 ─────────────────────────────────────────── */}
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
        <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
          {renderItems.map(({ connection, pathD, midX, midY, isSelected, strokeColor, dashArray, fromPos, toPos }) => {
            const opacity = isSelected ? 1 : 0.75;
            const dotR = 3.5 / zoom;
            const arrowLen = 9 / zoom;
            const arrowHw  = 4.5 / zoom;
            const { dx, dy } = ARROW_DIR[connection.toAnchor as AnchorSide];
            const ax = toPos.x, ay = toPos.y;
            const arrowPoints = [
              `${ax},${ay}`,
              `${ax - dx * arrowLen - dy * arrowHw},${ay - dy * arrowLen + dx * arrowHw}`,
              `${ax - dx * arrowLen + dy * arrowHw},${ay - dy * arrowLen - dx * arrowHw}`,
            ].join(" ");
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
                opacity={opacity}
                style={{ pointerEvents: "none" }}
              />
              {/* 시작 점 */}
              <circle
                cx={fromPos.x}
                cy={fromPos.y}
                r={dotR}
                fill={strokeColor}
                opacity={opacity}
                style={{ pointerEvents: "none" }}
              />
              {/* 끝 화살표 */}
              <polygon
                points={arrowPoints}
                fill={strokeColor}
                opacity={opacity}
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
                    {connection.label.length > 8 ? connection.label.slice(0, 7) + "…" : connection.label}
                  </text>
                </g>
              )}
            </g>
            );
          })}
        </g>
      </svg>

      {/* ── HTML 레이어: 편집 버튼 (SVG 밖 → 클릭 이벤트 완전 신뢰) ─── */}
      {renderItems.map(({ connection, screenMidX, screenMidY, midX, midY, isSelected }) => (
        <button
          key={`edit-${connection.id}`}
          onClick={(e) => handleConnectionClick(e, connection, midX, midY)}
          title="연결선 편집"
          style={{
            position: "absolute",
            left: screenMidX,
            top: screenMidY,
            transform: "translate(-50%, -50%)",
            width: isSelected ? 22 : 17,
            height: isSelected ? 22 : 17,
            borderRadius: "50%",
            background: isSelected ? "var(--primary)" : "var(--surface-elevated)",
            border: isSelected ? "2px solid var(--surface)" : "1.5px solid var(--border)",
            color: isSelected ? "#fff" : "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: isSelected ? 1 : 0.6,
            zIndex: 56,
            transition: "all 150ms ease",
            padding: 0,
            boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
          }}
        >
          {/* 편집 아이콘 (펜) */}
          <svg
            width={isSelected ? 11 : 9}
            height={isSelected ? 11 : 9}
            viewBox="0 0 14 14"
            fill="none"
            style={{ pointerEvents: "none", flexShrink: 0 }}
          >
            <path
              d="M9.5 1.5 L12.5 4.5 L4.5 12.5 L1 13 L1.5 9.5 Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 3 L11 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ))}

      {/* ── 연결선 편집 패널 ──────────────────────────────────────────────── */}
      {selectedConnectionId && editPanelPos && (() => {
        const conn = board.connections.find((c) => c.id === selectedConnectionId);
        if (!conn) return null;
        const screenX = editPanelPos.x * zoom + vx;
        const screenY = editPanelPos.y * zoom + vy;
        const closePanel = () => { setSelectedConnectionId(null); setEditPanelPos(null); };
        return (
          <>
          {/* 외부 클릭 감지용 투명 오버레이 */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 59 }}
            onClick={closePanel}
          />
          <div
            style={{
              position: "absolute",
              left: screenX,
              top: screenY + 20,
              transform: "translateX(-50%)",
              zIndex: 60,
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "var(--shadow-lg)",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minWidth: 216,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>연결선 편집</span>
              <button
                onClick={closePanel}
                style={{
                  width: 22, height: 22, borderRadius: "50%",
                  border: "none", background: "var(--surface)",
                  color: "var(--text-secondary)", cursor: "pointer",
                  fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* 라벨 입력 */}
            <input
              type="text"
              value={conn.label ?? ""}
              onChange={(e) => updateConnection(boardId, conn.id, { label: e.target.value })}
              placeholder="라벨 입력 (선택)"
              style={{
                height: 32,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-primary)",
                fontSize: 12,
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />

            {/* 선 스타일 */}
            <div>
              <p style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 5, marginTop: 0 }}>선 스타일</p>
              <div style={{ display: "flex", gap: 6 }}>
                {(["solid", "dashed"] as const).map((s) => {
                  const active = (conn.style ?? "solid") === s;
                  return (
                    <button
                      key={s}
                      onClick={() => updateConnection(boardId, conn.id, { style: s })}
                      style={{
                        flex: 1, height: 30, borderRadius: 8,
                        border: active ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: active ? "var(--primary-soft)" : "transparent",
                        cursor: "pointer", fontSize: 11,
                        color: active ? "var(--primary)" : "var(--text-secondary)",
                        fontWeight: active ? 600 : 400,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      }}
                    >
                      <svg width="18" height="6" viewBox="0 0 18 6" style={{ pointerEvents: "none" }}>
                        {s === "solid"
                          ? <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          : <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />}
                      </svg>
                      {s === "solid" ? "실선" : "점선"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 색상 선택 */}
            <div>
              <p style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 5, marginTop: 0 }}>색상</p>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {CONNECTION_COLORS.map((c) => {
                  const active = (conn.color ?? "") === c.value;
                  return (
                    <button
                      key={c.value}
                      title={c.label}
                      onClick={() => updateConnection(boardId, conn.id, { color: c.value })}
                      style={{
                        width: 22, height: 22, borderRadius: "50%",
                        border: active ? "3px solid var(--text-primary)" : "2px solid var(--border)",
                        background: c.value || "var(--connection-default)",
                        cursor: "pointer", flexShrink: 0,
                        boxShadow: active ? "0 0 0 2px var(--surface-elevated)" : "none",
                        outline: "none",
                        transform: active ? "scale(1.15)" : "scale(1)",
                        transition: "transform 120ms ease",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ height: 1, background: "var(--border)", margin: "0 -2px" }} />

            {/* 삭제 버튼 */}
            <button
              onClick={(e) => handleQuickDelete(e, conn)}
              style={{
                height: 32, borderRadius: 8,
                border: "1px solid #EF4444",
                background: "transparent",
                color: "#EF4444",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ pointerEvents: "none" }}>
                <path d="M2 3.5h10M5.5 3.5V2.5h3v1M5.5 6v4.5M8.5 6v4.5M3 3.5l.7 8h6.6l.7-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              연결 삭제
            </button>
          </div>
          </>
        );
      })()}

      {/* ── 연결 삭제 확인 dialog ─────────────────────────────────────────── */}
      {pendingDelete && (
        <DeleteConnectionDialog
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* ── 그룹 제거 확인 dialog ─────────────────────────────────────────── */}
      {pendingGroupRemove && (
        <GroupRemoveDialog
          groupName={pendingGroupRemove.groupName}
          onConfirm={handleGroupRemoveConfirm}
          onCancel={() => setPendingGroupRemove(null)}
        />
      )}
    </>
  );
}
