"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
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

  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastSyncedHeightRef = useRef<number>(0);

  const dragStartRef = useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    moduleX: number;
    moduleY: number;
  } | null>(null);
  const didDragRef = useRef(false);

  // 실제 렌더링 높이를 store에 동기화 (앵커 위치 계산 정확도 향상)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.offsetHeight);
      if (h > 0 && h !== lastSyncedHeightRef.current) {
        lastSyncedHeightRef.current = h;
        updateModule(boardId, module.id, {
          size: { width: module.size.width, height: h },
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [boardId, module.id, module.size.width, updateModule]);

  // 컨텍스트 메뉴가 열려 있을 때 document 클릭으로 닫기
  useEffect(() => {
    if (!isContextMenuOpen) return;
    function close() { setIsContextMenuOpen(false); }
    const id = setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", close);
    };
  }, [isContextMenuOpen]);

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

      // 항상 didDragRef 초기화 (early return 이전)
      didDragRef.current = false;

      // 연결 모드: 드래그 이동 막기, 이벤트 버블링 차단
      if (useConnectionStore.getState().mode === "connecting") {
        e.stopPropagation();
        return;
      }

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
        didDragRef.current = true;
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

  // ── 포인터 업: 드래그 종료 ───────────────────────────────────
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      if (dragStartRef.current.pointerId !== e.pointerId) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      dragStartRef.current = null;
      setIsDragging(false);
    },
    []
  );

  function handleDataChange(data: Module["data"]) {
    updateModule(boardId, module.id, { data });
  }

  function handleTitleChange(title: string) {
    updateModule(boardId, module.id, { data: { ...module.data, title } });
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
    setIsContextMenuOpen(false);
  }

  // ── 클릭: 더블클릭=확장토글 / 연결완성 / 단일클릭=선택 ──────────
  function handleClick(e: React.MouseEvent) {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea")
    ) {
      return;
    }

    // 더블클릭 → 확장 토글 (connecting 모드와 무관하게 최우선)
    if (e.detail === 2) {
      handleToggleExpand();
      return;
    }

    // 연결 모드: 클릭한 모듈로 연결 완성
    const { mode, fromModuleId: fromId } = useConnectionStore.getState();
    if (mode === "connecting") {
      if (fromId && fromId !== module.id) {
        const fromMod = board?.modules.find((m) => m.id === fromId);
        const toAnchor = fromMod ? getBestToAnchor(fromMod, module) : "left";
        finishConnecting(module.id, toAnchor);
      }
      return;
    }

    // 단일 클릭 → 선택/해제
    if (isSelected) {
      onDeselect();
    } else {
      onSelect(module.id);
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
  const isDragSource       = dragSourceModuleId === module.id;

  return (
    <>
      <div
        ref={wrapperRef}
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

        {/* 연결 타겟 클릭 오버레이 — 내부 버튼보다 위에 위치해 어디 클릭해도 연결 완성 */}
        {isConnectTarget && (
          <div
            data-module-wrapper-id={module.id}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              zIndex: 25,
              cursor: "crosshair",
            }}
            onClick={(e) => {
              e.stopPropagation();
              const { fromModuleId: fromId } = useConnectionStore.getState();
              if (fromId && fromId !== module.id) {
                const fromMod = board?.modules.find((m) => m.id === fromId);
                const toAnchor = fromMod ? getBestToAnchor(fromMod, module) : "left";
                finishConnecting(module.id, toAnchor);
              }
            }}
          />
        )}

        {/* output 앵커: hover·connecting 모드·드래그 중에만 표시 (isSelected 제거 — 선택 시 자동표시가 의도치 않은 연결모드 진입 유발) */}
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
          onTitleChange={handleTitleChange}
        >
          {renderModuleContent()}
        </ModuleCard>
      </div>

      {/* ── 오버레이: CSS transform 밖(document.body)에 portal로 렌더링 ── */}
      {createPortal(
        <>
          <ModuleContextMenu
            isOpen={isContextMenuOpen}
            anchorRect={menuAnchorRect}
            onClose={() => setIsContextMenuOpen(false)}
            onConnect={handleStartConnect}
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
        </>,
        document.body
      )}

      <style>{`
        @keyframes connectTarget {
          from { opacity: 0.35; }
          to   { opacity: 0.85; }
        }
      `}</style>
    </>
  );
}
