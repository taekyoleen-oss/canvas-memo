"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BoardCategory } from "@/types";
import { boardsForWorkspace } from "@/lib/boardCategory";
import { isModuleTypeAllowedOnBoard } from "@/lib/boardModulePolicy";
import { useCanvasStore } from "@/store/canvas";
import { useModuleClipboardStore } from "@/store/moduleClipboard";
import { useLongPress } from "@/hooks/useLongPress";
import ModuleContextMenu from "@/components/ui-overlays/ModuleContextMenu";
import ColorPalette from "@/components/ui-overlays/ColorPalette";
import DeleteConfirmDialog from "@/components/ui-overlays/DeleteConfirmDialog";

interface OrganizedModuleMenuProps {
  boardId: string;
  moduleId: string;
  /** 삭제 완료 시 호출(편집 오버레이 닫기 등). 선택. */
  onDeleted?: () => void;
  /** 카드 본문 영역에 롱프레스를 적용하고 싶을 때 children으로 감싼다. */
  children?: React.ReactNode;
  /** children을 감싸는 래퍼의 className(레이아웃 유지용). */
  className?: string;
}

/**
 * 정리 뷰의 한 모듈에 대한 ⋮ 버튼 + 컨텍스트 메뉴/색상/삭제 다이얼로그를 캡슐화.
 * 캔버스의 ModuleCardWrapper 배선을 그대로 옮기되, 캔버스 좌표·연결·드래그는 제외한다.
 * - 메뉴는 showConnect={false}(연결하기 숨김).
 * - 모든 오버레이는 createPortal(document.body).
 */
export default function OrganizedModuleMenu({
  boardId,
  moduleId,
  onDeleted,
  children,
  className,
}: OrganizedModuleMenuProps) {
  const updateModule = useCanvasStore((s) => s.updateModule);
  const removeModule = useCanvasStore((s) => s.removeModule);
  const duplicateModule = useCanvasStore((s) => s.duplicateModule);
  const moveModuleToBoard = useCanvasStore((s) => s.moveModuleToBoard);
  const boards = useCanvasStore((s) => s.boards);
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const mod = board?.modules.find((m) => m.id === moduleId);

  const clipboardPayload = useModuleClipboardStore((s) => s.payload);
  const copyToClipboard = useModuleClipboardStore((s) => s.copy);

  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false);
  const [colorPalettePos, setColorPalettePos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const colorPaletteDragRef = useRef<{
    origin: { x: number; y: number };
    client: { x: number; y: number };
  } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const moduleType = mod?.type;

  const moveBoardOptions = useMemo(() => {
    if (!board || !moduleType) return [];
    const order: BoardCategory[] = ["memo_schedule", "thinking", "topic_notes"];
    const labelOf: Record<BoardCategory, string> = {
      memo_schedule: "메모/할일",
      thinking: "생각정리",
      topic_notes: "주제별",
    };
    const list: Array<{
      id: string;
      label: string;
      category: BoardCategory;
      categoryLabel: string;
      disabled: boolean;
    }> = [];
    for (const cat of order) {
      for (const b of boardsForWorkspace(boards, cat)) {
        if (b.id === boardId) continue;
        list.push({
          id: b.id,
          label: `${b.icon ? `${b.icon} ` : ""}${
            (b.name ?? "").trim() || "제목 없음"
          }`.trim(),
          category: cat,
          categoryLabel: labelOf[cat],
          disabled: !isModuleTypeAllowedOnBoard(moduleType, b),
        });
      }
    }
    return list;
  }, [boards, board, boardId, moduleType]);

  const openColorPalette = useCallback(() => {
    const approxW = 280;
    const approxH = 220;
    setColorPalettePos({
      x: Math.max(12, Math.round(window.innerWidth / 2 - approxW / 2)),
      y: Math.max(12, Math.round(window.innerHeight / 2 - approxH / 2)),
    });
    setIsColorPaletteOpen(true);
  }, []);

  const closeColorPalette = useCallback(() => {
    setIsColorPaletteOpen(false);
    setColorPalettePos(null);
    colorPaletteDragRef.current = null;
  }, []);

  const openMenuFromRect = useCallback((rect: DOMRect) => {
    setMenuAnchorRect(rect);
    setIsContextMenuOpen(true);
  }, []);

  const longPressRef = useRef<HTMLElement | null>(null);
  const longPress = useLongPress(() => {
    const el = longPressRef.current;
    if (el) openMenuFromRect(el.getBoundingClientRect());
    else setIsContextMenuOpen(true);
  });

  function handleToggleMinimize() {
    if (!mod) return;
    updateModule(boardId, moduleId, { isMinimized: !mod.isMinimized });
  }

  function handleDelete() {
    removeModule(boardId, moduleId);
    setIsDeleteDialogOpen(false);
    setIsContextMenuOpen(false);
    onDeleted?.();
  }

  /** 「내용만 복사」 — 타입·data만 내부 클립보드에 저장 */
  function handleCopy() {
    if (!mod) return;
    copyToClipboard(mod.type, mod.data);
    setIsContextMenuOpen(false);
  }

  /** 「내용 붙여넣기」 — 복사한 data로 같은 종류 새 모듈 (기본 크기, 같은 색) */
  function handlePaste() {
    if (!mod) return;
    const payload = useModuleClipboardStore.getState().payload;
    if (!payload) return;
    const addModule = useCanvasStore.getState().addModule;
    addModule(boardId, {
      type: payload.type,
      position: { x: mod.position.x + 30, y: mod.position.y + 30 },
      size: { width: 200, height: 100 },
      zIndex: Math.max(1, Number(mod.zIndex ?? 0)) + 1,
      color: mod.color,
      isExpanded: false,
      data: JSON.parse(JSON.stringify(payload.data)),
    });
    setIsContextMenuOpen(false);
  }

  function handleDuplicateWholeModule() {
    duplicateModule(boardId, moduleId);
    setIsContextMenuOpen(false);
  }

  function handleMoveToBoard(targetBoardId: string) {
    moveModuleToBoard(boardId, targetBoardId, moduleId);
  }

  if (!board || !mod) return null;

  const trigger = (
    <button
      type="button"
      aria-label="모듈 메뉴 열기"
      onClick={(e) => {
        e.stopPropagation();
        openMenuFromRect(
          (e.currentTarget as HTMLElement).getBoundingClientRect()
        );
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.background =
          "var(--surface-hover)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.background = "transparent")
      }
      className="flex flex-shrink-0 items-center justify-center rounded-lg"
      style={{
        width: 44,
        height: 44,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "var(--text-secondary)",
        fontSize: 20,
        lineHeight: 1,
      }}
    >
      ⋮
    </button>
  );

  const overlays =
    typeof document !== "undefined"
      ? createPortal(
          <>
            <ModuleContextMenu
              isOpen={isContextMenuOpen}
              anchorRect={menuAnchorRect}
              onClose={() => setIsContextMenuOpen(false)}
              showConnect={false}
              zIndexBase={330}
              onConnect={() => {}}
              onColorChange={() => {
                setIsContextMenuOpen(false);
                openColorPalette();
              }}
              onDuplicateModule={handleDuplicateWholeModule}
              onCopyContent={handleCopy}
              onPasteContent={handlePaste}
              hasPasteTarget={clipboardPayload !== null}
              onToggleMinimize={() => {
                setIsContextMenuOpen(false);
                handleToggleMinimize();
              }}
              isMinimized={!!mod.isMinimized}
              onDelete={() => {
                setIsContextMenuOpen(false);
                setIsDeleteDialogOpen(true);
              }}
              moveBoardOptions={moveBoardOptions}
              onMoveToBoard={
                moveBoardOptions.length > 0 ? handleMoveToBoard : undefined
              }
            />

            {isColorPaletteOpen && colorPalettePos && (
              <div
                className="fixed inset-0 px-4"
                style={{ zIndex: 340, background: "rgba(0,0,0,0.4)" }}
                onClick={closeColorPalette}
              >
                <div
                  className="rounded-2xl p-4"
                  style={{
                    position: "fixed",
                    left: colorPalettePos.x,
                    top: colorPalettePos.y,
                    width: "min(280px, calc(100vw - 32px))",
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-lg)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="text-sm font-medium mb-3 px-1 flex items-center justify-between gap-2"
                    style={{
                      color: "var(--text-primary)",
                      cursor: "grab",
                      touchAction: "none",
                      userSelect: "none",
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).setPointerCapture(
                        e.pointerId
                      );
                      colorPaletteDragRef.current = {
                        origin: { ...colorPalettePos },
                        client: { x: e.clientX, y: e.clientY },
                      };
                    }}
                    onPointerMove={(e) => {
                      if (!colorPaletteDragRef.current) return;
                      e.stopPropagation();
                      const o = colorPaletteDragRef.current;
                      const nx = o.origin.x + (e.clientX - o.client.x);
                      const ny = o.origin.y + (e.clientY - o.client.y);
                      const maxX = window.innerWidth - 48;
                      const maxY = window.innerHeight - 48;
                      setColorPalettePos({
                        x: Math.round(Math.min(maxX, Math.max(8, nx))),
                        y: Math.round(Math.min(maxY, Math.max(8, ny))),
                      });
                    }}
                    onPointerUp={(e) => {
                      colorPaletteDragRef.current = null;
                      try {
                        (e.currentTarget as HTMLElement).releasePointerCapture(
                          e.pointerId
                        );
                      } catch {
                        /* */
                      }
                    }}
                    onPointerCancel={(e) => {
                      colorPaletteDragRef.current = null;
                      try {
                        (e.currentTarget as HTMLElement).releasePointerCapture(
                          e.pointerId
                        );
                      } catch {
                        /* */
                      }
                    }}
                  >
                    <span>색상 선택</span>
                    <span
                      className="text-xs font-normal"
                      style={{ color: "var(--text-muted)" }}
                    >
                      끌어서 이동
                    </span>
                  </div>
                  <ColorPalette
                    current={mod.color}
                    onSelect={(color) => {
                      updateModule(boardId, moduleId, { color });
                      closeColorPalette();
                    }}
                  />
                </div>
              </div>
            )}

            {/* 편집 오버레이(z300)·그룹 팝업(z280) 위에 띄우기 위해 stacking context 격상 */}
            <div style={{ position: "relative", zIndex: 340 }}>
              <DeleteConfirmDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={handleDelete}
              />
            </div>
          </>,
          document.body
        )
      : null;

  // children이 있으면 카드 본문에 롱프레스를 적용한 래퍼로 감싸고 ⋮ 버튼을 동봉.
  if (children) {
    return (
      <div
        ref={(el) => {
          longPressRef.current = el;
        }}
        className={className}
        {...longPress}
      >
        {children}
        {trigger}
        {overlays}
      </div>
    );
  }

  return (
    <>
      {trigger}
      {overlays}
    </>
  );
}
