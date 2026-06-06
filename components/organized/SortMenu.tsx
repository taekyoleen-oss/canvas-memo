"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OrganizedSortKey } from "@/types";

interface SortMenuProps {
  sortKey: OrganizedSortKey;
  onChange: (key: OrganizedSortKey) => void;
}

const OPTIONS: { id: OrganizedSortKey; label: string; hint: string }[] = [
  { id: "createdDesc", label: "만든순(최신)", hint: "최근에 만든 것이 먼저" },
  { id: "title", label: "가나다", hint: "제목 가나다순" },
  { id: "updatedDesc", label: "수정순", hint: "최근에 고친 것이 먼저" },
];

function labelOf(key: OrganizedSortKey): string {
  return OPTIONS.find((o) => o.id === key)?.label ?? "정렬";
}

/** 정리 뷰 정렬 드롭다운 (ArrangeMenu 스타일 참고). */
export default function SortMenu({ sortKey, onChange }: SortMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // 메뉴 위치를 버튼 클릭 시점에 동기 측정해 둔다(효과 내 setState 회피).
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const open = pos !== null;

  function toggle() {
    if (open) {
      setPos(null);
      return;
    }
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuW = 200;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - menuW - margin)
    );
    setPos({ left, top: rect.bottom + 4 });
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPos(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3"
        style={{
          height: 32,
          minWidth: 44,
          background: "transparent",
          border: "1px solid var(--border)",
          cursor: "pointer",
          fontSize: 12,
          color: "var(--text-secondary)",
          whiteSpace: "nowrap",
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="정렬 기준"
      >
        <span style={{ fontSize: 13 }} aria-hidden>
          ↕
        </span>
        <span>{labelOf(sortKey)}</span>
      </button>

      {open && pos
        ? createPortal(
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 320, background: "transparent" }}
                onClick={() => setPos(null)}
              />
              <div
                ref={menuRef}
                role="menu"
                aria-label="정렬 기준 선택"
                style={{
                  position: "fixed",
                  left: pos.left,
                  top: pos.top,
                  width: 200,
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "var(--shadow-lg)",
                  padding: 6,
                  zIndex: 321,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {OPTIONS.map((o) => {
                  const active = o.id === sortKey;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        onChange(o.id);
                        setPos(null);
                      }}
                      className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left"
                      style={{
                        minHeight: 44,
                        background: active ? "var(--primary-soft)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (!active)
                          (e.currentTarget as HTMLElement).style.background =
                            "var(--surface-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active)
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <span
                        className="flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: active ? "var(--primary)" : "var(--text-primary)" }}
                      >
                        {active ? <span aria-hidden>✓</span> : null}
                        {o.label}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {o.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
