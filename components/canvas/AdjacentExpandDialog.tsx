"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AnchorSide } from "@/lib/canvas/geometry";
import type {
  ConnectionPathStyle,
  ExpandAdjacentModuleOptions,
  ModuleShape,
} from "@/types";
import { templatesForModuleType } from "@/lib/moduleTemplates";

const SHAPES_FULL: { id: ModuleShape; label: string }[] = [
  { id: "rectangle", label: "네모" },
  { id: "rounded", label: "둥근 네모" },
  { id: "ellipse", label: "타원" },
  { id: "diamond", label: "마름모" },
];

const SHAPES_SIMPLE: { id: ModuleShape; label: string }[] = [
  { id: "rectangle", label: "네모" },
  { id: "rounded", label: "둥근 네모" },
  { id: "circle", label: "원형" },
];

const PATHS: { id: ConnectionPathStyle; label: string; hint: string }[] = [
  { id: "bezier", label: "곡선", hint: "베지어" },
  { id: "orthogonal", label: "직각", hint: "오쏘" },
  { id: "straight", label: "직선", hint: "한 줄" },
];

const DIR_KO: Record<AnchorSide, string> = {
  top: "위",
  right: "오른쪽",
  bottom: "아래",
  left: "왼쪽",
};

interface AdjacentExpandDialogProps {
  open: boolean;
  direction: AnchorSide | null;
  moduleType: "memo" | "brainstorm";
  /** 생각정리 보드: 모양 선택을 단순(네모·둥근·원)만 */
  simpleShapesOnly?: boolean;
  onCancel: () => void;
  onConfirm: (opts: ExpandAdjacentModuleOptions) => void;
}

export default function AdjacentExpandDialog({
  open,
  direction,
  moduleType,
  simpleShapesOnly = false,
  onCancel,
  onConfirm,
}: AdjacentExpandDialogProps) {
  const [shape, setShape] = useState<ModuleShape>("rounded");
  const [pathStyle, setPathStyle] = useState<ConnectionPathStyle>("bezier");
  const [templateId, setTemplateId] = useState("blank");

  const shapeOptions = simpleShapesOnly ? SHAPES_SIMPLE : SHAPES_FULL;

  useEffect(() => {
    if (open) {
      setShape("rounded");
      setPathStyle("bezier");
      setTemplateId("blank");
    }
  }, [open, direction]);

  if (!open || !direction || typeof document === "undefined") return null;

  const templates = templatesForModuleType(moduleType);

  const panel = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        style={{
          width: "min(360px, 100%)",
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          padding: "18px 18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {DIR_KO[direction]}쪽에 새 모듈
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.45,
            }}
          >
            연결선 색은 지금 모듈 색과 맞춰집니다. 새 카드 색은 메뉴의 색상에서 바꿀 수 있습니다.
          </p>
        </div>

        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)",
              margin: "0 0 6px",
            }}
          >
            카드 모양
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {shapeOptions.map((s) => {
              const active = shape === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShape(s.id)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: active
                      ? "2px solid var(--primary)"
                      : "1px solid var(--border)",
                    background: active ? "var(--primary-soft)" : "var(--surface-hover)",
                    color: active ? "var(--primary)" : "var(--text-primary)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)",
              margin: "0 0 6px",
            }}
          >
            연결선 모양
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PATHS.map((p) => {
              const active = pathStyle === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.hint}
                  onClick={() => setPathStyle(p.id)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: active
                      ? "2px solid var(--primary)"
                      : "1px solid var(--border)",
                    background: active ? "var(--primary-soft)" : "var(--surface-hover)",
                    color: active ? "var(--primary)" : "var(--text-primary)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="expand-template"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: 6,
            }}
          >
            템플릿
          </label>
          <select
            id="expand-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-hover)",
              color: "var(--text-primary)",
              fontSize: 13,
              padding: "0 10px",
              outline: "none",
            }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.description ? ` — ${t.description}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                moduleShape: shape,
                pathStyle,
                templateId: templateId === "blank" ? undefined : templateId,
              })
            }
            style={{
              flex: 1,
              height: 40,
              borderRadius: 10,
              border: "none",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            만들기
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
