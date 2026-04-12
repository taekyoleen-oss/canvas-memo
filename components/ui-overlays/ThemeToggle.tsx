"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="flex items-center justify-center"
        style={{ width: 44, height: 44 }}
        aria-label="테마 전환"
      >
        <span style={{ fontSize: 20 }}>🌙</span>
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center justify-center rounded-lg"
      style={{
        width: 44,
        height: 44,
        background: "var(--surface-hover)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        color: "var(--text-primary)",
      }}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      <span style={{ fontSize: 20 }}>{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}
