"use client";

import { useState, useRef, useEffect } from "react";
import type { Board } from "@/types";
import { useCanvasStore } from "@/store/canvas";
import ThemeToggle from "@/components/ui-overlays/ThemeToggle";

interface SidebarProps {
  boards: Board[];
  activeBoardId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export default function Sidebar({
  boards,
  activeBoardId,
  onSelect,
  onAdd,
}: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const updateBoard = useCanvasStore((s) => s.updateBoard);
  const removeBoard = useCanvasStore((s) => s.removeBoard);

  function startEdit(board: Board, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(board.id);
    setEditValue(board.name);
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      updateBoard(editingId, { name: editValue.trim() });
    }
    setEditingId(null);
  }

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const sidebarWidth = isExpanded ? 240 : 64;

  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0"
      style={{
        width: sidebarWidth,
        height: "100vh",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        transition: "width 200ms ease-in-out",
        overflow: "hidden",
      }}
    >
      {/* 헤더 — 로고 + 토글 버튼 */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          height: 56,
          borderBottom: "1px solid var(--border)",
          padding: isExpanded ? "0 12px" : "0",
          justifyContent: isExpanded ? "space-between" : "center",
        }}
      >
        {isExpanded && (
          <div className="flex items-center gap-2 overflow-hidden">
            <span style={{ fontSize: 22, flexShrink: 0 }}>🧠</span>
            <span
              className="font-bold truncate"
              style={{ fontSize: 15, color: "var(--text-primary)" }}
            >
              MindCanvas
            </span>
          </div>
        )}
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            background: "transparent",
            border: "1px solid var(--border)",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
          title={isExpanded ? "사이드바 접기" : "사이드바 펼치기"}
        >
          {isExpanded ? "◀" : "▶"}
        </button>
      </div>

      {/* 보드 목록 */}
      <div
        className="flex flex-col gap-0.5 flex-1 overflow-y-auto"
        style={{ padding: "8px" }}
      >
        {boards.map((board) => {
          const isActive = board.id === activeBoardId;
          return (
            <div
              key={board.id}
              className="group relative flex items-center rounded-lg"
              style={{
                minHeight: 44,
                background: isActive ? "var(--primary-soft)" : "transparent",
                border: isActive
                  ? "1px solid var(--primary)"
                  : "1px solid transparent",
                cursor: "pointer",
                transition: "background 150ms",
                padding: isExpanded ? "0 8px" : "0",
                justifyContent: isExpanded ? "flex-start" : "center",
              }}
              onClick={() => onSelect(board.id)}
            >
              {/* 이모지 */}
              <span
                style={{
                  fontSize: 20,
                  flexShrink: 0,
                  width: 32,
                  textAlign: "center",
                }}
              >
                {board.icon}
              </span>

              {/* 이름 + 편집/삭제 (expanded 시) */}
              {isExpanded && (
                <>
                  {editingId === board.id ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded px-1"
                      style={{
                        fontSize: 14,
                        background: "var(--surface-hover)",
                        border: "1px solid var(--primary)",
                        color: "var(--text-primary)",
                        outline: "none",
                        height: 28,
                        minWidth: 0,
                      }}
                    />
                  ) : (
                    <span
                      className="flex-1 truncate"
                      style={{
                        fontSize: 14,
                        color: isActive ? "var(--primary)" : "var(--text-primary)",
                        fontWeight: isActive ? 600 : 400,
                        paddingLeft: 6,
                      }}
                    >
                      {board.name}
                    </span>
                  )}

                  {/* 편집/삭제 버튼 (hover 시 표시) */}
                  {editingId !== board.id && (
                    <div
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 ml-1"
                      style={{ transition: "opacity 150ms" }}
                    >
                      <button
                        onClick={(e) => startEdit(board, e)}
                        className="flex items-center justify-center rounded"
                        style={{
                          width: 28,
                          height: 28,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                        title="이름 수정"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${board.name}" 보드를 삭제할까요?`)) {
                            removeBoard(board.id);
                          }
                        }}
                        className="flex items-center justify-center rounded"
                        style={{
                          width: 28,
                          height: 28,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                        title="보드 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* 새 보드 추가 버튼 */}
        <button
          onClick={onAdd}
          className="flex items-center rounded-lg"
          style={{
            minHeight: 44,
            padding: isExpanded ? "0 8px" : "0",
            justifyContent: isExpanded ? "flex-start" : "center",
            background: "transparent",
            border: "1px dashed var(--border-strong)",
            cursor: "pointer",
            color: "var(--text-muted)",
            transition: "all 150ms",
            gap: 8,
            marginTop: 4,
          }}
          title="새 보드 추가"
        >
          <span
            style={{ fontSize: 20, width: 32, textAlign: "center", flexShrink: 0 }}
          >
            +
          </span>
          {isExpanded && (
            <span style={{ fontSize: 14 }}>새 보드</span>
          )}
        </button>
      </div>

      {/* 하단 테마 토글 */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          borderTop: "1px solid var(--border)",
          padding: isExpanded ? "12px 16px" : "12px 0",
          justifyContent: isExpanded ? "flex-start" : "center",
          gap: 8,
        }}
      >
        <ThemeToggle />
        {isExpanded && (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            테마 전환
          </span>
        )}
      </div>
    </aside>
  );
}
