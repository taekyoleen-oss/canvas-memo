"use client";

import ThemeToggle from "@/components/ui-overlays/ThemeToggle";
import { useAuthStore } from "@/store/auth";

interface TopHeaderProps {
  boardName: string;
  onAddModule: () => void;
}

export default function TopHeader({ boardName, onAddModule }: TopHeaderProps) {
  const { user, signOut } = useAuthStore();
  return (
    <header
      className="flex items-center justify-between px-4 md:hidden"
      style={{
        height: 56,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {/* 좌측 */}
      <div className="flex items-center gap-2">
        <button
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 44,
            height: 44,
            color: "var(--text-primary)",
            fontSize: 20,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="메뉴 열기"
        >
          ≡
        </button>
        <span
          className="font-semibold truncate max-w-[160px]"
          style={{ color: "var(--text-primary)", fontSize: 16 }}
        >
          {boardName}
        </span>
      </div>

      {/* 우측 */}
      <div className="flex items-center gap-1">
        <ThemeToggle />
        {user ? (
          <button
            onClick={signOut}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 44,
              height: 44,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
            }}
            title={`로그아웃 (${user.email})`}
            aria-label="로그아웃"
          >
            👤
          </button>
        ) : (
          <a
            href="/auth/login"
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 44,
              height: 44,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              textDecoration: "none",
            }}
            aria-label="로그인"
          >
            🔑
          </a>
        )}
        <button
          onClick={onAddModule}
          className="flex items-center justify-center rounded-lg font-bold"
          style={{
            width: 44,
            height: 44,
            background: "var(--primary)",
            color: "var(--primary-fg)",
            border: "none",
            cursor: "pointer",
            fontSize: 22,
          }}
          aria-label="모듈 추가"
        >
          +
        </button>
      </div>
    </header>
  );
}
