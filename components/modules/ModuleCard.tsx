"use client";

import type { Module, ModuleColor } from "@/types";

interface ModuleCardProps {
  module: Module;
  isSelected?: boolean;
  isConnectingSource?: boolean;
  children: React.ReactNode;
  onContextMenu?: (rect: DOMRect) => void;
  onToggleExpand?: () => void;
  onStartConnect?: () => void;
}

const COLOR_MAP: Record<ModuleColor, string> = {
  default: "var(--module-default)",
  yellow: "var(--module-yellow)",
  pink: "var(--module-pink)",
  blue: "var(--module-blue)",
  green: "var(--module-green)",
  purple: "var(--module-purple)",
  orange: "var(--module-orange)",
  teal: "var(--module-teal)",
};

const MODULE_TYPE_ICON: Record<Module["type"], string> = {
  memo: "📝",
  schedule: "✅",
  image: "🖼",
  link: "🔗",
};

export default function ModuleCard({
  module,
  isSelected,
  isConnectingSource,
  children,
  onContextMenu,
  onToggleExpand,
  onStartConnect,
}: ModuleCardProps) {
  const bgColor = COLOR_MAP[module.color] ?? "var(--module-default)";

  let borderStyle: string;
  let boxShadow: string;

  if (isConnectingSource) {
    borderStyle = "2px solid var(--accent)";
    boxShadow = "0 0 0 3px rgba(245,158,11,0.25), var(--shadow-md)";
  } else if (isSelected) {
    borderStyle = "2px solid var(--primary)";
    boxShadow = "0 0 0 3px var(--primary-soft), var(--shadow-md)";
  } else {
    borderStyle = "1px solid var(--border)";
    boxShadow = "var(--shadow-md)";
  }

  return (
    <div
      className="flex flex-col rounded-xl"
      style={{
        background: bgColor,
        border: borderStyle,
        boxShadow,
        borderRadius: 12,
        minWidth: 200,
        maxWidth: 320,
        overflow: "hidden",
        transition: "border 0.15s, box-shadow 0.15s",
      }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center gap-2 px-3"
        style={{
          height: 44,
          borderBottom: module.isExpanded ? "1px solid var(--border)" : "none",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15 }}>{MODULE_TYPE_ICON[module.type]}</span>
        <span
          className="flex-1 font-medium truncate text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          {getModuleTitle(module)}
        </span>

        {/* 연결 버튼 — 선택 시 표시 */}
        {isSelected && !isConnectingSource && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartConnect?.();
            }}
            className="flex items-center justify-center rounded"
            style={{
              width: 26,
              height: 26,
              background: "var(--primary-soft)",
              border: "1px solid var(--primary)",
              cursor: "pointer",
              color: "var(--primary)",
              fontSize: 12,
              flexShrink: 0,
              fontWeight: 700,
            }}
            aria-label="연결하기"
            title="다른 모듈과 연결 (Connect)"
          >
            ⟶
          </button>
        )}

        {/* 더보기/접기 토글 — 헤더 안 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          className="flex items-center justify-center rounded"
          style={{
            width: 26,
            height: 26,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: 13,
            flexShrink: 0,
            transition: "transform 0.2s",
            transform: module.isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-label={module.isExpanded ? "접기" : "더보기"}
          title={module.isExpanded ? "접기" : "더보기"}
        >
          ▾
        </button>

        {/* 메뉴 버튼 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onContextMenu?.(rect);
          }}
          className="flex items-center justify-center rounded"
          style={{
            width: 28,
            height: 28,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: 18,
            flexShrink: 0,
          }}
          aria-label="모듈 메뉴"
        >
          ⋮
        </button>
      </div>

      {/* 내용 */}
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function getModuleTitle(module: Module): string {
  const data = module.data as { title?: string; url?: string };
  return data.title ?? data.url ?? "제목 없음";
}
