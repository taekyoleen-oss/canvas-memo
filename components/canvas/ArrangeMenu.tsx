"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  arrangeModeLabel,
  arrangeSortLabel,
  type ArrangeMode,
  type ArrangeSortKey,
} from "@/lib/canvas/arrangeLayouts";

interface ArrangeMenuProps {
  /** 메뉴를 띄울 기준 좌표 — 화면 좌상단 기준 (px). 메뉴는 이 좌표 위에 표시. */
  anchorBottomLeft: { x: number; y: number };
  initialMode?: ArrangeMode;
  initialSortKey?: ArrangeSortKey;
  onApply: (mode: ArrangeMode, sortKey: ArrangeSortKey) => void;
  onClose: () => void;
}

const MODES: { id: ArrangeMode; icon: string; hint: string }[] = [
  { id: "grid", icon: "▦", hint: "균일한 격자 — 한눈에 비교하기 좋아요" },
  { id: "list", icon: "≡", hint: "단일 열로 길게 — 위에서 아래로 훑기" },
  {
    id: "byType",
    icon: "🗂",
    hint: "종류(메모·일정·링크·이미지…)끼리 묶어 정렬",
  },
  { id: "compact", icon: "▤", hint: "카드 원래 크기 그대로 빈틈없이 채움" },
];

const SORTS: ArrangeSortKey[] = ["updated", "created", "title", "type"];

export default function ArrangeMenu({
  anchorBottomLeft,
  initialMode = "grid",
  initialSortKey = "updated",
  onApply,
  onClose,
}: ArrangeMenuProps) {
  const [sortKey, setSortKey] = useState<ArrangeSortKey>(initialSortKey);
  const [mode, setMode] = useState<ArrangeMode>(initialMode);
  const rootRef = useRef<HTMLDivElement>(null);

  // 첫 페인트 직후 DOM에 직접 위치 적용(setState 회피)
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const w = el.offsetWidth || 260;
    const h = el.offsetHeight || 220;
    const margin = 8;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const left = Math.min(
      Math.max(margin, anchorBottomLeft.x),
      Math.max(margin, winW - w - margin)
    );
    const top = Math.min(
      Math.max(margin, anchorBottomLeft.y - h - 8),
      Math.max(margin, winH - h - margin)
    );
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
  }, [anchorBottomLeft.x, anchorBottomLeft.y]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "transparent",
          zIndex: 199,
        }}
        onClick={onClose}
      />
      <div
        ref={rootRef}
        role="dialog"
        aria-label="정렬 메뉴"
        style={{
          position: "fixed",
          left: anchorBottomLeft.x,
          top: Math.max(8, anchorBottomLeft.y - 220),
          width: 260,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "var(--shadow-lg)",
          padding: 12,
          zIndex: 200,
          visibility: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <strong
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
              fontWeight: 600,
            }}
          >
            정렬해서 보기
          </strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 2,
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          1. 정렬 방식
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                title={m.hint}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: active
                    ? "1px solid var(--primary)"
                    : "1px solid var(--border)",
                  background: active
                    ? "var(--primary-soft)"
                    : "var(--surface-hover)",
                  color: active ? "var(--primary)" : "var(--text-primary)",
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
                  {m.icon}
                </span>
                {arrangeModeLabel(m.id)}
              </button>
            );
          })}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          2. 정렬 기준
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {SORTS.map((k) => {
            const active = sortKey === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSortKey(k)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: active
                    ? "1px solid var(--primary)"
                    : "1px solid var(--border)",
                  background: active ? "var(--primary)" : "transparent",
                  color: active ? "var(--primary-fg)" : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {arrangeSortLabel(k)}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(mode, sortKey);
              onClose();
            }}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            정렬하기
          </button>
        </div>

        <p
          style={{
            marginTop: 10,
            marginBottom: 0,
            fontSize: 10,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          그룹·맵 템플릿 묶음 모듈은 정렬 대상에서 제외됩니다. Ctrl+Z로 되돌릴 수 있어요.
        </p>
      </div>
    </>
  );
}
