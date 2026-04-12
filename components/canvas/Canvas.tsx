"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useCanvasStore } from "@/store/canvas";
import { useConnectionStore } from "@/store/connection";
import { usePinchZoom } from "@/hooks/usePinchZoom";
import { screenToCanvas } from "@/lib/canvas/geometry";
import type { ModuleType } from "@/types";
import CanvasGrid from "./CanvasGrid";
import ConnectionLayer from "./ConnectionLayer";
import ConnectionPreview from "./ConnectionPreview";
import ZoomControls from "./ZoomControls";
import ModuleCardWrapper from "@/components/modules/ModuleCardWrapper";

interface CanvasProps {
  boardId: string;
  onAddModule: (type: ModuleType, position: { x: number; y: number }) => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.2;

export default function Canvas({ boardId, onAddModule }: CanvasProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const updateViewport = useCanvasStore((s) => s.updateViewport);
  const updateModule = useCanvasStore((s) => s.updateModule);
  const removeModule = useCanvasStore((s) => s.removeModule);
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
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedModuleId && !isTyping) {
        if (window.confirm("선택한 모듈을 삭제하시겠습니까?")) {
          removeModule(boardId, selectedModuleId);
          setSelectedModuleId(null);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedModuleId, boardId, cancelConnecting, removeModule]);

  // ── 커넥션 프리뷰 포인터 이동 ───────────────────────────────────
  function handlePointerMove(e: React.PointerEvent) {
    if (connectionMode !== "connecting") return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    updatePreviewPos(
      screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport)
    );
  }

  // ── 캔버스 빈 공간 클릭 ─────────────────────────────────────────
  function handleCanvasClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (el === containerRef.current || el.dataset.canvasBg) {
      cancelConnecting();
      setSelectedModuleId(null);
    }
  }

  // ── 빈 캔버스 더블클릭 → 빠른 메모 생성 ────────────────────────
  function handleCanvasDoubleClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (el === containerRef.current || el.dataset.canvasBg) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = screenToCanvas(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewport
      );
      // Offset so the module center lands at the click point
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

  // ── Auto Layout ─────────────────────────────────────────────────
  function handleAutoLayout() {
    const modules = board?.modules ?? [];
    if (modules.length === 0) return;

    const COLS = Math.max(1, Math.ceil(Math.sqrt(modules.length)));
    const MODULE_W = 260;
    const COLLAPSED_H = 68;  // approximate collapsed card height
    const GAP_X = 48;
    const GAP_Y = 56;
    const START_X = 60;
    const START_Y = 60;

    // Sort by creation date for stable ordering
    const sorted = [...modules].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sorted.forEach((module, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      updateModule(boardId, module.id, {
        position: {
          x: START_X + col * (MODULE_W + GAP_X),
          y: START_Y + row * (COLLAPSED_H + GAP_Y),
        },
      });
    });

    // Fit after layout settles
    setTimeout(handleFit, 120);
  }

  if (!board) return null;

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
      }}
      onPointerMove={handlePointerMove}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
    >
      {/* 도트 그리드 */}
      <CanvasGrid viewport={viewport} />

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
        <ConnectionLayer boardId={boardId} />
        <ConnectionPreview boardId={boardId} />

        {board.modules.map((module) => (
          <ModuleCardWrapper
            key={module.id}
            module={module}
            boardId={boardId}
            viewport={viewport}
            isSelected={selectedModuleId === module.id}
            onSelect={setSelectedModuleId}
            onDeselect={() => setSelectedModuleId(null)}
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
      />

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
    </div>
  );
}
