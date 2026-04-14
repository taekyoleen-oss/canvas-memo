"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface ZoomControlsProps {
  viewport: Viewport;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onAutoLayout: () => void;
  isConnecting: boolean;
  isGroupMode?: boolean;
  onGroupMode?: () => void;
}

export default function ZoomControls({
  viewport,
  onZoomIn,
  onZoomOut,
  onFit,
  onAutoLayout,
  isConnecting,
  isGroupMode,
  onGroupMode,
}: ZoomControlsProps) {
  const zoomPercent = Math.round(viewport.zoom * 100);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === "dark";

  const btnStyle: React.CSSProperties = {
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    color: "var(--text-primary)",
    fontSize: 15,
    flexShrink: 0,
    transition: "background 0.12s",
  };

  return (
    <div
      data-zoom-controls="true"
      style={{
        position: "absolute",
        bottom: 20,
        left: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        zIndex: 80,   // 라소 오버레이(60)보다 높게 → 어떤 모드에서도 항상 위에 표시
      }}
    >
      {/* 연결 모드 힌트 배너 */}
      {isConnecting && (
        <div
          style={{
            background: "var(--primary)",
            color: "var(--primary-fg)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            boxShadow: "var(--shadow-md)",
            whiteSpace: "nowrap",
            animation: "connectPulse 1.4s ease-in-out infinite",
          }}
        >
          🔗 연결 모드 — 대상 모듈을 클릭하세요 &nbsp;·&nbsp; ESC 취소
        </div>
      )}

      {/* 툴바 패널 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "3px 6px",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <button onClick={onZoomOut} style={btnStyle} aria-label="축소" title="축소">
          −
        </button>

        <button
          onClick={onFit}
          style={{
            ...btnStyle,
            width: "auto",
            paddingInline: 8,
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            minWidth: 46,
          }}
          aria-label="전체 보기"
          title="전체 보기"
        >
          {zoomPercent}%
        </button>

        <button onClick={onZoomIn} style={btnStyle} aria-label="확대" title="확대">
          +
        </button>

        <div
          style={{
            width: 1,
            height: 18,
            background: "var(--border)",
            marginInline: 3,
          }}
        />

        {/* Auto Layout */}
        <button
          onClick={onAutoLayout}
          style={{ ...btnStyle, fontSize: 16 }}
          aria-label="자동 정렬"
          title="자동 정렬 (Auto Layout)"
        >
          ⊞
        </button>

        {/* 그룹 만들기 — 항상 렌더링하여 레이아웃 안정 */}
        <button
          onClick={onGroupMode}
          style={{
            ...btnStyle,
            fontSize: 14,
            background: isGroupMode ? "var(--primary-soft)" : "transparent",
            color: isGroupMode ? "var(--primary)" : "var(--text-primary)",
            border: isGroupMode ? "1px solid var(--primary)" : "none",
            borderRadius: 6,
          }}
          aria-label="그룹 만들기"
          title="그룹 만들기 — 드래그로 여러 모듈을 묶습니다"
        >
          📦
        </button>

        <div
          style={{
            width: 1,
            height: 18,
            background: "var(--border)",
            marginInline: 3,
          }}
        />

        {/* 테마 토글 — 항상 자리 확보하여 레이아웃 흔들림 방지 */}
        <button
          onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
          style={{ ...btnStyle, fontSize: 15, opacity: mounted ? 1 : 0, pointerEvents: mounted ? "auto" : "none" }}
          aria-label={isDark ? "라이트 모드" : "다크 모드"}
          title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </div>

      <style>{`
        @keyframes connectPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(0.99); }
        }
      `}</style>
    </div>
  );
}
