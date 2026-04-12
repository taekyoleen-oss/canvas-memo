"use client";

import { useRef, useState, useCallback } from "react";
import type { Module, MemoData, ScheduleData, ImageData, LinkData } from "@/types";
import type { AnchorSide } from "@/lib/canvas/geometry";
import { useCanvasStore } from "@/store/canvas";
import { useConnectionStore } from "@/store/connection";
import { useLongPress } from "@/hooks/useLongPress";
import ModuleCard from "./ModuleCard";
import MemoModule from "./MemoModule";
import ScheduleModule from "./ScheduleModule";
import ImageModule from "./ImageModule";
import LinkModule from "./LinkModule";
import ModuleContextMenu from "@/components/ui-overlays/ModuleContextMenu";
import ColorPalette from "@/components/ui-overlays/ColorPalette";
import DeleteConfirmDialog from "@/components/ui-overlays/DeleteConfirmDialog";
import AnchorPoint from "@/components/canvas/AnchorPoint";

interface ModuleCardWrapperProps {
  module: Module;
  boardId: string;
  viewport: { x: number; y: number; zoom: number };
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}

/** 두 모듈의 중심 위치를 기반으로 최적 toAnchor 계산 */
function getBestToAnchor(fromModule: Module, toModule: Module): AnchorSide {
  const fromCx = fromModule.position.x + fromModule.size.width / 2;
  const fromCy = fromModule.position.y + fromModule.size.height / 2;
  const toCx = toModule.position.x + toModule.size.width / 2;
  const toCy = toModule.position.y + toModule.size.height / 2;
  const dx = fromCx - toCx;
  const dy = fromCy - toCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

export default function ModuleCardWrapper({
  module,
  boardId,
  viewport,
  isSelected,
  onSelect,
  onDeselect,
}: ModuleCardWrapperProps) {
  const updateModule = useCanvasStore((s) => s.updateModule);
  const removeModule = useCanvasStore((s) => s.removeModule);
  const duplicateModule = useCanvasStore((s) => s.duplicateModule);
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));

  const connectionMode     = useConnectionStore((s) => s.mode);
  const fromModuleId       = useConnectionStore((s) => s.fromModuleId);
  const dragSourceModuleId = useConnectionStore((s) => s.dragSourceModuleId);
  const startConnecting    = useConnectionStore((s) => s.startConnecting);
  const finishConnecting   = useConnectionStore((s) => s.finishConnecting);

  const [isDragging, setIsDragging] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showAnchors, setShowAnchors] = useState(false);

  const dragStartRef = useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    moduleX: number;
    moduleY: number;
  } | null>(null);
  const lastClickTimeRef = useRef(0);

  const longPress = useLongPress(() => {
    setIsContextMenuOpen(true);
  });

  // ── 드래그 시작 ────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest("button") ||
        target.closest("[role=button]")
      ) {
        return;
      }
      // 연결 모드 중에는 드래그 이동 막기
      if (useConnectionStore.getState().mode === "connecting") return;

      e.stopPropagation();
      if (e.button === 2) return;

      dragStartRef.current = {
        pointerId: e.pointerId,
        pointerX: e.clientX,
        pointerY: e.clientY,
        moduleX: module.position.x,
        moduleY: module.position.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [module.position]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      if (dragStartRef.current.pointerId !== e.pointerId) return;

      const dx = e.clientX - dragStartRef.current.pointerX;
      const dy = e.clientY - dragStartRef.current.pointerY;

      if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
        setIsDragging(true);
      }

      if (isDragging) {
        const canvasDx = dx / viewport.zoom;
        const canvasDy = dy / viewport.zoom;
        updateModule(boardId, module.id, {
          position: {
            x: dragStartRef.current.moduleX + canvasDx,
            y: dragStartRef.current.moduleY + canvasDy,
          },
        });
      }
    },
    [isDragging, viewport.zoom, boardId, module.id, updateModule]
  );

  // ── 포인터 업: 드래그 종료 OR 연결 드롭 ─────────────────────
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // 연결 모드: 이 모듈 위에서 포인터를 놓으면 연결 완성
      const { mode, fromModuleId: fromId } = useConnectionStore.getState();
      if (mode === "connecting" && fromId && fromId !== module.id) {
        e.preventDefault(); // 버튼 등 하위 클릭 방지
        const fromMod = board?.modules.find((m) => m.id === fromId);
        const toAnchor = fromMod ? getBestToAnchor(fromMod, module) : "left";
        finishConnecting(module.id, toAnchor);
        return;
      }

      // 일반 드래그 종료
      if (!dragStartRef.current) return;
      if (dragStartRef.current.pointerId !== e.pointerId) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      dragStartRef.current = null;
      setIsDragging(false);
    },
    [module, board, finishConnecting]
  );

  function handleDataChange(data: Module["data"]) {
    updateModule(boardId, module.id, { data });
  }

  function handleToggleExpand() {
    updateModule(boardId, module.id, { isExpanded: !module.isExpanded });
  }

  function handleDelete() {
    removeModule(boardId, module.id);
    setIsDeleteDialogOpen(false);
    setIsContextMenuOpen(false);
    onDeselect();
  }

  function handleDuplicate() {
    duplicateModule(boardId, module.id);
    setIsContextMenuOpen(false);
  }

  function handleStartConnect() {
    startConnecting(module.id, "right");
  }

  // ── 클릭: 선택 / 더블클릭: 확장 토글 ────────────────────────
  function handleClick(e: React.MouseEvent) {
    if (isDragging) return;
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea")
    )
      return;

    // 연결 모드 클릭 완성은 pointerUp에서 처리하므로 여기서는 스킵
    if (useConnectionStore.getState().mode === "connecting") return;

    // 더블클릭 감지
    const now = Date.now();
    const isDouble = now - lastClickTimeRef.current < 350;
    lastClickTimeRef.current = now;

    if (isDouble) {
      handleToggleExpand();
    } else {
      if (isSelected) {
        onDeselect();
      } else {
        onSelect(module.id);
      }
    }
  }

  function renderModuleContent() {
    switch (module.type) {
      case "memo":
        return (
          <MemoModule
            data={module.data as MemoData}
            isExpanded={module.isExpanded}
            onChange={(d) => handleDataChange(d)}
          />
        );
      case "schedule":
        return (
          <ScheduleModule
            data={module.data as ScheduleData}
            isExpanded={module.isExpanded}
            onChange={(d) => handleDataChange(d)}
          />
        );
      case "image":
        return (
          <ImageModule
            data={module.data as ImageData}
            isExpanded={module.isExpanded}
            onChange={(d) => handleDataChange(d)}
          />
        );
      case "link":
        return (
          <LinkModule
            data={module.data as LinkData}
            isExpanded={module.isExpanded}
            onChange={(d) => handleDataChange(d)}
          />
        );
      default:
        return null;
    }
  }

  const isConnectingMode   = connectionMode === "connecting";
  const isConnectingSource = isConnectingMode && fromModuleId === module.id;
  const isConnectTarget    = isConnectingMode && fromModuleId !== module.id;
  // 드래그 중에도 소스 모듈의 앵커 유지 (dragSourceModuleId로 판단)
  const isDragSource       = dragSourceModuleId === module.id;

  return (
    <>
      <div
        // 모듈 식별 — 드롭 대상 감지에 사용
        data-module-wrapper-id={module.id}
        style={{
          position: "absolute",
          left: module.position.x,
          top: module.position.y,
          width: module.size.width,
          zIndex: isDragging ? 1000 : module.zIndex,
          transform: isDragging ? "scale(1.03)" : "scale(1)",
          transition: isDragging ? "none" : "transform 0.15s ease",
          cursor: isConnectTarget
            ? "crosshair"
            : isDragging
            ? "grabbing"
            : "grab",
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => setShowAnchors(true)}
        onMouseLeave={() => !isDragging && setShowAnchors(false)}
        onClick={handleClick}
        {...longPress}
      >
        {/* 연결 드롭 대상 하이라이트 */}
        {isConnectTarget && (
          <div
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: 16,
              border: "2px dashed var(--primary)",
              pointerEvents: "none",
              zIndex: 30,
              opacity: 0.7,
              animation: "connectTarget 0.7s ease-in-out infinite alternate",
            }}
          />
        )}

        {/* output 앵커: hover·connecting 모드·드래그 중에 표시 */}
        {(showAnchors || isConnectingMode || isDragSource) &&
          (["top", "right", "bottom", "left"] as const).map((side) => (
            <AnchorPoint
              key={`out-${side}`}
              type="output"
              moduleId={module.id}
              anchor={side}
              viewport={viewport}
            />
          ))}

        {isConnectingMode &&
          (["top", "right", "bottom", "left"] as const).map((side) => (
            <AnchorPoint
              key={`in-${side}`}
              type="input"
              moduleId={module.id}
              anchor={side}
              viewport={viewport}
            />
          ))}

        <ModuleCard
          module={module}
          isSelected={isSelected}
          isConnectingSource={isConnectingSource}
          onContextMenu={(rect) => {
            setMenuAnchorRect(rect);
            setIsContextMenuOpen(true);
          }}
          onToggleExpand={handleToggleExpand}
          onStartConnect={handleStartConnect}
        >
          {renderModuleContent()}
        </ModuleCard>
      </div>

      <ModuleContextMenu
        isOpen={isContextMenuOpen}
        anchorRect={menuAnchorRect}
        onClose={() => setIsContextMenuOpen(false)}
        onColorChange={() => {
          setIsContextMenuOpen(false);
          setIsColorPaletteOpen(true);
        }}
        onDuplicate={handleDuplicate}
        onDelete={() => {
          setIsContextMenuOpen(false);
          setIsDeleteDialogOpen(true);
        }}
      />

      {isColorPaletteOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ zIndex: 100, background: "rgba(0,0,0,0.4)" }}
          onClick={() => setIsColorPaletteOpen(false)}
        >
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium mb-3 px-1" style={{ color: "var(--text-primary)" }}>
              색상 선택
            </p>
            <ColorPalette
              current={module.color}
              onSelect={(color) => {
                updateModule(boardId, module.id, { color });
                setIsColorPaletteOpen(false);
              }}
            />
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />

      <style>{`
        @keyframes connectTarget {
          from { opacity: 0.35; }
          to   { opacity: 0.85; }
        }
      `}</style>
    </>
  );
}
