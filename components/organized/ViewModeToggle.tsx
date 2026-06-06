"use client";

import type { OrganizedViewMode } from "@/types";

interface ViewModeToggleProps {
  mode: OrganizedViewMode;
  onChange: (mode: OrganizedViewMode) => void;
}

const SEGMENTS: { id: OrganizedViewMode; label: string; icon: string }[] = [
  { id: "canvas", label: "캔버스", icon: "🗺" },
  { id: "organized", label: "정리", icon: "▦" },
];

/** [캔버스][정리] 세그먼트 토글. 보드별 모드는 호출부가 관리. */
export default function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div
      className="flex flex-shrink-0 items-center rounded-lg p-0.5"
      style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}
      role="tablist"
      aria-label="보기 모드"
    >
      {SEGMENTS.map((seg) => {
        const active = mode === seg.id;
        return (
          <button
            key={seg.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(seg.id)}
            className="flex items-center gap-1 rounded-md px-2.5 font-medium"
            style={{
              height: 30,
              minWidth: 44,
              justifyContent: "center",
              background: active ? "var(--surface-elevated)" : "transparent",
              color: active ? "var(--primary)" : "var(--text-secondary)",
              boxShadow: active ? "var(--shadow-sm)" : "none",
              border: active ? "1px solid var(--border)" : "1px solid transparent",
              cursor: "pointer",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
            title={`${seg.label} 보기`}
          >
            <span style={{ fontSize: 13 }} aria-hidden>
              {seg.icon}
            </span>
            <span className="hidden sm:inline">{seg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
