"use client";

import type { ModuleType } from "@/types";

interface ModuleToolbarProps {
  onAdd: (type: ModuleType) => void;
}

const MODULE_OPTIONS: { type: ModuleType; icon: string; label: string }[] = [
  { type: "memo",     icon: "📝", label: "메모" },
  { type: "schedule", icon: "✅", label: "일정" },
  { type: "image",    icon: "🖼", label: "이미지" },
  { type: "link",     icon: "🔗", label: "링크" },
  { type: "file",     icon: "📎", label: "파일" },
];

export default function ModuleToolbar({ onAdd }: ModuleToolbarProps) {
  return (
    <div
      className="flex items-center gap-2 px-4"
      style={{
        height: 48,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <span
        className="text-xs font-medium mr-1"
        style={{ color: "var(--text-muted)" }}
      >
        추가
      </span>
      {MODULE_OPTIONS.map((option) => (
        <button
          key={option.type}
          onClick={() => onAdd(option.type)}
          className="flex items-center gap-1.5 rounded-lg px-3"
          style={{
            height: 34,
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            fontSize: 13,
            color: "var(--text-primary)",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
          title={`${option.label} 추가`}
        >
          <span style={{ fontSize: 15 }}>{option.icon}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
}
