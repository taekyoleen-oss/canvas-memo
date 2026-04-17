"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Module, MemoData, ScheduleData, ImageData, LinkData, FileData } from "@/types";
import type { AnchorSide } from "@/lib/canvas/geometry";
import { useCanvasStore } from "@/store/canvas";
import { useConnectionStore } from "@/store/connection";
import { useLongPress } from "@/hooks/useLongPress";
import ModuleCard from "./ModuleCard";
import MemoModule from "./MemoModule";
import ScheduleModule from "./ScheduleModule";
import ImageModule from "./ImageModule";
import LinkModule from "./LinkModule";
import FileModule from "./FileModule";
import ModuleContextMenu from "@/components/ui-overlays/ModuleContextMenu";
import RichTextToolbar from "@/components/ui-overlays/RichTextToolbar";
import ColorPalette from "@/components/ui-overlays/ColorPalette";
import DeleteConfirmDialog from "@/components/ui-overlays/DeleteConfirmDialog";
import AnchorPoint from "@/components/canvas/AnchorPoint";
import { v4 as uuidv4 } from "uuid";
import { useRichTextStore } from "@/store/richText";

interface ModuleCardWrapperProps {
  module: Module;
  boardId: string;
  viewport: { x: number; y: number; zoom: number };
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  isMultiSelected?: boolean;
  onMultiDragStart?: () => void;
  onMultiDragMove?: (dx: number, dy: number) => void;
  onShiftSelect?: (id: string) => void;
}

let _moduleClipboard: { type: Module["type"]; data: Module["data"] } | null = null;

function getBestToAnchor(fromModule: Module, toModule: Module): AnchorSide {
  const fromCx = fromModule.position.x + fromModule.size.width / 2;
  const fromCy = fromModule.position.y + fromModule.size.height / 2;
  const toCx = toModule.position.x + toModule.size.width / 2;
  const toCy = toModule.position.y + toModule.size.height / 2;
  const dx = fromCx - toCx;
  const dy = fromCy - toCy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

// ── 리사이즈 타입 ────────────────────────────────────────────────────────
type ResizeType = "e" | "s" | "se";

export default function ModuleCardWrapper({
  module,
  boardId,
  viewport,
  isSelected,
  onSelect,
  onDeselect,
  isMultiSelected = false,
  onMultiDragStart,
  onMultiDragMove,
  onShiftSelect,
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
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);
  const [, forceUpdate] = useState(0);

  // ── 리사이즈 상태 ──────────────────────────────────────────────────────
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    startW: number;
    startH: number;
    type: ResizeType;
  } | null>(null);
  // 수동 높이 설정 여부 (null이면 자동)
  const manualHeightRef = useRef<number | null>(null);

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
  const multiDragStartedRef = useRef(false);

  const rafRef = useRef<number | null>(null);
  const pendingMoveRef = useRef<{ canvasDx: number; canvasDy: number } | null>(null);

  // 실제 렌더링 높이를 store에 동기화 (수동 높이가 없을 때만)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (manualHeightRef.current !== null) return; // 수동 높이 설정 중이면 무시
      const h = Math.round(el.offsetHeight);
      if (h > 0 && h !== lastSyncedHeightRef.current) {
        lastSyncedHeightRef.current = h;
        updateModule(boardId, module.id, { size: { width: module.size.width, height: h } });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [boardId, module.id, module.size.width, updateModule]);

  useEffect(() => {
    if (!isContextMenuOpen) return;
    function close() { setIsContextMenuOpen(false); }
    const id = setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
    return () => { clearTimeout(id); document.removeEventListener("click", close); };
  }, [isContextMenuOpen]);

  const longPress = useLongPress(() => { setIsContextMenuOpen(true); });

  // ── 드래그 이동 ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" || target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest("button") || target.closest("[role=button]") ||
        target.closest("[data-resize-handle]") ||
        target.closest('[contenteditable="true"]')
      ) return;

      didDragRef.current = false;
      if (useConnectionStore.getState().mode === "connecting") { e.stopPropagation(); return; }
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
        useCanvasStore.getState().pushHistory();
        setIsDragging(true);
        didDragRef.current = true;
        if (isMultiSelected && onMultiDragStart && !multiDragStartedRef.current) {
          multiDragStartedRef.current = true;
          onMultiDragStart();
        }
      }

      if (isDragging) {
        const canvasDx = dx / viewport.zoom;
        const canvasDy = dy / viewport.zoom;
        pendingMoveRef.current = { canvasDx, canvasDy };
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const move = pendingMoveRef.current;
            const start = dragStartRef.current;
            if (!move || !start) return;
            if (isMultiSelected && onMultiDragMove && multiDragStartedRef.current) {
              onMultiDragMove(move.canvasDx, move.canvasDy);
            } else {
              updateModule(boardId, module.id, { position: { x: start.moduleX + move.canvasDx, y: start.moduleY + move.canvasDy } });
            }
          });
        }
      }
    },
    [isDragging, viewport.zoom, boardId, module.id, updateModule, isMultiSelected, onMultiDragStart, onMultiDragMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      if (dragStartRef.current.pointerId !== e.pointerId) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        const move = pendingMoveRef.current;
        const start = dragStartRef.current;
        if (move && start) {
          if (isMultiSelected && onMultiDragMove && multiDragStartedRef.current) {
            onMultiDragMove(move.canvasDx, move.canvasDy);
          } else {
            updateModule(boardId, module.id, { position: { x: start.moduleX + move.canvasDx, y: start.moduleY + move.canvasDy } });
          }
        }
        pendingMoveRef.current = null;
      }
      dragStartRef.current = null;
      multiDragStartedRef.current = false;
      setIsDragging(false);
    },
    [boardId, module.id, updateModule, isMultiSelected, onMultiDragMove]
  );

  // ── 리사이즈 핸들러 ────────────────────────────────────────────────────
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, type: ResizeType) => {
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      resizeStartRef.current = {
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        startW: module.size.width,
        startH: module.size.height,
        type,
      };
      setIsResizing(true);
    },
    [module.size]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rs = resizeStartRef.current;
      if (!rs || rs.pointerId !== e.pointerId) return;
      e.stopPropagation();

      const rawDx = (e.clientX - rs.clientX) / viewport.zoom;
      const rawDy = (e.clientY - rs.clientY) / viewport.zoom;

      const MIN_W = 180, MAX_W = 720;
      const MIN_H = 80;

      let newW = rs.startW;
      let newH: number | null = null;

      if (rs.type === "e" || rs.type === "se") {
        newW = Math.min(MAX_W, Math.max(MIN_W, rs.startW + rawDx));
      }
      if (rs.type === "s" || rs.type === "se") {
        const candidate = Math.max(MIN_H, rs.startH + rawDy);
        newH = candidate;
        manualHeightRef.current = candidate;
      }

      const sizeUpdate: { width: number; height?: number } = { width: Math.round(newW) };
      if (newH !== null) sizeUpdate.height = Math.round(newH);
      updateModule(boardId, module.id, { size: sizeUpdate as { width: number; height: number } });
    },
    [viewport.zoom, boardId, module.id, updateModule]
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeStartRef.current || resizeStartRef.current.pointerId !== e.pointerId) return;
      e.stopPropagation();
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      resizeStartRef.current = null;
      setIsResizing(false);
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
    // 접을 때 수동 높이 초기화
    if (module.isExpanded) {
      manualHeightRef.current = null;
      lastSyncedHeightRef.current = 0;
    }
  }

  function handleToggleMinimize() {
    updateModule(boardId, module.id, { isMinimized: !module.isMinimized });
  }

  function handleDelete() {
    removeModule(boardId, module.id);
    setIsDeleteDialogOpen(false);
    setIsContextMenuOpen(false);
    onDeselect();
  }

  function handleCopy() {
    _moduleClipboard = { type: module.type, data: JSON.parse(JSON.stringify(module.data)) };
    forceUpdate((n) => n + 1);
    setIsContextMenuOpen(false);
  }

  function handlePaste() {
    if (!_moduleClipboard) return;
    const addModule = useCanvasStore.getState().addModule;
    addModule(boardId, {
      type: _moduleClipboard.type,
      position: { x: module.position.x + 30, y: module.position.y + 30 },
      size: { width: 200, height: 100 },
      zIndex: module.zIndex + 1,
      color: module.color,
      isExpanded: false,
      data: JSON.parse(JSON.stringify(_moduleClipboard.data)),
    });
    setIsContextMenuOpen(false);
  }

  function handleStartConnect() {
    startConnecting(module.id, "right");
    setIsContextMenuOpen(false);
  }

  function handleClick(e: React.MouseEvent) {
    if (didDragRef.current) { didDragRef.current = false; return; }
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" || target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest("button") || target.closest("input") || target.closest("textarea")
    ) return;

    if (e.detail === 2) {
      if (module.isMinimized) handleToggleMinimize();
      else handleToggleExpand();
      return;
    }

    const { mode, fromModuleId: fromId } = useConnectionStore.getState();
    if (mode === "connecting") {
      if (fromId && fromId !== module.id) {
        const fromMod = board?.modules.find((m) => m.id === fromId);
        const toAnchor = fromMod ? getBestToAnchor(fromMod, module) : "left";
        finishConnecting(module.id, toAnchor);
      }
      return;
    }

    if (e.shiftKey && onShiftSelect) { onShiftSelect(module.id); return; }
    if (isSelected) onDeselect();
    else onSelect(module.id);
  }

  function renderModuleContent() {
    switch (module.type) {
      case "memo": return <MemoModule data={module.data as MemoData} isExpanded={module.isExpanded} onChange={handleDataChange} />;
      case "schedule": return <ScheduleModule data={module.data as ScheduleData} isExpanded={module.isExpanded} onChange={handleDataChange} />;
      case "image": return <ImageModule data={module.data as ImageData} isExpanded={module.isExpanded} onChange={handleDataChange} />;
      case "link": return <LinkModule data={module.data as LinkData} isExpanded={module.isExpanded} onChange={handleDataChange} />;
      case "file": return <FileModule data={module.data as FileData} moduleId={module.id} isExpanded={module.isExpanded} onChange={handleDataChange} />;
      default: return null;
    }
  }

  const isConnectingMode   = connectionMode === "connecting";
  const isConnectingSource = isConnectingMode && fromModuleId === module.id;
  const isConnectTarget    = isConnectingMode && fromModuleId !== module.id;
  const isDragSource       = dragSourceModuleId === module.id;

  // 수동 높이가 설정된 경우 콘텐츠 영역에 적용할 높이
  const contentAreaHeight = manualHeightRef.current !== null
    ? module.size.height - 44 - 28 // header(44) + footer(28)
    : undefined;

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
          ...(manualHeightRef.current !== null ? { height: module.size.height } : {}),
          zIndex: (isDragging || isResizing) ? 1000 : module.zIndex,
          transform: isDragging ? "scale(1.03)" : "scale(1)",
          transition: (isDragging || isResizing) ? "none" : "transform 0.15s ease",
          cursor: isConnectTarget ? "crosshair" : isDragging ? "grabbing" : "grab",
          touchAction: "none",
          outline: isMultiSelected ? "2px solid rgb(59,130,246)" : undefined,
          borderRadius: isMultiSelected ? 14 : undefined,
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
        {isConnectTarget && (
          <div style={{ position: "absolute", inset: -4, borderRadius: 16, border: "2px dashed var(--primary)", pointerEvents: "none", zIndex: 30, opacity: 0.7, animation: "connectTarget 0.7s ease-in-out infinite alternate" }} />
        )}
        {isConnectTarget && (
          <div data-module-wrapper-id={module.id} style={{ position: "absolute", inset: 0, borderRadius: 12, zIndex: 25, cursor: "crosshair" }}
            onClick={(e) => {
              e.stopPropagation();
              const { fromModuleId: fromId } = useConnectionStore.getState();
              if (fromId && fromId !== module.id) {
                const fromMod = board?.modules.find((m) => m.id === fromId);
                const toAnchor = fromMod ? getBestToAnchor(fromMod, module) : "left";
                finishConnecting(module.id, toAnchor);
              }
            }} />
        )}

        {(showAnchors || isConnectingMode || isDragSource) &&
          (["top", "right", "bottom", "left"] as const).map((side) => (
            <AnchorPoint key={`out-${side}`} type="output" moduleId={module.id} anchor={side} viewport={viewport} />
          ))}
        {isConnectingMode &&
          (["top", "right", "bottom", "left"] as const).map((side) => (
            <AnchorPoint key={`in-${side}`} type="input" moduleId={module.id} anchor={side} viewport={viewport} />
          ))}

        <ModuleCard
          module={module}
          isSelected={isSelected}
          isConnectingSource={isConnectingSource}
          onContextMenu={(rect) => { setMenuAnchorRect(rect); setIsContextMenuOpen(true); }}
          onToggleExpand={handleToggleExpand}
          onToggleMinimize={handleToggleMinimize}
          onTitleChange={handleTitleChange}
          onFullView={() => setIsFullViewOpen(true)}
          contentAreaHeight={contentAreaHeight}
        >
          {renderModuleContent()}
        </ModuleCard>

        {/* ── 리사이즈 핸들 (펼쳐진 상태에서만) ──────────────────────── */}
        {module.isExpanded && !module.isMinimized && (
          <>
            {/* 오른쪽 가장자리 */}
            <div
              data-resize-handle="e"
              style={{
                position: "absolute", right: -4, top: 8, bottom: 8,
                width: 8,
                cursor: "ew-resize",
                zIndex: 20,
                borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onPointerDown={(e) => handleResizePointerDown(e, "e")}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
            >
              <div style={{ width: 3, height: 24, borderRadius: 2, background: isResizing && resizeStartRef.current?.type === "e" ? "var(--primary)" : "var(--border)", opacity: 0.7, transition: "background 0.15s" }} />
            </div>
            {/* 하단 가장자리 */}
            <div
              data-resize-handle="s"
              style={{
                position: "absolute", left: 8, right: 8, bottom: -4,
                height: 8,
                cursor: "ns-resize",
                zIndex: 20,
                borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onPointerDown={(e) => handleResizePointerDown(e, "s")}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
            >
              <div style={{ height: 3, width: 24, borderRadius: 2, background: isResizing && resizeStartRef.current?.type === "s" ? "var(--primary)" : "var(--border)", opacity: 0.7, transition: "background 0.15s" }} />
            </div>
            {/* 오른쪽 하단 모서리 */}
            <div
              data-resize-handle="se"
              style={{
                position: "absolute", right: -4, bottom: -4,
                width: 16, height: 16,
                cursor: "nwse-resize",
                zIndex: 21,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onPointerDown={(e) => handleResizePointerDown(e, "se")}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ pointerEvents: "none" }}>
                <path d="M2 8 L8 2 M5 8 L8 5 M8 8 L8 8" stroke={isResizing && resizeStartRef.current?.type === "se" ? "var(--primary)" : "var(--border)"} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </>
        )}
      </div>

      {createPortal(
        <>
          <ModuleContextMenu
            isOpen={isContextMenuOpen}
            anchorRect={menuAnchorRect}
            onClose={() => setIsContextMenuOpen(false)}
            onConnect={handleStartConnect}
            onColorChange={() => { setIsContextMenuOpen(false); setIsColorPaletteOpen(true); }}
            onCopy={handleCopy}
            onPaste={handlePaste}
            hasPasteTarget={_moduleClipboard !== null}
            onToggleMinimize={() => { setIsContextMenuOpen(false); handleToggleMinimize(); }}
            isMinimized={!!module.isMinimized}
            onDelete={() => { setIsContextMenuOpen(false); setIsDeleteDialogOpen(true); }}
          />

          {isColorPaletteOpen && (
            <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: 100, background: "rgba(0,0,0,0.4)" }} onClick={() => setIsColorPaletteOpen(false)}>
              <div className="rounded-2xl p-4" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
                <p className="text-sm font-medium mb-3 px-1" style={{ color: "var(--text-primary)" }}>색상 선택</p>
                <ColorPalette current={module.color} onSelect={(color) => { updateModule(boardId, module.id, { color }); setIsColorPaletteOpen(false); }} />
              </div>
            </div>
          )}

          <DeleteConfirmDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={handleDelete} />

          {isFullViewOpen && (
            module.type === "image"
              ? <ImageFullView module={module} onClose={() => setIsFullViewOpen(false)} />
              : <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: 200, background: "rgba(0,0,0,0.55)" }} onClick={() => setIsFullViewOpen(false)}>
                  <div className="rounded-2xl flex flex-col" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", width: "min(600px, 100%)", maxHeight: "85vh", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                      {/* 제목 편집 가능 */}
                      <input
                        type="text"
                        value={(module.data as { title?: string }).title ?? ""}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="제목"
                        style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "var(--text-primary)", background: "transparent", border: "none", outline: "none", minWidth: 0 }}
                      />
                      <button onClick={() => setIsFullViewOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-muted)", lineHeight: 1, padding: "4px 8px" }} aria-label="닫기">✕</button>
                    </div>
                    {module.type === "memo" && <RichTextToolbar />}
                    <div className="overflow-y-auto p-5" style={{ flex: 1 }}>
                      <FullViewContent module={module} onChange={handleDataChange} />
                    </div>
                  </div>
                </div>
          )}
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

// ── 이미지 전체화면 뷰어 ────────────────────────────────────────────────
function ImageFullView({ module, onClose }: { module: Module; onClose: () => void }) {
  const d = module.data as ImageData;
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 200, background: "rgba(0,0,0,0.92)" }} onClick={onClose}>
      <div className="flex items-center justify-between px-4 flex-shrink-0" style={{ height: 52 }} onClick={(e) => e.stopPropagation()}>
        <span className="font-medium text-sm truncate max-w-[70%]" style={{ color: "rgba(255,255,255,0.85)" }}>{d.title || d.caption || "이미지"}</span>
        <div className="flex items-center gap-2">
          {d.src && (
            <button onClick={() => setZoomed((v) => !v)} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 12, padding: "5px 10px" }} title={zoomed ? "축소" : "확대"}>
              {zoomed ? "축소 ▼" : "확대 ▲"}
            </button>
          )}
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 18, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="닫기">✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center" style={{ touchAction: "pinch-zoom" }} onClick={(e) => { e.stopPropagation(); setZoomed((v) => !v); }}>
        {d.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.src} alt={d.caption || d.title} style={{ maxWidth: zoomed ? "none" : "100%", maxHeight: zoomed ? "none" : "100%", width: zoomed ? "auto" : undefined, objectFit: "contain", transition: "max-width 200ms, max-height 200ms", cursor: zoomed ? "zoom-out" : "zoom-in", userSelect: "none" }} draggable={false} />
        ) : (
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>이미지 없음</span>
        )}
      </div>
      {d.caption && (
        <div className="flex-shrink-0 text-center py-3 px-4" style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }} onClick={(e) => e.stopPropagation()}>{d.caption}</div>
      )}
    </div>
  );
}

// ── 전체 보기 내용 (편집 가능) ────────────────────────────────────────────
function FullViewContent({ module, onChange }: { module: Module; onChange: (data: Module["data"]) => void }) {
  switch (module.type) {
    case "memo": {
      const d = module.data as MemoData;
      return <RichMemoFullView data={d} onChange={(nd) => onChange(nd)} />;
    }
    case "schedule": {
      const d = module.data as ScheduleData;
      return <ScheduleFullView data={d} onChange={(nd) => onChange(nd)} />;
    }
    case "image": {
      const d = module.data as ImageData;
      return (
        <div className="flex flex-col gap-3">
          {d.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.src} alt={d.caption || d.title} className="w-full rounded-lg object-contain" style={{ maxHeight: 400 }} />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>이미지 없음</p>
          )}
          <input type="text" value={d.caption} onChange={(e) => onChange({ ...d, caption: e.target.value })} placeholder="캡션 입력..."
            style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
      );
    }
    case "link": {
      const d = module.data as LinkData;
      return (
        <div className="flex flex-col gap-3">
          {d.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.thumbnail} alt={d.title} className="w-full rounded-lg object-cover" style={{ height: 180 }} />
          )}
          <input type="url" value={d.url} onChange={(e) => onChange({ ...d, url: e.target.value })} placeholder="URL 입력..."
            style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          <input type="text" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} placeholder="제목..."
            style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          <textarea value={d.description} onChange={(e) => onChange({ ...d, description: e.target.value })} placeholder="설명..."
            style={{ width: "100%", minHeight: 80, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
          {d.url && (
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs truncate" style={{ color: "var(--primary)" }}>{d.url} ↗</a>
          )}
        </div>
      );
    }
    case "file": {
      const d = module.data as FileData;
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 32 }}>📎</span>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{d.fileName || "파일 없음"}</span>
              {d.fileType && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{d.fileType}{d.fileSize > 0 ? ` · ${d.fileSize < 1024 * 1024 ? `${(d.fileSize / 1024).toFixed(1)} KB` : `${(d.fileSize / (1024 * 1024)).toFixed(1)} MB`}` : ""}</span>}
            </div>
          </div>
          {d.src && (
            <button onClick={() => {
              if (d.src.startsWith("http")) { window.open(d.src, "_blank", "noopener,noreferrer"); return; }
              try {
                const parts = d.src.split(",");
                const byteString = atob(parts[1]);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                const blob = new Blob([ab], { type: d.fileType });
                window.open(URL.createObjectURL(blob), "_blank");
              } catch { console.warn("파일을 열 수 없습니다."); }
            }} className="rounded-lg text-sm font-medium" style={{ height: 40, background: "var(--primary)", border: "none", cursor: "pointer", color: "var(--primary-fg)" }}>
              파일 열기 ↗
            </button>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

// ── 일정 전체보기 (편집 가능) ────────────────────────────────────────────
function ScheduleFullView({ data, onChange }: { data: ScheduleData; onChange: (d: ScheduleData) => void }) {
  const [newItemText, setNewItemText] = useState("");

  function toggleItem(id: string) {
    onChange({ ...data, items: data.items.map((item) => item.id === id ? { ...item, done: !item.done } : item) });
  }

  function deleteItem(id: string) {
    onChange({ ...data, items: data.items.filter((item) => item.id !== id) });
  }

  function addItem() {
    if (!newItemText.trim()) return;
    onChange({ ...data, items: [...data.items, { id: uuidv4(), text: newItemText.trim(), dueDate: null, done: false }] });
    setNewItemText("");
  }

  return (
    <div className="flex flex-col gap-2">
      {data.items.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>일정 항목 없음</p>}
      {data.items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 group">
          <input type="checkbox" checked={item.done} onChange={() => toggleItem(item.id)}
            style={{ width: 16, height: 16, accentColor: "var(--primary)", flexShrink: 0, cursor: "pointer" }} />
          <span className="flex-1 text-sm" style={{ color: item.done ? "var(--text-muted)" : "var(--text-primary)", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
          <button onClick={() => deleteItem(item.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: "2px 4px", opacity: 0, transition: "opacity 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}>✕</button>
        </div>
      ))}
      <div className="flex gap-1 mt-2">
        <input type="text" value={newItemText} onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder="새 항목 추가..."
          style={{ flex: 1, height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
        <button onClick={addItem} style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "var(--primary)", color: "var(--primary-fg)", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>+</button>
      </div>
    </div>
  );
}

// ── 전체보기 리치 텍스트 메모 에디터 ────────────────────────────────────────
function RichMemoFullView({ data, onChange }: { data: MemoData; onChange: (d: MemoData) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const setEditorFocused = useRichTextStore((s) => s.setEditorFocused);

  // 전체보기가 열린 동안 툴바를 항상 활성 상태로 유지
  useEffect(() => {
    setEditorFocused(true);
    return () => setEditorFocused(false);
  }, [setEditorFocused]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const html = data.content ?? "";
    if (el.innerHTML !== html) el.innerHTML = html;
  });

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder="내용을 입력하세요..."
      onFocus={() => setEditorFocused(true)}
      onBlur={() => setEditorFocused(false)}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={(e) => {
        isComposing.current = false;
        onChange({ ...data, content: (e.currentTarget as HTMLDivElement).innerHTML });
      }}
      onInput={(e) => {
        if (isComposing.current) return;
        onChange({ ...data, content: (e.currentTarget as HTMLDivElement).innerHTML });
      }}
      style={{
        minHeight: 280,
        outline: "none",
        fontSize: 14,
        color: "var(--text-primary)",
        lineHeight: 1.7,
        wordBreak: "break-word",
        overflowWrap: "break-word",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "12px 14px",
      }}
    />
  );
}
