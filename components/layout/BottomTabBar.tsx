"use client";

import { useMemo, useRef, useState } from "react";
import type { Board, BoardCategory } from "@/types";
import { useCanvasStore } from "@/store/canvas";
import {
  localIndexInCategory,
  normalizeBoardCategory,
  sortBoardsForSidebar,
} from "@/lib/boardCategory";

interface BottomTabBarProps {
  boards: Board[];
  activeBoardId: string | null;
  /** 현재 상단 탭 — 새 보드 FAB에 사용 */
  activeWorkspace: BoardCategory;
  onSelect: (id: string) => void;
  onAdd: (category: BoardCategory) => void;
}

export default function BottomTabBar({
  boards,
  activeBoardId,
  activeWorkspace,
  onSelect,
  onAdd,
}: BottomTabBarProps) {
  const reorderBoardsInCategory = useCanvasStore((s) => s.reorderBoardsInCategory);
  const sorted = useMemo(() => sortBoardsForSidebar(boards), [boards]);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const touchStartXRef = useRef<number>(0);
  const touchDragIndexRef = useRef<number | null>(null);
  const [touchDragging, setTouchDragging] = useState(false);
  const [touchDragOver, setTouchDragOver] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function getIndexFromTouchX(clientX: number): number | null {
    for (let i = 0; i < tabRefs.current.length; i++) {
      const el = tabRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return i;
    }
    return null;
  }

  function applyReorder(from: number, to: number) {
    if (from === to) return;
    const catA = normalizeBoardCategory(sorted[from]);
    const catB = normalizeBoardCategory(sorted[to]);
    if (catA !== catB) return;
    reorderBoardsInCategory(
      catA,
      localIndexInCategory(sorted, from),
      localIndexInCategory(sorted, to)
    );
  }

  return (
    <nav
      className="flex items-center md:hidden flex-shrink-0 w-full"
      style={{
        height: 60,
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        paddingBottom: "env(safe-area-inset-bottom)",
        overflowX: "auto",
      }}
    >
      <div className="flex items-center gap-1 px-2 min-w-0 flex-1">
        {sorted.map((board, index) => {
          const isActive = board.id === activeBoardId;
          const isDragOver = dragOverIndex === index || touchDragOver === index;
          return (
            <button
              key={board.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              draggable
              onDragStart={(e) => {
                dragIndexRef.current = index;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverIndex(index);
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndexRef.current;
                if (from !== null && from !== index) {
                  applyReorder(from, index);
                }
                dragIndexRef.current = null;
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                dragIndexRef.current = null;
                setDragOverIndex(null);
              }}
              onTouchStart={(e) => {
                touchStartXRef.current = e.touches[0].clientX;
                touchDragIndexRef.current = index;
                setTouchDragging(false);
              }}
              onTouchMove={(e) => {
                const dx = Math.abs(e.touches[0].clientX - touchStartXRef.current);
                if (dx > 8) {
                  setTouchDragging(true);
                  const over = getIndexFromTouchX(e.touches[0].clientX);
                  setTouchDragOver(over);
                }
              }}
              onTouchEnd={(e) => {
                if (touchDragging) {
                  const over = getIndexFromTouchX(e.changedTouches[0].clientX);
                  const from = touchDragIndexRef.current;
                  if (from !== null && over !== null && from !== over) {
                    applyReorder(from, over);
                  }
                  setTouchDragging(false);
                  setTouchDragOver(null);
                  touchDragIndexRef.current = null;
                } else {
                  onSelect(board.id);
                }
              }}
              onClick={() => {
                if (!touchDragging) onSelect(board.id);
              }}
              className="flex flex-col items-center justify-center rounded-lg px-3 flex-shrink-0"
              style={{
                minWidth: 64,
                height: 44,
                background: isActive ? "var(--primary-soft)" : "transparent",
                border: isDragOver
                  ? "2px solid var(--primary)"
                  : isActive
                    ? "1px solid var(--primary)"
                    : "1px solid transparent",
                cursor: touchDragging ? "grabbing" : "pointer",
                transition: "all 150ms",
                opacity: touchDragIndexRef.current === index && touchDragging ? 0.5 : 1,
              }}
              aria-label={board.name}
            >
              <span style={{ fontSize: 16 }}>{board.icon}</span>
              <span
                className="truncate max-w-[60px]"
                style={{
                  fontSize: 10,
                  color: isActive ? "var(--primary)" : "var(--text-secondary)",
                  lineHeight: 1.2,
                }}
              >
                {board.name}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onAdd(activeWorkspace)}
        className="flex items-center justify-center rounded-full flex-shrink-0 mx-2"
        style={{
          width: 44,
          height: 44,
          background: "var(--primary)",
          color: "var(--primary-fg)",
          border: "none",
          cursor: "pointer",
          fontSize: 22,
          fontWeight: "bold",
        }}
        aria-label="보드 추가"
        title="현재 탭 영역에 새 보드"
      >
        +
      </button>
    </nav>
  );
}
