"use client";

import type { CSSProperties } from "react";
import type { BrainstormMapType } from "@/types";
import { BRAINSTORM_MAP_OPTIONS } from "@/lib/brainstormMapMeta";
import { getMapToolsForTemplate } from "@/lib/canvas/mapTemplateTools";

interface MapTemplateWorkspaceChromeProps {
  templateId: BrainstormMapType;
  groupName: string;
  mapScale: number;
  onScaleIn: () => void;
  onScaleOut: () => void;
  onTool: (toolId: string) => void;
}

function scaleBtnStyle(disabled: boolean): CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: disabled ? "var(--border)" : "var(--surface-hover)",
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    fontSize: 18,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    lineHeight: 1,
  };
}

export default function MapTemplateWorkspaceChrome({
  templateId,
  groupName,
  mapScale,
  onScaleIn,
  onScaleOut,
  onTool,
}: MapTemplateWorkspaceChromeProps) {
  const meta = BRAINSTORM_MAP_OPTIONS.find((o) => o.id === templateId);
  const tools = getMapToolsForTemplate(templateId);
  const scalePct = Math.round(mapScale * 100);

  const canZoomIn = mapScale < 4 - 0.01;
  const canZoomOut = mapScale > 0.26;

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 52,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 85,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderRadius: 12,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
          maxWidth: "min(96vw, 520px)",
        }}
      >
        <span style={{ fontSize: 18 }} aria-hidden>
          🗺
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {meta?.label ?? templateId}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {groupName} · 비율 유지 확대·축소
          </div>
        </div>
        <div
          style={{
            width: 1,
            height: 28,
            background: "var(--border)",
            flexShrink: 0,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onScaleOut}
            disabled={!canZoomOut}
            style={scaleBtnStyle(!canZoomOut)}
            title="맵 축소"
          >
            −
          </button>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              minWidth: 44,
              textAlign: "center",
            }}
          >
            {scalePct}%
          </span>
          <button
            type="button"
            onClick={onScaleIn}
            disabled={!canZoomIn}
            style={scaleBtnStyle(!canZoomIn)}
            title="맵 확대"
          >
            +
          </button>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 52,
          right: 12,
          bottom: 180,
          width: 216,
          zIndex: 85,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 12,
          borderRadius: 12,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
          overflow: "auto",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          템플릿 도구
        </div>
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTool(t.id)}
            title={t.hint ?? t.label}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-hover)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.label}
            {t.hint ? (
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 400,
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                {t.hint}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </>
  );
}
