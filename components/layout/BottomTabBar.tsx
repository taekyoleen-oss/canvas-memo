"use client";

import type { Board } from "@/types";

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
        {boards.map((board) => {
          const isActive = board.id === activeBoardId;
          return (
            <button
              key={board.id}
              onClick={() => onSelect(board.id)}
              className="flex flex-col items-center justify-center rounded-lg px-3 flex-shrink-0"
              style={{
                minWidth: 64,
                height: 44,
                background: isActive ? "var(--primary-soft)" : "transparent",
                border: isActive
                  ? "1px solid var(--primary)"
                  : "1px solid transparent",
                cursor: "pointer",
                transition: "all 150ms",
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
