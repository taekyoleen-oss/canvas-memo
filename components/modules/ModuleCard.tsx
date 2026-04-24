"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Module, ModuleColor, ModuleShape } from "@/types";

interface ModuleCardProps {
  module: Module;
  /** 생각정리 보드: 마름모·타원 등 복잡한 외곽 대신 네모/둥근 네모/원만 사용 */
  simpleExterior?: boolean;
  /** 헤더 왼쪽 아이콘(이모지) — 주제별 노트 등 */
  headerIconOverride?: string;
  /** 제목 입력 placeholder */
  titleInputPlaceholder?: string;
  /** 헤더 제목(또는 제목 입력) 바로 오른쪽 — 예: 이미지 모듈 붙여넣기 */
  headerTrailing?: ReactNode;
  isSelected?: boolean;
  isConnectingSource?: boolean;
  children: React.ReactNode;
  onContextMenu?: (rect: DOMRect) => void;
  onToggleExpand?: () => void;
  onToggleMinimize?: () => void;
  onTitleChange?: (title: string) => void;
  onFullView?: () => void;
  /** 전체 보기(모달)이 열린 경우 아이콘 호버 시「접기」로 닫을 때 */
  isFullViewOpen?: boolean;
  onCloseFullView?: () => void;
  contentAreaHeight?: number; // 수동 리사이즈 시 콘텐츠 영역 고정 높이
  /** 주제별 노트: 헤더에도 펼치기·전체보기(최소화 시에는 펼치기) */
  topicNoteHeaderActions?: boolean;
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
  table: "▦",
  brainstorm: "💡",
};

export default function ModuleCard({
  module,
  simpleExterior = false,
  headerIconOverride,
  titleInputPlaceholder,
  headerTrailing,
  isSelected,
  isConnectingSource,
  children,
  onContextMenu,
  onToggleExpand,
  onToggleMinimize,
  onTitleChange,
  onFullView,
  isFullViewOpen = false,
  onCloseFullView,
  contentAreaHeight,
  topicNoteHeaderActions = false,
}: ModuleCardProps) {
  const isMinimized = !!module.isMinimized;
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [headerIconHover, setHeaderIconHover] = useState(false);

  useEffect(() => {
    if (!module.isExpanded || isMinimized) setIsTitleEditing(false);
  }, [module.isExpanded, isMinimized]);
  const bgColor = COLOR_MAP[module.color] ?? "var(--module-default)";
  const rawShape: ModuleShape = module.shape ?? "rounded";
  const shape: ModuleShape = simpleExterior
    ? rawShape === "circle"
      ? "circle"
      : rawShape === "rectangle"
        ? "rectangle"
        : "rounded"
    : rawShape;

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

  const shellStyle: CSSProperties = {
    background: bgColor,
    border: borderStyle,
    boxShadow,
    minWidth: 180,
    overflow: "hidden",
    transition: "border 0.15s, box-shadow 0.15s",
  };
  switch (shape) {
    case "rectangle":
      shellStyle.borderRadius = 6;
      break;
    case "rounded":
      shellStyle.borderRadius = 12;
      break;
    case "ellipse":
      shellStyle.borderRadius = "38% / 28%";
      break;
    case "diamond":
      shellStyle.borderRadius = 0;
      shellStyle.clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
      break;
    case "pill":
      shellStyle.borderRadius = 9999;
      break;
    case "circle":
      shellStyle.borderRadius = simpleExterior ? 9999 : "50%";
      if (!simpleExterior) {
        shellStyle.clipPath = "circle(closest-side at 50% 50%)";
      }
      break;
    default:
      shellStyle.borderRadius = 12;
  }

  return (
    <div className="flex flex-col" style={shellStyle}>
      {/* 헤더 */}
      <div
        className="flex items-center gap-2 px-3"
        style={{
          height: 44,
          borderBottom: isMinimized ? "none" : "1px solid var(--border)",
          flexShrink: 0,
          cursor: "inherit",
        }}
      >
        <div
          className="flex min-w-0 flex-shrink-0 items-center gap-0.5"
          onMouseEnter={() => setHeaderIconHover(true)}
          onMouseLeave={() => setHeaderIconHover(false)}
        >
          {headerIconHover && (onFullView || onCloseFullView) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isFullViewOpen) onCloseFullView?.();
                else onFullView?.();
              }}
              className="shrink-0 rounded px-1.5 font-medium"
              style={{
                height: 24,
                fontSize: 10,
                lineHeight: 1,
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {isFullViewOpen ? "접기" : "전체보기"}
            </button>
          )}
          <span style={{ fontSize: 15 }} className="select-none">
            {headerIconOverride ?? MODULE_TYPE_ICON[module.type]}
          </span>
        </div>
        {module.isExpanded && !isMinimized && onTitleChange ? (
          isTitleEditing ? (
            <input
              type="text"
              data-module-header-title
              data-title-edit="true"
              value={(module.data as { title?: string }).title ?? ""}
              onChange={(e) => onTitleChange(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => setIsTitleEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              autoFocus
              placeholder={titleInputPlaceholder ?? "제목"}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
              style={{
                color: "var(--text-primary)",
                border: "none",
                padding: 0,
              }}
            />
          ) : (
            <span
              data-module-header-title
              className="min-w-0 flex-1 cursor-grab truncate text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsTitleEditing(true);
              }}
              title="더블클릭: 제목 편집"
            >
              {getModuleTitle(module)}
            </span>
          )
        ) : (
          <span
            data-module-header-title
            className="min-w-0 flex-1 cursor-grab truncate text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (isMinimized) onToggleMinimize?.();
            }}
            title={isMinimized ? "더블클릭: 펼치기" : undefined}
          >
            {getModuleTitle(module)}
          </span>
        )}

        {headerTrailing ? (
          <div className="flex min-w-0 flex-shrink-0 items-center">{headerTrailing}</div>
        ) : null}

        {topicNoteHeaderActions && module.type === "memo" && (
          <div className="flex flex-shrink-0 items-center gap-0.5">
            {isMinimized ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMinimize?.();
                }}
                className="rounded px-1.5 font-medium"
                style={{
                  height: 26,
                  fontSize: 11,
                  background: "var(--surface-hover)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                펼치기
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand?.();
                  }}
                  className="rounded px-1.5 font-medium"
                  style={{
                    height: 26,
                    fontSize: 10,
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  aria-label={module.isExpanded ? "접기" : "더보기"}
                >
                  {module.isExpanded ? "접기" : "펼치기"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFullView?.();
                  }}
                  className="rounded px-1.5 font-medium"
                  style={{
                    height: 26,
                    fontSize: 10,
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  aria-label="전체 보기"
                >
                  전체보기
                </button>
              </>
            )}
          </div>
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
          <div
            className="flex flex-col"
            style={contentAreaHeight != null ? { height: contentAreaHeight, overflowY: "auto" } : undefined}
          >
            {children}
          </div>

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
