"use client";

import type { Module } from "@/types";
import OrganizedPreview, {
  MODULE_TYPE_ICON,
  cardTitle,
  moduleTypeLabel,
} from "./organizedPreview";
import OrganizedModuleMenu from "./OrganizedModuleMenu";

interface OrganizedCardProps {
  boardId: string;
  module: Module;
  onOpen: (module: Module) => void;
}

/**
 * 단일 모듈 읽기 카드(정적). 드래그·앵커·리사이즈 없음.
 * 카드 본문 클릭 → 편집 오버레이. 우상단 ⋮ → 캔버스와 동일한 모듈 액션.
 */
export default function OrganizedCard({
  boardId,
  module,
  onOpen,
}: OrganizedCardProps) {
  return (
    <div
      className="relative flex w-full flex-col rounded-xl transition-shadow"
      style={{
        minHeight: 44,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(module)}
        className="flex w-full flex-col gap-2 p-3 text-left"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
        aria-label={`${moduleTypeLabel(module.type)} · ${cardTitle(module)} 열기`}
      >
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden>
            {MODULE_TYPE_ICON[module.type]}
          </span>
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold"
            style={{ color: "var(--text-primary)", paddingRight: 32 }}
          >
            {cardTitle(module)}
          </span>
        </div>
        {/* 제목만 보기(isMinimized)면 미리보기 숨김 — 캔버스 파리티 */}
        {module.isMinimized ? null : <OrganizedPreview module={module} />}
      </button>

      {/* 우상단 ⋮ — 카드 열기와 충돌 방지(stopPropagation은 메뉴 내부 처리) */}
      <div className="absolute right-1 top-1">
        <OrganizedModuleMenu boardId={boardId} moduleId={module.id} />
      </div>
    </div>
  );
}
