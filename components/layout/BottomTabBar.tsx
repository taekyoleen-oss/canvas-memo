"use client";

import { useRef, useState } from "react";
import type { Board } from "@/types";
import { useCanvasStore } from "@/store/canvas";

interface BottomTabBarProps {
  boards: Board[];
  activeBoardId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export default function BottomTabBar({
  boards,
  activeBoardId,
  onSelect,
  onAdd,
}: BottomTabBarProps) {
  const reorderBoards = useCanvasStore((s) => s.reorderBoards);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  // 터치 드래그용 상태
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
        {boards.map((board, index) => {
          const isActive = board.id === activeBoardId;
          const isDragOver = dragOverIndex === index || touchDragOver === index;
          return (
            <button
              key={board.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              // HTML5 drag (desktop fallback)
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
                if (from !== null && from !== index) reorderBoards(from, index);
                dragIndexRef.current = null;
                setDragOverIndex(null);
              }}
              onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
              // 터치 드래그
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
                    reorderBoards(from, over);
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

      {/* 보드 추가 버튼 */}
      <button
        onClick={onAdd}
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
      >
        +
      </button>
    </nav>
  );
}
