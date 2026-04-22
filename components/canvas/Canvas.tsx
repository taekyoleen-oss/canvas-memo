"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useCanvasStore } from "@/store/canvas";
import { useConnectionStore } from "@/store/connection";
import { usePinchZoom } from "@/hooks/usePinchZoom";
import { screenToCanvas } from "@/lib/canvas/geometry";
import { computeMemoLikeLayout } from "@/lib/canvas/memoGridLayout";
import type { ModuleType, GroupColor } from "@/types";
import CanvasGrid from "./CanvasGrid";
import ConnectionLayer from "./ConnectionLayer";
import ConnectionPreview from "./ConnectionPreview";
import GroupLayer from "./GroupLayer";
import ZoomControls from "./ZoomControls";
import ModuleCardWrapper from "@/components/modules/ModuleCardWrapper";

interface CanvasProps {
  boardId: string;
  onAddModule: (type: ModuleType, position: { x: number; y: number }) => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.2;

const GROUP_COLOR_CYCLE: GroupColor[] = ["yellow", "teal", "pink", "blue", "purple", "orange"];

// ── 그룹 이름 다이얼로그 ─────────────────────────────────────────────────
interface GroupNameDialogProps {
  moduleCount: number;
  groupCount: number;
  onConfirm: (name: string, color: GroupColor) => void;
  onCancel: () => void;
}

const COLOR_LABELS: Record<GroupColor, string> = {
  yellow: "노랑", pink: "핑크", teal: "청록", blue: "파랑", purple: "보라", orange: "주황",
};

const COLOR_VALUES: Record<GroupColor, string> = {
  yellow: "#fbbf24", pink: "#ec4899", teal: "#14b8a6",
  blue: "#6366f1", purple: "#a855f7", orange: "#f97316",
};

function GroupNameDialog({ moduleCount, groupCount, onConfirm, onCancel }: GroupNameDialogProps) {
  const [name, setName] = useState(`그룹 ${groupCount + 1}`);
  const [color, setColor] = useState<GroupColor>(GROUP_COLOR_CYCLE[groupCount % GROUP_COLOR_CYCLE.length]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          width: 320,
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            그룹 만들기
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
            {moduleCount}개 모듈을 묶습니다
          </p>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name.trim(), color);
            if (e.key === "Escape") onCancel();
          }}
          placeholder="그룹 이름"
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-hover)",
            color: "var(--text-primary)",
            fontSize: 14,
            outline: "none",
          }}
        />

        {/* 색상 선택 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.keys(COLOR_VALUES) as GroupColor[]).map((c) => (
            <button
              key={c}
              title={COLOR_LABELS[c]}
              onClick={() => setColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: COLOR_VALUES[c],
                border: color === c ? "3px solid var(--text-primary)" : "2px solid transparent",
                cursor: "pointer",
                outline: "none",
                transition: "border 0.1s",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              height: 36, padding: "0 16px", borderRadius: 8,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-secondary)", cursor: "pointer", fontSize: 13,
            }}
          >취소</button>
          <button
            disabled={!name.trim()}
            onClick={() => name.trim() && onConfirm(name.trim(), color)}
            style={{
              height: 36, padding: "0 20px", borderRadius: 8,
              border: "none",
              background: name.trim() ? "var(--primary)" : "var(--border)",
              color: name.trim() ? "var(--primary-fg)" : "var(--text-muted)",
              cursor: name.trim() ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 600,
            }}
          >그룹 만들기</button>
        </div>
      </div>
    </div>
  );
}

// ── 그룹 초대 다이얼로그 ─────────────────────────────────────────────────
interface GroupInviteDialogProps {
  groupName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function GroupInviteDialog({ groupName, onConfirm, onCancel }: GroupInviteDialogProps) {
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
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>&#39;{groupName}&#39;</span> 그룹에 추가하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm transition-colors"
            style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            연결만
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "var(--primary)", color: "var(--primary-fg)", border: "none", cursor: "pointer" }}
          >
            그룹에 추가
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 Canvas 컴포넌트 ────────────────────────────────────────────────
export default function Canvas({ boardId, onAddModule }: CanvasProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const updateViewport = useCanvasStore((s) => s.updateViewport);
  const updateModule = useCanvasStore((s) => s.updateModule);
  const removeModule = useCanvasStore((s) => s.removeModule);
  const addGroup = useCanvasStore((s) => s.addGroup);
  const updateGroup = useCanvasStore((s) => s.updateGroup);
  const focusGroupId = useCanvasStore((s) => s.focusGroupId);
  const setFocusGroup = useCanvasStore((s) => s.setFocusGroup);
  const focusModuleId = useCanvasStore((s) => s.focusModuleId);
  const setFocusModule = useCanvasStore((s) => s.setFocusModule);
  const undo = useCanvasStore((s) => s.undo);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const pendingGroupInvite = useCanvasStore((s) => s.pendingGroupInvite);
  const clearGroupInvite = useCanvasStore((s) => s.clearGroupInvite);
  const cancelConnecting = useConnectionStore((s) => s.cancelConnecting);
  const updatePreviewPos = useConnectionStore((s) => s.updatePreviewPos);
  const connectionMode = useConnectionStore((s) => s.mode);

  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // 뷰포트
  const [viewport, setViewport] = useState(() =>
    board?.viewport ?? { x: 0, y: 0, zoom: 1 }
  );

  useEffect(() => {
    if (board?.viewport) setViewport(board.viewport);
  }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewportChange = useCallback(
    (vp: typeof viewport) => {
      setViewport(vp);
      updateViewport(boardId, vp);
    },
    [boardId, updateViewport]
  );

  usePinchZoom(containerRef, {
    onViewportChange: handleViewportChange,
    initialViewport: viewport,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
  });

  // ── 라소(그룹 선택) 모드 ─────────────────────────────────────────
  const [lassoMode, setLassoMode] = useState(false);
  const [lasso, setLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const lassoStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  // ── 다중 선택 ────────────────────────────────────────────────
  const [selectedMultiIds, setSelectedMultiIds] = useState<string[]>([]);
  // 렌더링용 state + stale closure 방지용 ref 병행 사용
  const [selectionLasso, setSelectionLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const selectionLassoRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const multiDragOriginsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // 그룹 이름 다이얼로그
  const [pendingModuleIds, setPendingModuleIds] = useState<string[]>([]);
  const [pendingBounds, setPendingBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);

  function handleEnterGroupMode() {
    setLassoMode(true);
    cancelConnecting();
    setSelectedModuleId(null);
  }

  function handleLassoPointerDown(e: React.PointerEvent) {
    if (!lassoMode) return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
    lassoStartRef.current = { x: p.x, y: p.y, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setLasso({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }

  function handleLassoPointerMove(e: React.PointerEvent) {
    if (!lassoMode || !lassoStartRef.current) return;
    if (lassoStartRef.current.pointerId !== e.pointerId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
    setLasso({ x1: lassoStartRef.current.x, y1: lassoStartRef.current.y, x2: p.x, y2: p.y });
  }

  function handleLassoPointerUp(e: React.PointerEvent) {
    if (!lassoMode || !lassoStartRef.current) return;
    lassoStartRef.current = null;

    if (!lasso) {
      setLassoMode(false);
      return;
    }

    const lx = Math.min(lasso.x1, lasso.x2);
    const ly = Math.min(lasso.y1, lasso.y2);
    const lw = Math.abs(lasso.x2 - lasso.x1);
    const lh = Math.abs(lasso.y2 - lasso.y1);

    // 너무 작으면 취소
    if (lw < 20 || lh < 20) {
      setLasso(null);
      setLassoMode(false);
      return;
    }

    // 라소 안에 있는 모듈 찾기 (접힌 그룹의 모듈 제외)
    const collapsedIds = new Set(
      (board?.groups ?? []).filter((g) => g.isCollapsed).flatMap((g) => g.moduleIds)
    );
    const hit = (board?.modules ?? []).filter((m) => {
      if (collapsedIds.has(m.id)) return false;
      const mx = m.position.x, my = m.position.y, mw = m.size.width, mh = m.size.height;
      return mx < lx + lw && mx + mw > lx && my < ly + lh && my + mh > ly;
    });

    setLasso(null);
    setLassoMode(false);

    if (hit.length === 0) return;

    setPendingModuleIds(hit.map((m) => m.id));
    setPendingBounds({ x: lx, y: ly, w: lw, h: lh });
    setShowGroupDialog(true);
  }

  function handleGroupConfirm(name: string, color: GroupColor) {
    if (!pendingBounds || pendingModuleIds.length === 0) return;
    addGroup(boardId, {
      name,
      moduleIds: pendingModuleIds,
      position: { x: pendingBounds.x, y: pendingBounds.y },
      size: { width: pendingBounds.w, height: pendingBounds.h },
      color,
      isCollapsed: false,
    });
    setPendingModuleIds([]);
    setPendingBounds(null);
    setShowGroupDialog(false);
  }

  // ── 그룹 초대 dialog 핸들러 ──────────────────────────────────────
  function handleGroupInviteConfirm() {
    if (!pendingGroupInvite) return;
    const { groupId, candidateModuleId, boardId: inviteBoardId } = pendingGroupInvite;
    const targetBoard = useCanvasStore.getState().boards.find((b) => b.id === inviteBoardId);
    const group = targetBoard?.groups?.find((g) => g.id === groupId);
    if (group && !group.moduleIds.includes(candidateModuleId)) {
      updateGroup(inviteBoardId, groupId, {
        moduleIds: [...group.moduleIds, candidateModuleId],
      });
    }
    clearGroupInvite();
  }

  function handleGroupInviteCancel() {
    clearGroupInvite();
  }

  // ── 사이드바에서 그룹 포커스 요청 처리 ──────────────────────────
  useEffect(() => {
    if (!focusGroupId || !board) return;
    const g = board.groups?.find((gr) => gr.id === focusGroupId);
    if (!g) return;

    const container = containerRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const PADDING = 80;

    // 접혀있으면 펼치기
    if (g.isCollapsed) {
      useCanvasStore.getState().updateGroup(boardId, g.id, { isCollapsed: false });
    }

    const contentW = g.size.width;
    const contentH = g.size.height;
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min((W - PADDING * 2) / contentW, (H - PADDING * 2) / contentH))
    );
    const vp = {
      x: (W - contentW * zoom) / 2 - g.position.x * zoom,
      y: (H - contentH * zoom) / 2 - g.position.y * zoom,
      zoom,
    };
    setViewport(vp);
    updateViewport(boardId, vp);
    setFocusGroup(null);
  }, [focusGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 검색에서 모듈 포커스 요청 처리 ────────────────────────────────
  useEffect(() => {
    if (!focusModuleId || !board) return;
    const m = board.modules.find((mod) => mod.id === focusModuleId);
    if (!m) return;
    const container = containerRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, 1));
    const vp = {
      x: W / 2 - (m.position.x + m.size.width / 2) * zoom,
      y: H / 2 - (m.position.y + m.size.height / 2) * zoom,
      zoom,
    };
    setViewport(vp);
    updateViewport(boardId, vp);
    setFocusModule(null);
  }, [focusModuleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 키보드 단축키 ────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isTyping =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable);

      if (e.key === "Escape") {
        cancelConnecting();
        setSelectedModuleId(null);
        setLassoMode(false);
        setLasso(null);
        setSelectedMultiIds([]);
        selectionLassoRef.current = null;
        setSelectionLasso(null);
        return;
      }

      // Ctrl+Z: 실행취소
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !isTyping) {
        e.preventDefault();
        undo();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !isTyping) {
        if (selectedMultiIds.length > 0) {
          if (window.confirm(`선택한 ${selectedMultiIds.length}개 모듈을 삭제하시겠습니까?`)) {
            selectedMultiIds.forEach((id) => removeModule(boardId, id));
            setSelectedMultiIds([]);
          }
        } else if (selectedModuleId) {
          if (window.confirm("선택한 모듈을 삭제하시겠습니까?")) {
            removeModule(boardId, selectedModuleId);
            setSelectedModuleId(null);
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedModuleId, selectedMultiIds, boardId, cancelConnecting, removeModule, undo]);

  // ── 커넥션 프리뷰 포인터 이동 ───────────────────────────────────
  function handlePointerMove(e: React.PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (connectionMode === "connecting") {
      updatePreviewPos(screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport));
    }
    if (selectionStartRef.current && selectionStartRef.current.pointerId === e.pointerId) {
      const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
      const updated = { x1: selectionStartRef.current.x, y1: selectionStartRef.current.y, x2: p.x, y2: p.y };
      selectionLassoRef.current = updated;
      setSelectionLasso(updated);
    }
  }

  // ── 다중 선택 오버레이 핸들러 (data-canvas-bg 내부 z-index:0 레이어) ───
  function handleSelectionPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
    selectionStartRef.current = { x: p.x, y: p.y, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const initial = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    selectionLassoRef.current = initial;
    setSelectionLasso(initial);
  }

  function handleSelectionPointerMove(e: React.PointerEvent) {
    if (!selectionStartRef.current || selectionStartRef.current.pointerId !== e.pointerId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
    const updated = { x1: selectionStartRef.current.x, y1: selectionStartRef.current.y, x2: p.x, y2: p.y };
    selectionLassoRef.current = updated;
    setSelectionLasso(updated);
  }

  function handleSelectionPointerUp(e: React.PointerEvent) {
    if (!selectionStartRef.current || selectionStartRef.current.pointerId !== e.pointerId) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    const lasso = selectionLassoRef.current;
    selectionStartRef.current = null;
    selectionLassoRef.current = null;
    setSelectionLasso(null);

    if (!lasso) return;
    const lx = Math.min(lasso.x1, lasso.x2);
    const ly = Math.min(lasso.y1, lasso.y2);
    const lw = Math.abs(lasso.x2 - lasso.x1);
    const lh = Math.abs(lasso.y2 - lasso.y1);

    if (lw < 10 || lh < 10) {
      setSelectedMultiIds([]);
      return;
    }

    const collapsedIds = new Set(
      (board?.groups ?? []).filter((g) => g.isCollapsed).flatMap((g) => g.moduleIds)
    );
    const hit = (board?.modules ?? []).filter((m) => {
      if (collapsedIds.has(m.id)) return false;
      const mx = m.position.x, my = m.position.y, mw = m.size.width, mh = m.size.height;
      return mx < lx + lw && mx + mw > lx && my < ly + lh && my + mh > ly;
    });
    setSelectedMultiIds(hit.map((m) => m.id));
  }

  // Shift+클릭 개별 모듈 추가/제거
  function handleShiftSelect(id: string) {
    setSelectedMultiIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSelectedModuleId(null);
  }

  function handleMultiDragStart() {
    if (!board) return;
    const origins = new Map<string, { x: number; y: number }>();
    selectedMultiIds.forEach((id) => {
      const m = board.modules.find((mod) => mod.id === id);
      if (m) origins.set(id, { x: m.position.x, y: m.position.y });
    });
    multiDragOriginsRef.current = origins;
  }

  function handleMultiDragMove(dx: number, dy: number) {
    multiDragOriginsRef.current.forEach((origin, id) => {
      updateModule(boardId, id, { position: { x: origin.x + dx, y: origin.y + dy } });
    });
  }

  // ── 캔버스 빈 공간 클릭 ─────────────────────────────────────────
  function handleCanvasClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (el === containerRef.current || el.dataset.canvasBg) {
      cancelConnecting();
      setSelectedModuleId(null);
      setSelectedMultiIds([]);
    }
  }

  // ── 빈 캔버스 더블클릭 → 빠른 메모 생성 ────────────────────────
  function handleCanvasDoubleClick(e: React.MouseEvent) {
    if (lassoMode) return;
    const el = e.target as HTMLElement;
    if (el === containerRef.current || el.dataset.canvasBg) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = screenToCanvas(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewport
      );
      onAddModule("memo", { x: pos.x - 130, y: pos.y - 22 });
    }
  }

  // ── 줌 ──────────────────────────────────────────────────────────
  function zoomAt(factor: number, focalX?: number, focalY?: number) {
    setViewport((prev) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const cx = focalX ?? (containerRef.current?.clientWidth ?? 0) / 2;
      const cy = focalY ?? (containerRef.current?.clientHeight ?? 0) / 2;
      const newX = cx - (cx - prev.x) * (newZoom / prev.zoom);
      const newY = cy - (cy - prev.y) * (newZoom / prev.zoom);
      const vp = { x: newX, y: newY, zoom: newZoom };
      updateViewport(boardId, vp);
      return vp;
    });
  }

  function handleZoomIn() { zoomAt(ZOOM_STEP); }
  function handleZoomOut() { zoomAt(1 / ZOOM_STEP); }

  function handleFit() {
    const modules = board?.modules ?? [];
    if (modules.length === 0) {
      const vp = { x: 0, y: 0, zoom: 1 };
      setViewport(vp);
      updateViewport(boardId, vp);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    const PADDING = 80;

    const minX = Math.min(...modules.map((m) => m.position.x));
    const minY = Math.min(...modules.map((m) => m.position.y));
    const maxX = Math.max(...modules.map((m) => m.position.x + m.size.width));
    const maxY = Math.max(...modules.map((m) => m.position.y + (m.isExpanded ? m.size.height : 68)));

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW === 0 || contentH === 0) return;

    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min((W - PADDING * 2) / contentW, (H - PADDING * 2) / contentH)
      )
    );

    const x = (W - contentW * zoom) / 2 - minX * zoom;
    const y = (H - contentH * zoom) / 2 - minY * zoom;

    const vp = { x, y, zoom };
    setViewport(vp);
    updateViewport(boardId, vp);
  }

  // ── 자동 정렬 (⊞): 메모형 배치만 적용 (평소에는 드래그로 자유 이동) ───────
  function handleAutoLayout() {
    if (!board) return;

    const allModules = board.modules;
    if (allModules.length === 0) return;

    const collapsedGroupModuleIds = new Set(
      (board.groups ?? [])
        .filter((g) => g.isCollapsed)
        .flatMap((g) => g.moduleIds)
    );
    const visible = allModules.filter((m) => !collapsedGroupModuleIds.has(m.id));
    if (visible.length === 0) return;

    const groupedIds = new Set((board.groups ?? []).flatMap((g) => g.moduleIds));
    const container = containerRef.current;
    const cw = container?.clientWidth ?? 960;

    const next = computeMemoLikeLayout({
      modules: board.modules,
      connections: board.connections ?? [],
      collapsedModuleIds: collapsedGroupModuleIds,
      groupedModuleIds: groupedIds,
      containerWidthPx: cw,
      zoom: viewport.zoom,
    });

    if (next.size === 0) return;

    pushHistory();

    next.forEach((pos, id) => {
      updateModule(boardId, id, { position: pos });
    });

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    allModules.forEach((m) => {
      if (collapsedGroupModuleIds.has(m.id)) return;
      const pos = next.get(m.id) ?? m.position;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + m.size.width);
      maxY = Math.max(maxY, pos.y + m.size.height);
    });
    if (!Number.isFinite(minX)) return;

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) return;

    const W = container?.clientWidth ?? 0;
    const H = container?.clientHeight ?? 0;
    if (W <= 0 || H <= 0) return;

    const PADDING = 80;
    const fitZoom = Math.min((W - PADDING * 2) / contentW, (H - PADDING * 2) / contentH) * 0.88;
    const newZoom = Math.max(0.25, Math.min(fitZoom, 1.0));
    const vpX = (W - contentW * newZoom) / 2 - minX * newZoom;
    const vpY = (H - contentH * newZoom) / 2 - minY * newZoom;
    const vp = { x: vpX, y: vpY, zoom: newZoom };
    setViewport(vp);
    updateViewport(boardId, vp);
  }

  if (!board) return null;

  // 접힌 그룹에 속한 모듈 ID 목록 (렌더링 제외)
  const collapsedModuleIds = new Set(
    (board.groups ?? [])
      .filter((g) => g.isCollapsed)
      .flatMap((g) => g.moduleIds)
  );

  return (
    <div
      ref={containerRef}
      data-canvas-container="true"
      className="relative overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        background: "var(--background)",
        touchAction: "none",
        cursor: lassoMode ? "crosshair" : undefined,
      }}
      onPointerMove={handlePointerMove}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
    >
      {/* 도트 그리드 */}
      <CanvasGrid viewport={viewport} />

      {/* 연결선 SVG — 컨테이너 전체 커버 */}
      <ConnectionLayer boardId={boardId} viewport={viewport} />
      <ConnectionPreview boardId={boardId} viewport={viewport} />

      {/* 라소 선택 영역 표시 */}
      {lassoMode && lasso && (
        <svg
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            overflow: "visible", pointerEvents: "none", zIndex: 30,
          }}
        >
          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
            <rect
              x={Math.min(lasso.x1, lasso.x2)}
              y={Math.min(lasso.y1, lasso.y2)}
              width={Math.abs(lasso.x2 - lasso.x1)}
              height={Math.abs(lasso.y2 - lasso.y1)}
              fill="var(--primary)"
              fillOpacity={0.08}
              stroke="var(--primary)"
              strokeWidth={2 / viewport.zoom}
              strokeDasharray={`${8 / viewport.zoom} ${4 / viewport.zoom}`}
              rx={4 / viewport.zoom}
            />
          </g>
        </svg>
      )}

      {/* 다중 선택 라소 */}
      {selectionLasso && (
        <svg
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            overflow: "visible", pointerEvents: "none", zIndex: 30,
          }}
        >
          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
            <rect
              x={Math.min(selectionLasso.x1, selectionLasso.x2)}
              y={Math.min(selectionLasso.y1, selectionLasso.y2)}
              width={Math.abs(selectionLasso.x2 - selectionLasso.x1)}
              height={Math.abs(selectionLasso.y2 - selectionLasso.y1)}
              fill="rgba(59,130,246,0.08)"
              stroke="rgb(59,130,246)"
              strokeWidth={2 / viewport.zoom}
              strokeDasharray={`${6 / viewport.zoom} ${3 / viewport.zoom}`}
              rx={4 / viewport.zoom}
            />
          </g>
        </svg>
      )}

      {/* 라소 모드 인터랙션 오버레이 (모듈 클릭 차단) */}
      {lassoMode && (
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            // ZoomControls(zIndex:80)보다 낮게 → 툴바는 항상 위에 표시/클릭 가능
            // 하단 120px은 ZoomControls 영역으로 비워둠
            bottom: 120,
            zIndex: 60,
            cursor: "crosshair",
            touchAction: "none",
          }}
          onPointerDown={handleLassoPointerDown}
          onPointerMove={handleLassoPointerMove}
          onPointerUp={handleLassoPointerUp}
          onPointerCancel={() => { setLasso(null); setLassoMode(false); lassoStartRef.current = null; }}
        />
      )}

      {/* 캔버스 변환 레이어 */}
      <div
        data-canvas-bg="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transformOrigin: "0 0",
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          willChange: "transform",
        }}
      >
        {/* 다중 선택 히트 레이어 — 모듈(z-index≥1)보다 아래, 빈 캔버스 드래그 감지 */}
        {!lassoMode && connectionMode !== "connecting" && (
          <div
            style={{
              position: "absolute",
              top: -50000,
              left: -50000,
              width: 100000,
              height: 100000,
              zIndex: 0,
              touchAction: "none",
            }}
            onPointerDown={handleSelectionPointerDown}
            onPointerMove={handleSelectionPointerMove}
            onPointerUp={handleSelectionPointerUp}
            onPointerCancel={() => {
              selectionLassoRef.current = null;
              selectionStartRef.current = null;
              setSelectionLasso(null);
            }}
          />
        )}

        {/* 그룹 배경 레이어 (모듈 아래) */}
        <GroupLayer boardId={boardId} viewport={viewport} />

        {/* 모듈 — 접힌 그룹에 속한 것은 숨김 */}
        {board.modules
          .filter((m) => !collapsedModuleIds.has(m.id))
          .map((module) => (
            <ModuleCardWrapper
              key={module.id}
              module={module}
              boardId={boardId}
              viewport={viewport}
              isSelected={selectedModuleId === module.id}
              onSelect={(id) => { setSelectedModuleId(id); setSelectedMultiIds([]); }}
              onDeselect={() => setSelectedModuleId(null)}
              isMultiSelected={selectedMultiIds.includes(module.id)}
              onMultiDragStart={selectedMultiIds.includes(module.id) ? handleMultiDragStart : undefined}
              onMultiDragMove={selectedMultiIds.includes(module.id) ? handleMultiDragMove : undefined}
              onShiftSelect={handleShiftSelect}
            />
          ))}
      </div>

      {/* 줌 & 툴바 컨트롤 */}
      <ZoomControls
        viewport={viewport}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onAutoLayout={handleAutoLayout}
        isConnecting={connectionMode === "connecting"}
        isGroupMode={lassoMode}
        onGroupMode={handleEnterGroupMode}
      />

      {/* 라소 모드 힌트 배너 */}
      {lassoMode && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--primary)",
            color: "var(--primary-fg)",
            borderRadius: 8,
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "var(--shadow-md)",
            whiteSpace: "nowrap",
            zIndex: 25,
            pointerEvents: "none",
          }}
        >
          📦 그룹 선택 — 묶을 모듈을 드래그로 선택하세요 &nbsp;·&nbsp; ESC 취소
        </div>
      )}

      {/* 더블클릭 힌트 (모듈 없을 때) */}
      {board.modules.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            빈 공간을 더블클릭하면 메모를 바로 추가할 수 있어요
          </p>
        </div>
      )}

      {/* 그룹 이름 다이얼로그 */}
      {showGroupDialog && (
        <GroupNameDialog
          moduleCount={pendingModuleIds.length}
          groupCount={(board.groups ?? []).length}
          onConfirm={handleGroupConfirm}
          onCancel={() => { setShowGroupDialog(false); setPendingModuleIds([]); setPendingBounds(null); }}
        />
      )}

      {/* 그룹 초대 다이얼로그 */}
      {pendingGroupInvite && (
        <GroupInviteDialog
          groupName={pendingGroupInvite.groupName}
          onConfirm={handleGroupInviteConfirm}
          onCancel={handleGroupInviteCancel}
        />
      )}
    </div>
  );
}
