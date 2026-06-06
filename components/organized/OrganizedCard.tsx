"use client";

import type { Module } from "@/types";
import OrganizedPreview, {
  MODULE_TYPE_ICON,
  cardTitle,
  moduleTypeLabel,
} from "./organizedPreview";

interface OrganizedCardProps {
  module: Module;
  onOpen: (module: Module) => void;
}

/**
 * 단일 모듈 읽기 카드(정적). 드래그·앵커·리사이즈 없음.
 * 클릭 → 편집 오버레이.
 */
export default function OrganizedCard({ module, onOpen }: OrganizedCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(module)}
      className="flex w-full flex-col gap-2 rounded-xl p-3 text-left transition-shadow"
      style={{
        minHeight: 44,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
      }}
      aria-label={`${moduleTypeLabel(module.type)} · ${cardTitle(module)} 열기`}
    >
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden>
          {MODULE_TYPE_ICON[module.type]}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {cardTitle(module)}
        </span>
      </div>
      <OrganizedPreview module={module} />
    </button>
  );
}
