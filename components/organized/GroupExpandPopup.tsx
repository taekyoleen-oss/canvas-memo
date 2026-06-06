"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { DisplayEntry, Module } from "@/types";
import { useCanvasStore } from "@/store/canvas";
import OrganizedPreview, {
  MODULE_TYPE_ICON,
  cardTitle,
  moduleTypeLabel,
} from "./organizedPreview";

interface GroupExpandPopupProps {
  entry: DisplayEntry;
  /** 활성 보드 id — 대표 수동 지정 저장에 필요 */
  boardId: string;
  onClose: () => void;
  onOpenMember: (module: Module) => void;
}

/**
 * 그룹 멤버 펼침.
 * PC(md+): 중앙 모달, 멤버 미니 그리드.
 * 모바일(<md): 하단 시트, 대표 먼저 + 멤버 위→아래 리스트.
 */
export default function GroupExpandPopup({
  entry,
  boardId,
  onClose,
  onOpenMember,
}: GroupExpandPopupProps) {
  const setGroupPrimary = useCanvasStore((s) => s.setGroupPrimary);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const members = entry.members ?? [entry.anchor];
  const anchorId = entry.anchor.id;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center md:items-center"
      style={{ zIndex: 280, background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-t-2xl md:rounded-2xl"
        style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth: 640,
          maxHeight: "85vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`그룹 (${members.length}개 모듈)`}
      >
        <div
          className="flex flex-shrink-0 items-center gap-2 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span style={{ fontSize: 16 }} aria-hidden>
            🔗
          </span>
          <span
            className="min-w-0 flex-1 truncate font-semibold"
            style={{ fontSize: 16, color: "var(--text-primary)" }}
          >
            {cardTitle(entry.anchor)}
          </span>
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: "var(--surface-hover)", color: "var(--text-muted)" }}
          >
            {members.length}개
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 44,
              height: 44,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ overscrollBehavior: "contain" }}
        >
          {/* PC: 미니 그리드 / 모바일: 1열 */}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "1fr" }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {members.map((m) => {
                const isAnchor = m.id === anchorId;
                return (
                  <div
                    key={m.id}
                    className="flex flex-col rounded-xl"
                    style={{
                      background: "var(--surface)",
                      border: isAnchor
                        ? "1px solid var(--primary)"
                        : "1px solid var(--border)",
                      boxShadow: "var(--shadow-sm)",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenMember(m)}
                      className="flex flex-col gap-2 p-3 text-left transition-shadow"
                      style={{
                        minHeight: 44,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                      aria-label={`${moduleTypeLabel(m.type)} · ${cardTitle(m)} 열기`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden>
                          {MODULE_TYPE_ICON[m.type]}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate text-sm font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {cardTitle(m)}
                        </span>
                        {isAnchor ? (
                          <span
                            className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              background: "var(--primary-soft)",
                              color: "var(--primary)",
                            }}
                          >
                            ⭐ 대표
                          </span>
                        ) : null}
                      </div>
                      <OrganizedPreview module={m} compact />
                    </button>

                    {/* 대표 수동 지정 */}
                    {entry.groupKey ? (
                      isAnchor ? (
                        <div
                          className="flex items-center justify-center px-3 text-[11px] font-medium"
                          style={{
                            minHeight: 44,
                            borderTop: "1px solid var(--border)",
                            color: "var(--text-muted)",
                          }}
                        >
                          현재 대표
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setGroupPrimary(boardId, entry.groupKey!, m.id)
                          }
                          className="flex items-center justify-center gap-1 px-3 text-xs font-semibold transition-colors"
                          style={{
                            minHeight: 44,
                            background: "transparent",
                            border: "none",
                            borderTop: "1px solid var(--border)",
                            color: "var(--primary)",
                            cursor: "pointer",
                          }}
                          aria-label={`${cardTitle(m)} 을(를) 대표로 지정`}
                        >
                          ⭐ 대표로 지정
                        </button>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
