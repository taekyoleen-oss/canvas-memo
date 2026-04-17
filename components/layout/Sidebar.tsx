"use client";

import { useState, useRef, useEffect } from "react";
import type { Board } from "@/types";
import { useCanvasStore } from "@/store/canvas";
import { useAuthStore } from "@/store/auth";
import ThemeToggle from "@/components/ui-overlays/ThemeToggle";

interface SidebarProps {
  boards: Board[];
  activeBoardId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

const GROUP_COLOR_DOT: Record<string, string> = {
  yellow: "#fbbf24", pink: "#ec4899", teal: "#14b8a6",
  blue: "#6366f1", purple: "#a855f7", orange: "#f97316",
};

export default function Sidebar({
  boards,
  activeBoardId,
  onSelect,
  onAdd,
}: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const updateBoard = useCanvasStore((s) => s.updateBoard);
  const removeBoard = useCanvasStore((s) => s.removeBoard);
  const reorderBoards = useCanvasStore((s) => s.reorderBoards);
  const setFocusGroup = useCanvasStore((s) => s.setFocusGroup);
  const updateGroup = useCanvasStore((s) => s.updateGroup);
  const { user, signOut } = useAuthStore();

  function startEdit(board: Board, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(board.id);
    setEditValue(board.name);
    setEditIcon(board.icon);
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      updateBoard(editingId, {
        name: editValue.trim(),
        icon: editIcon.trim() || "📋",
      });
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
        {boards.map((board, index) => {
          const isActive = board.id === activeBoardId;
          const isDragOver = dragOverIndex === index;
          const groups = board.groups ?? [];
          return (
            <div
              key={board.id}
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
                  reorderBoards(from, index);
                }
                dragIndexRef.current = null;
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                dragIndexRef.current = null;
                setDragOverIndex(null);
              }}
              style={{
                borderTop: isDragOver ? "2px solid var(--primary)" : "2px solid transparent",
                transition: "border-top 100ms",
              }}
            >
              {/* 보드 아이템 */}
              <div
                className="group relative flex items-center rounded-lg"
                style={{
                  minHeight: 44,
                  background: isActive ? "var(--primary-soft)" : "transparent",
                  border: isActive
                    ? "1px solid var(--primary)"
                    : "1px solid transparent",
                  cursor: "grab",
                  transition: "background 150ms",
                  padding: isExpanded ? "0 8px" : "0",
                  justifyContent: isExpanded ? "flex-start" : "center",
                }}
                onClick={() => onSelect(board.id)}
              >
                {/* 드래그 핸들 (expanded 시) */}
                {isExpanded && (
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginRight: 2,
                      flexShrink: 0,
                      cursor: "grab",
                      userSelect: "none",
                    }}
                    title="드래그하여 순서 변경"
                  >
                    ⠿
                  </span>
                )}

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
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {/* 아이콘 편집 */}
                        <input
                          type="text"
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditingId(null);
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          maxLength={2}
                          style={{
                            width: 32,
                            height: 28,
                            fontSize: 16,
                            textAlign: "center",
                            background: "var(--surface-hover)",
                            border: "1px solid var(--primary)",
                            borderRadius: 6,
                            color: "var(--text-primary)",
                            outline: "none",
                            flexShrink: 0,
                          }}
                        />
                        {/* 이름 편집 */}
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
                      </div>
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

              {/* 그룹 서브카테고리 (active 보드 + expanded 사이드바) */}
              {isActive && isExpanded && groups.length > 0 && (
                <div style={{ paddingLeft: 12, marginTop: 2, marginBottom: 2 }}>
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-1.5 rounded-md"
                      style={{
                        minHeight: 32,
                        padding: "0 8px",
                        cursor: "pointer",
                        transition: "background 120ms",
                        color: "var(--text-secondary)",
                        fontSize: 13,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusGroup(g.id);
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--surface-hover)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                      title={`${g.name} — 클릭하면 캔버스에서 이 그룹으로 이동`}
                    >
                      {/* 색상 점 */}
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: GROUP_COLOR_DOT[g.color] ?? "#94a3b8",
                          flexShrink: 0,
                        }}
                      />
                      {/* 폴더 아이콘 */}
                      <span style={{ fontSize: 13, flexShrink: 0 }}>
                        {g.isCollapsed ? "📁" : "📂"}
                      </span>
                      {/* 이름 */}
                      <span
                        className="flex-1 truncate"
                        style={{ fontWeight: 500 }}
                      >
                        {g.name}
                      </span>
                      {/* 접기/펼치기 토글 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateGroup(board.id, g.id, { isCollapsed: !g.isCollapsed });
                          if (g.isCollapsed) setFocusGroup(g.id);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 10,
                          color: "var(--text-muted)",
                          padding: "2px 4px",
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                        title={g.isCollapsed ? "펼치기" : "폴더로 접기"}
                      >
                        {g.isCollapsed ? "▶" : "▾"}
                      </button>
                    </div>
                  ))}
                </div>
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

      {/* 하단: 유저 + 테마 토글 */}
      <div
        className="flex flex-col flex-shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* 유저 섹션 */}
        {user ? (
          <div
            className="flex items-center"
            style={{
              padding: isExpanded ? "10px 12px" : "10px 0",
              justifyContent: isExpanded ? "space-between" : "center",
              gap: 8,
            }}
          >
            <div
              className="flex items-center gap-2 overflow-hidden"
              style={{ minWidth: 0, flex: 1 }}
            >
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 30,
                  height: 30,
                  background: "var(--primary-soft)",
                  fontSize: 14,
                }}
              >
                👤
              </div>
              {isExpanded && (
                <span
                  className="truncate"
                  style={{ fontSize: 12, color: "var(--text-secondary)" }}
                >
                  {user.email}
                </span>
              )}
            </div>
            {isExpanded && (
              <button
                onClick={signOut}
                className="flex-shrink-0 rounded"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  padding: "4px 6px",
                }}
                title="로그아웃"
              >
                로그아웃
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: isExpanded ? "10px 12px" : "10px 0",
              display: "flex",
              justifyContent: isExpanded ? "flex-start" : "center",
            }}
          >
            <a
              href="/auth/login"
              className="flex items-center gap-2 rounded-lg"
              style={{
                height: 36,
                padding: isExpanded ? "0 12px" : "0 8px",
                background: "var(--primary-soft)",
                border: "1px solid var(--primary)",
                color: "var(--primary)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <span>🔑</span>
              {isExpanded && <span>로그인</span>}
            </a>
          </div>
        )}

        {/* 테마 토글 */}
        <div
          className="flex items-center"
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
      </div>
    </aside>
  );
}
