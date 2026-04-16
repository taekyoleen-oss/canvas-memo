"use client";

import { useEffect } from "react";
import type { Board } from "@/types";
import { useCanvasStore } from "@/store/canvas";
import { useAuthStore } from "@/store/auth";
import ThemeToggle from "@/components/ui-overlays/ThemeToggle";

const GROUP_COLOR_DOT: Record<string, string> = {
  yellow: "#fbbf24", pink: "#ec4899", teal: "#14b8a6",
  blue: "#6366f1", purple: "#a855f7", orange: "#f97316",
};

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  boards: Board[];
  activeBoardId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export default function MobileDrawer({
  isOpen,
  onClose,
  boards,
  activeBoardId,
  onSelect,
  onAdd,
}: MobileDrawerProps) {
  const setFocusGroup = useCanvasStore((s) => s.setFocusGroup);
  const updateGroup = useCanvasStore((s) => s.updateGroup);
  const { user, signOut } = useAuthStore();

  // 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      {/* 백드롭 */}
      <div
        className="md:hidden fixed inset-0"
        style={{
          zIndex: 200,
          background: "rgba(0,0,0,0.45)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 220ms ease",
        }}
        onClick={onClose}
      />

      {/* 드로어 패널 */}
      <div
        className="md:hidden fixed top-0 left-0 h-full flex flex-col"
        style={{
          zIndex: 201,
          width: 280,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 220ms ease",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            height: 56,
            padding: "0 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 22 }}>🧠</span>
            <span
              className="font-bold"
              style={{ fontSize: 16, color: "var(--text-primary)" }}
            >
              MindCanvas
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 보드 목록 */}
        <div
          className="flex flex-col gap-0.5 flex-1 overflow-y-auto"
          style={{ padding: "8px" }}
        >
          {boards.map((board) => {
            const isActive = board.id === activeBoardId;
            const groups = board.groups ?? [];
            return (
              <div key={board.id}>
                <div
                  className="flex items-center rounded-lg"
                  style={{
                    minHeight: 48,
                    padding: "0 10px",
                    background: isActive ? "var(--primary-soft)" : "transparent",
                    border: isActive
                      ? "1px solid var(--primary)"
                      : "1px solid transparent",
                    cursor: "pointer",
                    transition: "background 150ms",
                  }}
                  onClick={() => { onSelect(board.id); onClose(); }}
                >
                  <span style={{ fontSize: 22, width: 32, textAlign: "center", flexShrink: 0 }}>
                    {board.icon}
                  </span>
                  <span
                    className="flex-1 truncate"
                    style={{
                      fontSize: 15,
                      paddingLeft: 8,
                      color: isActive ? "var(--primary)" : "var(--text-primary)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {board.name}
                  </span>
                </div>

                {/* 그룹 서브 아이템 */}
                {isActive && groups.length > 0 && (
                  <div style={{ paddingLeft: 14, marginTop: 2, marginBottom: 2 }}>
                    {groups.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center gap-2 rounded-md"
                        style={{
                          minHeight: 36,
                          padding: "0 10px",
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          fontSize: 13,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusGroup(g.id);
                          onClose();
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: GROUP_COLOR_DOT[g.color] ?? "#94a3b8",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 13, flexShrink: 0 }}>
                          {g.isCollapsed ? "📁" : "📂"}
                        </span>
                        <span className="flex-1 truncate" style={{ fontWeight: 500 }}>
                          {g.name}
                        </span>
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
                          }}
                          title={g.isCollapsed ? "펼치기" : "접기"}
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

          {/* 새 보드 추가 */}
          <button
            onClick={() => { onAdd(); onClose(); }}
            className="flex items-center rounded-lg"
            style={{
              minHeight: 48,
              padding: "0 10px",
              background: "transparent",
              border: "1px dashed var(--border-strong)",
              cursor: "pointer",
              color: "var(--text-muted)",
              gap: 8,
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 22, width: 32, textAlign: "center" }}>+</span>
            <span style={{ fontSize: 14 }}>새 보드</span>
          </button>
        </div>

        {/* 하단: 유저 + 테마 */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {user ? (
            <div
              className="flex items-center justify-between"
              style={{ padding: "10px 16px", gap: 8 }}
            >
              <div className="flex items-center gap-2 overflow-hidden" style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: 30, height: 30, background: "var(--primary-soft)", fontSize: 14 }}
                >
                  👤
                </div>
                <span
                  className="truncate"
                  style={{ fontSize: 12, color: "var(--text-secondary)" }}
                >
                  {user.email}
                </span>
              </div>
              <button
                onClick={signOut}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  padding: "4px 8px",
                  flexShrink: 0,
                }}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div style={{ padding: "10px 16px" }}>
              <a
                href="/auth/login"
                className="flex items-center gap-2 rounded-lg"
                style={{
                  height: 44,
                  padding: "0 16px",
                  background: "var(--primary-soft)",
                  border: "1px solid var(--primary)",
                  color: "var(--primary)",
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                <span>🔑</span>
                <span>로그인</span>
              </a>
            </div>
          )}

          <div
            className="flex items-center gap-2"
            style={{
              borderTop: "1px solid var(--border)",
              padding: "12px 16px",
            }}
          >
            <ThemeToggle />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>테마 전환</span>
          </div>
        </div>
      </div>
    </>
  );
}
