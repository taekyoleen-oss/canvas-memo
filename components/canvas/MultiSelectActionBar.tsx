"use client";

import { useState } from "react";
import type { ModuleColor } from "@/types";
import ColorPalette from "@/components/ui-overlays/ColorPalette";

interface MultiSelectActionBarProps {
  count: number;
  /** 메모/이미지처럼 노트로 합칠 수 있는 모듈이 2개 이상일 때만 활성화 */
  canMergeToNote: boolean;
  onMergeToNote: () => void;
  onChangeColor: (color: ModuleColor) => void;
  onDelete: () => void;
  onClear: () => void;
}

export default function MultiSelectActionBar({
  count,
  canMergeToNote,
  onMergeToNote,
  onChangeColor,
  onDelete,
  onClear,
}: MultiSelectActionBarProps) {
  const [showPalette, setShowPalette] = useState(false);

  if (count < 2) return null;

  const btnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 12px",
    minHeight: 36,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--text-primary)",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 6,
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 85,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        pointerEvents: "auto",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {showPalette && (
        <div
          style={{
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 4,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <ColorPalette
            current="default"
            onSelect={(c) => {
              onChangeColor(c);
              setShowPalette(false);
            }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 4,
          boxShadow: "var(--shadow-lg)",
          maxWidth: "calc(100vw - 24px)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            padding: "0 8px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {count}개 선택
        </span>
        <div style={{ width: 1, height: 20, background: "var(--border)" }} />

        <button
          type="button"
          onClick={onMergeToNote}
          disabled={!canMergeToNote}
          style={{
            ...btnStyle,
            opacity: canMergeToNote ? 1 : 0.45,
            cursor: canMergeToNote ? "pointer" : "not-allowed",
            background: canMergeToNote ? "var(--primary-soft)" : "transparent",
            color: canMergeToNote ? "var(--primary)" : "var(--text-muted)",
          }}
          title={
            canMergeToNote
              ? "메모·이미지를 하나의 노트로 합치기 (원본 유지)"
              : "메모 또는 이미지 모듈을 2개 이상 선택해야 합니다"
          }
        >
          📝 노트로 합치기
        </button>

        <button
          type="button"
          onClick={() => setShowPalette((v) => !v)}
          style={{
            ...btnStyle,
            background: showPalette ? "var(--surface-hover)" : "transparent",
          }}
          title="선택한 모듈의 색상을 한 번에 변경"
        >
          🎨 색상
        </button>

        <button
          type="button"
          onClick={onDelete}
          style={{
            ...btnStyle,
            color: "#EF4444",
          }}
          title="선택한 모듈을 모두 삭제"
        >
          🗑 삭제
        </button>

        <div style={{ width: 1, height: 20, background: "var(--border)" }} />

        <button
          type="button"
          onClick={onClear}
          style={{
            ...btnStyle,
            color: "var(--text-muted)",
          }}
          aria-label="선택 해제"
          title="선택 해제"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
