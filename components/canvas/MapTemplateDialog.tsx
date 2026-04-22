"use client";

import { createPortal } from "react-dom";
import type { BrainstormMapType } from "@/types";
import { BRAINSTORM_MAP_OPTIONS } from "@/lib/brainstormMapMeta";

interface MapTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (templateId: BrainstormMapType) => void;
}

export default function MapTemplateDialog({ open, onClose, onApply }: MapTemplateDialogProps) {
  if (!open || typeof document === "undefined") return null;

  const panel = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 210,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          width: "min(440px, 100%)",
          maxHeight: "min(86vh, 640px)",
          overflow: "auto",
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          padding: "18px 18px 16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          맵 템플릿
        </h2>
        <p
          style={{
            margin: "8px 0 14px",
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--text-muted)",
          }}
        >
          선택한 맵은 <strong>여러 모듈과 연결</strong>로 캔버스에 추가됩니다. 이후 각 카드를 자유롭게
          옮기거나 삭제해 나만의 맵을 만들 수 있습니다.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
            gap: 8,
          }}
        >
          {BRAINSTORM_MAP_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onApply(o.id)}
              className="text-left rounded-xl px-3 py-2.5 transition-colors"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface-hover)",
                cursor: "pointer",
              }}
              title={o.hint}
            >
              <span
                className="block text-xs font-bold mb-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {o.label}
              </span>
              <span className="block text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
                {o.hint}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
