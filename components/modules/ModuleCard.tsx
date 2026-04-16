"use client";

import type { Module, ModuleColor } from "@/types";

interface ModuleCardProps {
  module: Module;
  isSelected?: boolean;
  isConnectingSource?: boolean;
  children: React.ReactNode;
  onContextMenu?: (rect: DOMRect) => void;
  onToggleExpand?: () => void;
  onToggleMinimize?: () => void;
  onTitleChange?: (title: string) => void;
  onFullView?: () => void;
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
  file: "📎",
};

export default function ModuleCard({
  module,
  isSelected,
  isConnectingSource,
  children,
  onContextMenu,
  onToggleExpand,
  onToggleMinimize,
  onTitleChange,
  onFullView,
}: ModuleCardProps) {
  const isMinimized = !!module.isMinimized;
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
          borderBottom: isMinimized ? "none" : "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15 }}>{MODULE_TYPE_ICON[module.type]}</span>
        {module.isExpanded && !isMinimized && onTitleChange ? (
          <input
            type="text"
            value={(module.data as { title?: string }).title ?? ""}
            onChange={(e) => onTitleChange(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="제목"
            className="flex-1 text-sm font-medium bg-transparent outline-none min-w-0"
            style={{
              color: "var(--text-primary)",
              border: "none",
              padding: 0,
            }}
          />
        ) : (
          <span
            className="flex-1 font-medium truncate text-sm"
            style={{ color: "var(--text-primary)", cursor: "default" }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              // 최소화 상태에서 더블클릭 → 복원 (조금 펼침)
              if (isMinimized) onToggleMinimize?.();
            }}
            title={isMinimized ? "더블클릭: 펼치기" : undefined}
          >
            {getModuleTitle(module)}
          </span>
        )}

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

      {/* 내용 + 하단 탭: 최소화 시 숨김 */}
      {!isMinimized && (
        <>
          {/* 내용 */}
          <div className="flex flex-col">{children}</div>

          {/* 펼치기/접기 + 전체 보기 탭 */}
          <div
            className="flex"
            style={{
              borderTop: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              className="flex items-center justify-center gap-1 flex-1"
              style={{
                height: 28,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: 11,
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--surface-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
              aria-label={module.isExpanded ? "접기" : "더보기"}
            >
              <span style={{ transition: "transform 0.2s", display: "inline-block", transform: module.isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              <span>{module.isExpanded ? "접기" : "더보기"}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onFullView?.();
              }}
              className="flex items-center justify-center gap-1"
              style={{
                height: 28,
                paddingInline: 10,
                background: "transparent",
                border: "none",
                borderLeft: "1px solid var(--border)",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: 11,
                transition: "background 0.12s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--surface-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
              aria-label="전체 보기"
            >
              ⛶ 전체 보기
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function getModuleTitle(module: Module): string {
  const data = module.data as { title?: string; url?: string };
  return data.title ?? data.url ?? "제목 없음";
}
