"use client";

import { useState, useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/canvas";
import { getAnchorPosition } from "@/lib/canvas/geometry";
import { getBezierPath, getBezierMidpoint } from "@/lib/canvas/bezier";
import type { AnchorSide } from "@/lib/canvas/geometry";
import type { Connection, Module } from "@/types";

interface ConnectionLayerProps {
  boardId: string;
  viewport: { x: number; y: number; zoom: number };
}

// ── 연결 삭제 확인 다이얼로그 ──────────────────────────────────────────────
function DeleteConnectionDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative rounded-2xl p-6 flex flex-col gap-4"
        style={{ width: 288, background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
        <p className="text-sm font-medium text-center" style={{ color: "var(--text-primary)" }}>이 연결을 삭제하시겠습니까?</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-sm transition-colors"
            style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#EF4444", color: "#fff", border: "none", cursor: "pointer" }}>삭제</button>
        </div>
      </div>
    </div>
  );
}

// ── 그룹 제거 확인 다이얼로그 ──────────────────────────────────────────────
function GroupRemoveDialog({ groupName, onConfirm, onCancel }: { groupName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative rounded-2xl p-6 flex flex-col gap-4"
        style={{ width: 320, background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
        <p className="text-sm font-medium text-center" style={{ color: "var(--text-primary)" }}>
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>&#39;{groupName}&#39;</span> 그룹에서도 제거하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-sm transition-colors"
            style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>그룹 유지</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#EF4444", color: "#fff", border: "none", cursor: "pointer" }}>그룹 제거</button>
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

interface ConnRenderItem {
  connection: Connection;
  pathD: string;
  midX: number;
  midY: number;
  screenMidX: number;
  screenMidY: number;
  isSelected: boolean;
  strokeColor: string;
  dashArray: string | undefined;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  fromModule: Module | null;
  toModule: Module | null;
}

const ARROW_DIR: Record<AnchorSide, { dx: number; dy: number }> = {
  top:    { dx: 0,  dy:  1 },
  bottom: { dx: 0,  dy: -1 },
  left:   { dx: 1,  dy:  0 },
  right:  { dx: -1, dy:  0 },
};

const ANCHOR_SIDES: AnchorSide[] = ["top", "right", "bottom", "left"];

interface DraggingEndpoint {
  connectionId: string;
  end: "from" | "to";
  canvasPos: { x: number; y: number };
}

export default function ConnectionLayer({ boardId, viewport }: ConnectionLayerProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const removeConnection = useCanvasStore((s) => s.removeConnection);
  const updateConnection = useCanvasStore((s) => s.updateConnection);
  const updateGroup = useCanvasStore((s) => s.updateGroup);

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [editPanelPos, setEditPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [draggingEndpoint, setDraggingEndpoint] = useState<DraggingEndpoint | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ connectionId: string; fromModuleId: string; toModuleId: string } | null>(null);
  const [pendingGroupRemove, setPendingGroupRemove] = useState<{ groupId: string; groupName: string; moduleId: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { x: vx, y: vy, zoom } = viewport;

  function toCanvas(clientX: number, clientY: number) {
    return { x: (clientX - vx) / zoom, y: (clientY - vy) / zoom };
  }

  function closestAnchor(module: Module, pos: { x: number; y: number }): { side: AnchorSide; dist: number } {
    let best: AnchorSide = "top";
    let bestDist = Infinity;
    for (const side of ANCHOR_SIDES) {
      const ap = getAnchorPosition(module, side);
      const d = Math.hypot(ap.x - pos.x, ap.y - pos.y);
      if (d < bestDist) { bestDist = d; best = side; }
    }
    return { side: best, dist: bestDist };
  }

  // ── 엔드포인트 드래그 (HTML 핸들) ───────────────────────────────────────
  function handleEndpointPointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    connection: Connection,
    end: "from" | "to"
  ) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setEditPanelPos(null); // 편집 패널 닫기
    setDraggingEndpoint({ connectionId: connection.id, end, canvasPos: toCanvas(e.clientX, e.clientY) });
  }

  function handleEndpointPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingEndpoint) return;
    e.stopPropagation();
    setDraggingEndpoint((prev) => prev ? { ...prev, canvasPos: toCanvas(e.clientX, e.clientY) } : null);
  }

  function handleEndpointPointerUp(e: React.PointerEvent<HTMLDivElement>, connection: Connection) {
    if (!draggingEndpoint) return;
    e.stopPropagation();
    const moduleId = draggingEndpoint.end === "from" ? connection.fromModuleId : connection.toModuleId;
    const module = board?.modules.find((m) => m.id === moduleId);
    if (module) {
      const canvasPos = toCanvas(e.clientX, e.clientY);
      const { side, dist } = closestAnchor(module, canvasPos);
      if (dist <= 60 / zoom) {
        updateConnection(boardId, connection.id,
          draggingEndpoint.end === "from" ? { fromAnchor: side } : { toAnchor: side }
        );
      }
    }
    setDraggingEndpoint(null);
  }

  // ── 일반 이벤트 핸들러 ───────────────────────────────────────────────────
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
    setPendingDelete({ connectionId: connection.id, fromModuleId: connection.fromModuleId, toModuleId: connection.toModuleId });
  }

  function handleDeleteConfirm() {
    if (!pendingDelete) return;
    removeConnection(boardId, pendingDelete.connectionId);
    setSelectedConnectionId(null);
    const groups = board?.groups ?? [];
    const { fromModuleId, toModuleId } = pendingDelete;
    const fromGroup = groups.find((g) => g.moduleIds.includes(fromModuleId));
    const toGroup = groups.find((g) => g.moduleIds.includes(toModuleId));
    if (fromGroup) setPendingGroupRemove({ groupId: fromGroup.id, groupName: fromGroup.name, moduleId: fromModuleId });
    else if (toGroup) setPendingGroupRemove({ groupId: toGroup.id, groupName: toGroup.name, moduleId: toModuleId });
    setPendingDelete(null);
  }

  function handleGroupRemoveConfirm() {
    if (!pendingGroupRemove) return;
    const { groupId, moduleId } = pendingGroupRemove;
    const group = (board?.groups ?? []).find((g) => g.id === groupId);
    if (group) updateGroup(boardId, groupId, { moduleIds: group.moduleIds.filter((id) => id !== moduleId) });
    setPendingGroupRemove(null);
  }

  if (!board) return null;

  const FOLDER_W = 90;
  const FOLDER_H = 76;
  const collapsedModuleToGroup = new Map(
    (board.groups ?? []).filter((g) => g.isCollapsed)
      .flatMap((g) => g.moduleIds.map((id) => [id, g] as const))
  );

  const sw = 2 / zoom;
  const swSelected = 2.5 / zoom;
  const hitSw = 18 / zoom;
  const badgeFontSize = 10 / zoom;
  const badgeW = 56 / zoom;
  const badgeH = 22 / zoom;
  const badgeRx = 11 / zoom;

  const renderItems: ConnRenderItem[] = [];
  for (const connection of board.connections) {
    const fromModule = board.modules.find((m) => m.id === connection.fromModuleId);
    const toModule = board.modules.find((m) => m.id === connection.toModuleId);
    if (!fromModule || !toModule) continue;

    const fromCollapsedGroup = collapsedModuleToGroup.get(connection.fromModuleId);
    const toCollapsedGroup = collapsedModuleToGroup.get(connection.toModuleId);
    if (fromCollapsedGroup && toCollapsedGroup && fromCollapsedGroup.id === toCollapsedGroup.id) continue;

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

    const { x: midX, y: midY } = getBezierMidpoint(
      fromPos, connection.fromAnchor as AnchorSide,
      toPos, connection.toAnchor as AnchorSide
    );

    renderItems.push({
      connection, pathD, midX, midY,
      screenMidX: midX * zoom + vx,
      screenMidY: midY * zoom + vy,
      isSelected, strokeColor, dashArray, fromPos, toPos, fromModule, toModule,
    });
  }

  if (renderItems.length === 0 && !pendingDelete && !pendingGroupRemove) return null;

  const draggingItem = draggingEndpoint ? renderItems.find((r) => r.connection.id === draggingEndpoint.connectionId) : null;

  return (
    <>
      {/* ── SVG: 연결선 + 시각 피드백 ──────────────────────────────────── */}
      <svg
        ref={svgRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
        aria-label="커넥션 레이어"
      >
        <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
          {renderItems.map(({ connection, pathD, midX, midY, isSelected, strokeColor, dashArray, fromPos, toPos }) => {
            const opacity = isSelected ? 1 : 0.75;
            const dotR = 3.5 / zoom;
            const arrowLen = 9 / zoom;
            const arrowHw = 4.5 / zoom;
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
                <path d={pathD} fill="none" stroke="transparent" strokeWidth={hitSw}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onClick={(e) => handleConnectionClick(e, connection, midX, midY)} />
                {/* 실제 선 */}
                <path d={pathD} fill="none" stroke={strokeColor}
                  strokeWidth={isSelected ? swSelected : sw}
                  strokeDasharray={dashArray} strokeLinecap="round" strokeLinejoin="round"
                  opacity={opacity} style={{ pointerEvents: "none" }} />
                {/* 시작 점 */}
                <circle cx={fromPos.x} cy={fromPos.y} r={dotR} fill={strokeColor} opacity={opacity} style={{ pointerEvents: "none" }} />
                {/* 끝 화살표 */}
                <polygon points={arrowPoints} fill={strokeColor} opacity={opacity} style={{ pointerEvents: "none" }} />
                {/* 라벨 */}
                {connection.label && (
                  <g style={{ pointerEvents: "none" }}>
                    <rect x={midX - badgeW / 2} y={midY - badgeH / 2} width={badgeW} height={badgeH} rx={badgeRx}
                      fill="var(--surface-elevated)" stroke={strokeColor} strokeWidth={sw * 0.6} opacity={0.95} />
                    <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central"
                      fontSize={badgeFontSize}
                      fill={isSelected ? "var(--primary)" : "var(--text-primary)"}
                      fontWeight={isSelected ? "600" : "400"}>
                      {connection.label.length > 8 ? connection.label.slice(0, 7) + "…" : connection.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ── 드래그 중 시각 피드백 (SVG) ─────────────────────────── */}
          {draggingItem && draggingEndpoint && (() => {
            const { connection, fromPos, toPos, fromModule, toModule } = draggingItem;
            const targetModule = draggingEndpoint.end === "from" ? fromModule : toModule;
            if (!targetModule) return null;
            const fixedPos = draggingEndpoint.end === "from" ? toPos : fromPos;
            const curPos = draggingEndpoint.canvasPos;
            const { side: hoverSide } = closestAnchor(targetModule, curPos);
            const handleStroke = 2 / zoom;

            return (
              <>
                {/* 미리보기 점선 */}
                <line x1={fixedPos.x} y1={fixedPos.y} x2={curPos.x} y2={curPos.y}
                  stroke="var(--primary)" strokeWidth={sw} strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                  strokeLinecap="round" opacity={0.5} style={{ pointerEvents: "none" }} />
                {/* 앵커 타겟 */}
                {ANCHOR_SIDES.map((side) => {
                  const ap = getAnchorPosition(targetModule, side);
                  const isHover = side === hoverSide;
                  return (
                    <g key={side} style={{ pointerEvents: "none" }}>
                      <circle cx={ap.x} cy={ap.y} r={isHover ? 11 / zoom : 7 / zoom}
                        fill={isHover ? "var(--primary)" : "var(--surface-elevated)"}
                        stroke="var(--primary)" strokeWidth={handleStroke}
                        opacity={isHover ? 1 : 0.8} />
                      {isHover && <circle cx={ap.x} cy={ap.y} r={3 / zoom} fill="white" />}
                    </g>
                  );
                })}
                {/* 드래그 커서 원 */}
                <circle cx={curPos.x} cy={curPos.y} r={6 / zoom}
                  fill="var(--primary)" stroke="white" strokeWidth={handleStroke}
                  opacity={0.9} style={{ pointerEvents: "none" }} />
              </>
            );
          })()}
        </g>
      </svg>

      {/* ── HTML 레이어: 편집 버튼 ──────────────────────────────────────── */}
      {renderItems.map(({ connection, screenMidX, screenMidY, midX, midY, isSelected }) => {
        const dotSize = isSelected ? 22 : 17;
        const penSvg = (
          <svg width={isSelected ? 11 : 9} height={isSelected ? 11 : 9} viewBox="0 0 14 14" fill="none"
            style={{ pointerEvents: "none", flexShrink: 0 }}>
            <path d="M9.5 1.5 L12.5 4.5 L4.5 12.5 L1 13 L1.5 9.5 Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 3 L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
        if (isMobile) {
          return (
            <button key={`edit-${connection.id}`} data-no-pan="true"
              onClick={(e) => handleConnectionClick(e, connection, midX, midY)}
              style={{ position: "absolute", left: screenMidX, top: screenMidY, transform: "translate(-50%,-50%)", width: 44, height: 44, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 56, padding: 0 }}>
              <span style={{ width: dotSize, height: dotSize, borderRadius: "50%", background: isSelected ? "var(--primary)" : "var(--surface-elevated)", border: isSelected ? "2px solid var(--surface)" : "1.5px solid var(--border)", color: isSelected ? "#fff" : "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.1)", flexShrink: 0 }}>{penSvg}</span>
            </button>
          );
        }
        return (
          <button key={`edit-${connection.id}`} data-no-pan="true"
            onClick={(e) => handleConnectionClick(e, connection, midX, midY)}
            style={{ position: "absolute", left: screenMidX, top: screenMidY, transform: "translate(-50%,-50%)", width: dotSize, height: dotSize, borderRadius: "50%", background: isSelected ? "var(--primary)" : "var(--surface-elevated)", border: isSelected ? "2px solid var(--surface)" : "1.5px solid var(--border)", color: isSelected ? "#fff" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isSelected ? 1 : 0.6, zIndex: 56, transition: "all 150ms ease", padding: 0, boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.2)" : "none" }}>
            {penSvg}
          </button>
        );
      })}

      {/* ── HTML 레이어: 엔드포인트 드래그 핸들 (z-61 → 오버레이 위) ── */}
      {renderItems.map(({ connection, fromPos, toPos, isSelected }) => {
        if (!isSelected) return null;
        const isDraggingThis = draggingEndpoint?.connectionId === connection.id;
        if (isDraggingThis) return null; // 드래그 중엔 숨김 (커서 원이 대신 표시됨)

        const fsx = fromPos.x * zoom + vx;
        const fsy = fromPos.y * zoom + vy;
        const tsx = toPos.x * zoom + vx;
        const tsy = toPos.y * zoom + vy;

        return (
          <div key={`ep-${connection.id}`} style={{ pointerEvents: "none" }}>
            {/* 시작점 핸들 */}
            <div
              data-no-pan="true"
              style={{
                position: "absolute", left: fsx, top: fsy,
                transform: "translate(-50%,-50%)",
                width: 32, height: 32,
                zIndex: 61,
                cursor: "grab",
                display: "flex", alignItems: "center", justifyContent: "center",
                touchAction: "none",
                pointerEvents: "all",
              }}
              onPointerDown={(e) => handleEndpointPointerDown(e, connection, "from")}
              onPointerMove={handleEndpointPointerMove}
              onPointerUp={(e) => handleEndpointPointerUp(e, connection)}
              onPointerCancel={() => setDraggingEndpoint(null)}
            >
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "white", border: "2.5px solid var(--primary)", boxShadow: "0 1px 5px rgba(0,0,0,0.2)" }} />
            </div>
            {/* 끝점 핸들 */}
            <div
              data-no-pan="true"
              style={{
                position: "absolute", left: tsx, top: tsy,
                transform: "translate(-50%,-50%)",
                width: 32, height: 32,
                zIndex: 61,
                cursor: "grab",
                display: "flex", alignItems: "center", justifyContent: "center",
                touchAction: "none",
                pointerEvents: "all",
              }}
              onPointerDown={(e) => handleEndpointPointerDown(e, connection, "to")}
              onPointerMove={handleEndpointPointerMove}
              onPointerUp={(e) => handleEndpointPointerUp(e, connection)}
              onPointerCancel={() => setDraggingEndpoint(null)}
            >
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "white", border: "2.5px solid var(--primary)", boxShadow: "0 1px 5px rgba(0,0,0,0.2)" }} />
            </div>
          </div>
        );
      })}

      {/* ── 드래그 중 포인터 캡처 오버레이 ─────────────────────────────── */}
      {draggingItem && draggingEndpoint && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 58, cursor: "grabbing", touchAction: "none" }}
          onPointerMove={(e) => {
            setDraggingEndpoint((prev) => prev ? { ...prev, canvasPos: toCanvas(e.clientX, e.clientY) } : null);
          }}
          onPointerUp={(e) => {
            const connection = draggingItem.connection;
            const moduleId = draggingEndpoint.end === "from" ? connection.fromModuleId : connection.toModuleId;
            const module = board.modules.find((m) => m.id === moduleId);
            if (module) {
              const canvasPos = toCanvas(e.clientX, e.clientY);
              const { side, dist } = closestAnchor(module, canvasPos);
              if (dist <= 60 / zoom) {
                updateConnection(boardId, connection.id,
                  draggingEndpoint.end === "from" ? { fromAnchor: side } : { toAnchor: side }
                );
              }
            }
            setDraggingEndpoint(null);
          }}
          onPointerCancel={() => setDraggingEndpoint(null)}
        />
      )}

      {/* ── 연결선 편집 패널 ──────────────────────────────────────────────── */}
      {selectedConnectionId && editPanelPos && (() => {
        const conn = board.connections.find((c) => c.id === selectedConnectionId);
        if (!conn) return null;
        const closePanel = () => { setSelectedConnectionId(null); setEditPanelPos(null); };

        const panelContent = (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>연결선 편집</span>
              <button onClick={closePanel} style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>×</button>
            </div>
            <input type="text" value={conn.label ?? ""} onChange={(e) => updateConnection(boardId, conn.id, { label: e.target.value })}
              placeholder="라벨 입력 (선택)"
              style={{ height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" }} />
            <div>
              <p style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 5, marginTop: 0 }}>선 스타일</p>
              <div style={{ display: "flex", gap: 6 }}>
                {(["solid", "dashed"] as const).map((s) => {
                  const active = (conn.style ?? "solid") === s;
                  return (
                    <button key={s} onClick={() => updateConnection(boardId, conn.id, { style: s })}
                      style={{ flex: 1, height: 30, borderRadius: 8, border: active ? "2px solid var(--primary)" : "1px solid var(--border)", background: active ? "var(--primary-soft)" : "transparent", cursor: "pointer", fontSize: 11, color: active ? "var(--primary)" : "var(--text-secondary)", fontWeight: active ? 600 : 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      <svg width="18" height="6" viewBox="0 0 18 6" style={{ pointerEvents: "none" }}>
                        {s === "solid" ? <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />}
                      </svg>
                      {s === "solid" ? "실선" : "점선"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 5, marginTop: 0 }}>색상</p>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {CONNECTION_COLORS.map((c) => {
                  const active = (conn.color ?? "") === c.value;
                  return (
                    <button key={c.value} title={c.label} onClick={() => updateConnection(boardId, conn.id, { color: c.value })}
                      style={{ width: 22, height: 22, borderRadius: "50%", border: active ? "3px solid var(--text-primary)" : "2px solid var(--border)", background: c.value || "var(--connection-default)", cursor: "pointer", flexShrink: 0, boxShadow: active ? "0 0 0 2px var(--surface-elevated)" : "none", outline: "none", transform: active ? "scale(1.15)" : "scale(1)", transition: "transform 120ms ease" }} />
                  );
                })}
              </div>
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "0 -2px" }} />
            <button onClick={(e) => handleQuickDelete(e, conn)}
              style={{ height: 32, borderRadius: 8, border: "1px solid #EF4444", background: "transparent", color: "#EF4444", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ pointerEvents: "none" }}>
                <path d="M2 3.5h10M5.5 3.5V2.5h3v1M5.5 6v4.5M8.5 6v4.5M3 3.5l.7 8h6.6l.7-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              연결 삭제
            </button>
          </>
        );

        if (isMobile) {
          return (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 159 }} onClick={closePanel} />
              <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 160, background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: "16px 16px 0 0", boxShadow: "0 -4px 24px rgba(0,0,0,0.18)", padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 12 }} onClick={(e) => e.stopPropagation()}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 4px" }} />
                {panelContent}
              </div>
            </>
          );
        }

        const screenX = editPanelPos.x * zoom + vx;
        const screenY = editPanelPos.y * zoom + vy;
        return (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 59 }} onClick={closePanel} />
            <div style={{ position: "absolute", left: screenX, top: screenY + 20, transform: "translateX(-50%)", zIndex: 60, background: "var(--surface-elevated)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-lg)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, minWidth: 216 }} onClick={(e) => e.stopPropagation()}>
              {panelContent}
            </div>
          </>
        );
      })()}

      {pendingDelete && <DeleteConnectionDialog onConfirm={handleDeleteConfirm} onCancel={() => setPendingDelete(null)} />}
      {pendingGroupRemove && <GroupRemoveDialog groupName={pendingGroupRemove.groupName} onConfirm={handleGroupRemoveConfirm} onCancel={() => setPendingGroupRemove(null)} />}
    </>
  );
}
