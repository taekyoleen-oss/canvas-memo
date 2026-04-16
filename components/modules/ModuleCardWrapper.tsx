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
  isMultiSelected?: boolean;
  onMultiDragStart?: () => void;
  onMultiDragMove?: (dx: number, dy: number) => void;
  onShiftSelect?: (id: string) => void;
}

// 모듈 클립보드 (복사/붙여넣기용 - 페이지 세션 동안 유지)
let _moduleClipboard: { type: Module["type"]; data: Module["data"] } | null = null;

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
  const [, forceUpdate] = useState(0); // 클립보드 상태 변경 시 리렌더링용

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
        if (isMultiSelected && onMultiDragStart && !multiDragStartedRef.current) {
          multiDragStartedRef.current = true;
          onMultiDragStart();
        }
      }

      if (isDragging) {
        const canvasDx = dx / viewport.zoom;
        const canvasDy = dy / viewport.zoom;
        if (isMultiSelected && onMultiDragMove && multiDragStartedRef.current) {
          onMultiDragMove(canvasDx, canvasDy);
        } else {
          updateModule(boardId, module.id, {
            position: {
              x: dragStartRef.current.moduleX + canvasDx,
              y: dragStartRef.current.moduleY + canvasDy,
            },
          });
        }
      }
    },
    [isDragging, viewport.zoom, boardId, module.id, updateModule, isMultiSelected, onMultiDragStart, onMultiDragMove]
  );

  // ── 포인터 업: 드래그 종료 ───────────────────────────────────
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      if (dragStartRef.current.pointerId !== e.pointerId) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      dragStartRef.current = null;
      multiDragStartedRef.current = false;
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

  function handleCopy() {
    _moduleClipboard = {
      type: module.type,
      data: JSON.parse(JSON.stringify(module.data)),
    };
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

    // Shift+클릭 → 다중 선택에 추가/제거
    if (e.shiftKey && onShiftSelect) {
      onShiftSelect(module.id);
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
      case "file":
        return (
          <FileModule
            data={module.data as FileData}
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
          onFullView={() => setIsFullViewOpen(true)}
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
            onCopy={handleCopy}
            onPaste={handlePaste}
            hasPasteTarget={_moduleClipboard !== null}
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

          {isFullViewOpen && (
            <div
              className="fixed inset-0 flex items-center justify-center px-4"
              style={{ zIndex: 200, background: "rgba(0,0,0,0.55)" }}
              onClick={() => setIsFullViewOpen(false)}
            >
              <div
                className="rounded-2xl flex flex-col"
                style={{
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-lg)",
                  width: "min(560px, 100%)",
                  maxHeight: "80vh",
                  overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 전체 보기 헤더 */}
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: "1px solid var(--border)", flexShrink: 0 }}
                >
                  <span
                    className="font-semibold text-base"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {(module.data as { title?: string }).title || "전체 보기"}
                  </span>
                  <button
                    onClick={() => setIsFullViewOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 20,
                      color: "var(--text-muted)",
                      lineHeight: 1,
                      padding: "4px 8px",
                    }}
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>

                {/* 전체 보기 내용 */}
                <div className="overflow-y-auto p-5" style={{ flex: 1 }}>
                  <FullViewContent module={module} />
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

// ── 전체 보기 내용 컴포넌트 ──────────────────────────────────────────
function FullViewContent({ module }: { module: Module }) {
  switch (module.type) {
    case "memo": {
      const d = module.data as MemoData;
      return (
        <p
          className="text-sm"
          style={{
            color: "var(--text-primary)",
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
          }}
        >
          {d.content || "내용 없음"}
        </p>
      );
    }
    case "schedule": {
      const d = module.data as ScheduleData;
      return (
        <div className="flex flex-col gap-2">
          {d.items.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              일정 항목 없음
            </p>
          )}
          {d.items.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <span style={{ fontSize: 16 }}>{item.done ? "✅" : "⬜"}</span>
              <span
                className="text-sm"
                style={{
                  color: item.done ? "var(--text-muted)" : "var(--text-primary)",
                  textDecoration: item.done ? "line-through" : "none",
                  lineHeight: 1.5,
                }}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      );
    }
    case "image": {
      const d = module.data as ImageData;
      return (
        <div className="flex flex-col gap-3">
          {d.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.src}
              alt={d.caption || d.title}
              className="w-full rounded-lg object-contain"
              style={{ maxHeight: 400 }}
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              이미지 없음
            </p>
          )}
          {d.caption && (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {d.caption}
            </p>
          )}
        </div>
      );
    }
    case "link": {
      const d = module.data as LinkData;
      return (
        <div className="flex flex-col gap-3">
          {d.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.thumbnail}
              alt={d.title}
              className="w-full rounded-lg object-cover"
              style={{ height: 180 }}
            />
          )}
          {d.title && (
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              {d.title}
            </p>
          )}
          {d.description && (
            <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {d.description}
            </p>
          )}
          {d.url && (
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs truncate"
              style={{ color: "var(--primary)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {d.url} ↗
            </a>
          )}
        </div>
      );
    }
    case "file": {
      const d = module.data as FileData;
      return (
        <div className="flex flex-col gap-3">
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}
          >
            <span style={{ fontSize: 32 }}>📎</span>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {d.fileName || "파일 없음"}
              </span>
              {d.fileType && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {d.fileType}
                  {d.fileSize > 0
                    ? ` · ${d.fileSize < 1024 * 1024 ? `${(d.fileSize / 1024).toFixed(1)} KB` : `${(d.fileSize / (1024 * 1024)).toFixed(1)} MB`}`
                    : ""}
                </span>
              )}
            </div>
          </div>
          {d.src && (
            <button
              onClick={() => {
                try {
                  const parts = d.src.split(",");
                  const byteString = atob(parts[1]);
                  const ab = new ArrayBuffer(byteString.length);
                  const ia = new Uint8Array(ab);
                  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                  const blob = new Blob([ab], { type: d.fileType });
                  window.open(URL.createObjectURL(blob), "_blank");
                } catch {
                  console.warn("파일을 열 수 없습니다.");
                }
              }}
              className="rounded-lg text-sm font-medium"
              style={{
                height: 40,
                background: "var(--primary)",
                border: "none",
                cursor: "pointer",
                color: "var(--primary-fg)",
              }}
            >
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
