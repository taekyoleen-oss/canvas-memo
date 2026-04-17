"use client";

import { useState, useEffect } from "react";
import { useRichTextStore } from "@/store/richText";

// ── 색상 팔레트 ─────────────────────────────────────────────────────────────
const TEXT_COLORS = [
  "#000000", "#374151", "#6B7280", "#9CA3AF",
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#06B6D4", "#6366F1", "#A855F7", "#EC4899",
  "#1D4ED8", "#0F766E", "#7C3AED", "#BE185D",
];

const HIGHLIGHT_COLORS = [
  "transparent",
  "#FEF9C3", "#FEE2E2", "#DCFCE7", "#DBEAFE",
  "#EDE9FE", "#FCE7F3", "#F3F4F6", "#FDE68A",
  "#FCA5A5", "#86EFAC", "#93C5FD", "#C4B5FD",
  "#F9A8D4", "#A7F3D0", "#BAE6FD",
];

// execCommand 래퍼 — styleWithCSS 활성 후 명령 실행, 이후 input 이벤트로 React 상태 동기화
function applyCommand(command: string, value?: string) {
  try {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value ?? "");
  } catch {}
  // 현재 포커스된 contentEditable에 input 이벤트를 발생시켜 React onInput 핸들러를 트리거
  const el = document.activeElement as HTMLElement | null;
  if (el?.getAttribute("contenteditable") === "true") {
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}

// ── 폰트 크기 정의 ───────────────────────────────────────────────────────────
const FONT_SIZES: { label: string; value: string; display: number }[] = [
  { label: "소",   value: "1", display: 9  },
  { label: "소+",  value: "2", display: 11 },
  { label: "기본", value: "3", display: 13 },
  { label: "중",   value: "4", display: 16 },
  { label: "대",   value: "5", display: 20 },
  { label: "특대", value: "6", display: 26 },
  { label: "초대", value: "7", display: 32 },
];

// ── 색상 팝오버 ──────────────────────────────────────────────────────────────
function ColorPopover({
  colors,
  selected,
  onSelect,
  onClose,
}: {
  colors: string[];
  selected: string;
  onSelect: (c: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 36,
        left: 0,
        zIndex: 300,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 8,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 4,
        boxShadow: "var(--shadow-lg)",
        minWidth: 116,
      }}
    >
      {colors.map((color) => (
        <button
          key={color}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(color);
            onClose();
          }}
          title={color === "transparent" ? "색상 없음" : color}
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: color === "transparent" ? "var(--surface)" : color,
            border: color === selected
              ? "2.5px solid var(--primary)"
              : "1px solid var(--border)",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {color === "transparent" && (
            <svg viewBox="0 0 22 22" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              <line x1="2" y1="2" x2="20" y2="20" stroke="#EF4444" strokeWidth="2" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

// ── 구분선 ────────────────────────────────────────────────────────────────────
function Sep() {
  return <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0, margin: "0 2px" }} />;
}

// ── 메인 툴바 ─────────────────────────────────────────────────────────────────
export default function RichTextToolbar() {
  const isActive = useRichTextStore((s) => s.isEditorFocused);

  const [isBold, setIsBold]           = useState(false);
  const [isItalic, setIsItalic]       = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike]       = useState(false);

  const [textColor, setTextColor]           = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("transparent");

  const [showTextColors, setShowTextColors]           = useState(false);
  const [showHighlightColors, setShowHighlightColors] = useState(false);

  // 선택 변경 시 현재 서식 상태 업데이트
  useEffect(() => {
    function sync() {
      try {
        setIsBold(document.queryCommandState("bold"));
        setIsItalic(document.queryCommandState("italic"));
        setIsUnderline(document.queryCommandState("underline"));
        setIsStrike(document.queryCommandState("strikeThrough"));
      } catch {}
    }
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, []);

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    if (!showTextColors && !showHighlightColors) return;
    function close() {
      setShowTextColors(false);
      setShowHighlightColors(false);
    }
    const t = setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
    return () => clearTimeout(t);
  }, [showTextColors, showHighlightColors]);

  // ── 버튼 스타일 ─────────────────────────────────────────────────────────
  function btnCss(active: boolean, extraStyle?: React.CSSProperties): React.CSSProperties {
    return {
      height: 28,
      minWidth: 28,
      padding: "0 5px",
      borderRadius: 5,
      border: active ? "1.5px solid var(--primary)" : "1px solid transparent",
      background: active ? "var(--primary-soft)" : "transparent",
      cursor: isActive ? "pointer" : "default",
      color: active ? "var(--primary)" : isActive ? "var(--text-primary)" : "var(--text-muted)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      opacity: isActive ? 1 : 0.45,
      transition: "all 0.1s",
      ...extraStyle,
    };
  }

  return (
    <div
      data-no-pan="true"
      style={{
        height: 40,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 1,
        padding: "0 10px",
        flexShrink: 0,
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
      }}
    >
      {/* ── 굵게 ── */}
      <button
        onMouseDown={(e) => { e.preventDefault(); applyCommand("bold"); }}
        style={{ ...btnCss(isBold), fontWeight: 800, fontSize: 13 }}
        title="굵게 (Ctrl+B)"
      >B</button>

      {/* ── 기울임 ── */}
      <button
        onMouseDown={(e) => { e.preventDefault(); applyCommand("italic"); }}
        style={{ ...btnCss(isItalic), fontStyle: "italic", fontSize: 13 }}
        title="기울임 (Ctrl+I)"
      >I</button>

      {/* ── 밑줄 ── */}
      <button
        onMouseDown={(e) => { e.preventDefault(); applyCommand("underline"); }}
        style={{ ...btnCss(isUnderline), textDecoration: "underline", fontSize: 13 }}
        title="밑줄 (Ctrl+U)"
      >U</button>

      {/* ── 취소선 ── */}
      <button
        onMouseDown={(e) => { e.preventDefault(); applyCommand("strikeThrough"); }}
        style={{ ...btnCss(isStrike), textDecoration: "line-through", fontSize: 13 }}
        title="취소선"
      >S</button>

      <Sep />

      {/* ── 폰트 크기 ── */}
      {FONT_SIZES.map((fs) => (
        <button
          key={fs.value}
          onMouseDown={(e) => { e.preventDefault(); applyCommand("fontSize", fs.value); }}
          style={{ ...btnCss(false), fontSize: fs.display, lineHeight: 1, padding: "0 4px", minWidth: 20 }}
          title={`글자 크기: ${fs.label}`}
        >
          <span style={{ fontSize: fs.display * 0.55 + 6, pointerEvents: "none" }}>{fs.label}</span>
        </button>
      ))}

      <Sep />

      {/* ── 글자 색상 ── */}
      <div style={{ position: "relative" }}>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            if (!isActive) return;
            setShowHighlightColors(false);
            setShowTextColors((v) => !v);
          }}
          style={btnCss(showTextColors)}
          title="글자 색상"
        >
          <span style={{ fontSize: 13, fontWeight: 800, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, lineHeight: 1 }}>
            <span style={{ pointerEvents: "none" }}>A</span>
            <span style={{ width: 14, height: 3, background: textColor, borderRadius: 1, pointerEvents: "none" }} />
          </span>
        </button>
        {showTextColors && (
          <ColorPopover
            colors={TEXT_COLORS}
            selected={textColor}
            onSelect={(color) => {
              setTextColor(color);
              applyCommand("foreColor", color);
            }}
            onClose={() => setShowTextColors(false)}
          />
        )}
      </div>

      {/* ── 배경(하이라이트) 색상 ── */}
      <div style={{ position: "relative" }}>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            if (!isActive) return;
            setShowTextColors(false);
            setShowHighlightColors((v) => !v);
          }}
          style={btnCss(showHighlightColors)}
          title="배경 색상"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ pointerEvents: "none" }}>
            <path d="M2 11L6 2L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3.5" y1="8" x2="9.5" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <rect x="1" y="11.5" width="12" height="2" rx="1" fill={highlightColor === "transparent" ? "var(--border)" : highlightColor} />
          </svg>
        </button>
        {showHighlightColors && (
          <ColorPopover
            colors={HIGHLIGHT_COLORS}
            selected={highlightColor}
            onSelect={(color) => {
              setHighlightColor(color);
              if (color === "transparent") {
                // 배경색 제거
                try {
                  document.execCommand("styleWithCSS", false, "true");
                  document.execCommand("hiliteColor", false, "transparent");
                  document.execCommand("backColor", false, "transparent");
                  const el = document.activeElement as HTMLElement | null;
                  if (el?.getAttribute("contenteditable") === "true") {
                    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
                  }
                } catch {}
              } else {
                applyCommand("hiliteColor", color);
              }
            }}
            onClose={() => setShowHighlightColors(false)}
          />
        )}
      </div>

      <Sep />

      {/* ── 서식 초기화 ── */}
      <button
        onMouseDown={(e) => { e.preventDefault(); applyCommand("removeFormat"); }}
        style={btnCss(false)}
        title="서식 초기화"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ pointerEvents: "none" }}>
          <path d="M1.5 11.5L11.5 1.5M1.5 1.5L11.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M4 6.5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* ── 비활성 힌트 ── */}
      {!isActive && (
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, whiteSpace: "nowrap", flexShrink: 0 }}>
          메모 편집 시 활성화
        </span>
      )}
    </div>
  );
}
