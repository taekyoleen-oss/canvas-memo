"use client";

import type { ModuleColor } from "@/types";

interface ColorPaletteProps {
  current: ModuleColor;
  onSelect: (color: ModuleColor) => void;
}

const COLORS: { key: ModuleColor; label: string; bg: string }[] = [
  { key: "default", label: "기본", bg: "var(--module-default)" },
  { key: "yellow", label: "노랑", bg: "var(--module-yellow)" },
  { key: "pink", label: "분홍", bg: "var(--module-pink)" },
  { key: "blue", label: "파랑", bg: "var(--module-blue)" },
  { key: "green", label: "초록", bg: "var(--module-green)" },
  { key: "purple", label: "보라", bg: "var(--module-purple)" },
  { key: "orange", label: "주황", bg: "var(--module-orange)" },
  { key: "teal", label: "청록", bg: "var(--module-teal)" },
];

export default function ColorPalette({ current, onSelect }: ColorPaletteProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap p-2">
      {COLORS.map((color) => {
        const isActive = current === color.key;
        return (
          <button
            key={color.key}
            onClick={() => onSelect(color.key)}
            aria-label={color.label}
            title={color.label}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              background: color.bg,
              border: isActive
                ? "3px solid var(--primary)"
                : "2px solid var(--border-strong)",
              cursor: "pointer",
              transition: "transform 100ms",
              transform: isActive ? "scale(1.15)" : "scale(1)",
            }}
          >
            {isActive && (
              <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
