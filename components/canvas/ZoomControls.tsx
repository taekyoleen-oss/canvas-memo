"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface ZoomControlsProps {
  viewport: Viewport;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  /** 현재 화면에 보이는 모듈(또는 없으면 전체)에 맞게 줌·팬 */
  onFitToView: () => void;
  /** 생략 시 자동 정렬(⊞) 버튼 숨김 */
  onAutoLayout?: () => void;
  /** 자동 정렬 툴팁·접근성 라벨 (워크스페이스별 문구) */
  autoLayoutTitle?: string;
  autoLayoutAriaLabel?: string;
  isConnecting: boolean;
  isGroupMode?: boolean;
  onGroupMode?: () => void;
}

export default function ZoomControls({
  viewport,
  onZoomIn,
  onZoomOut,
  onFit,
  onFitToView,
  onAutoLayout,
  autoLayoutTitle,
  autoLayoutAriaLabel,
  isConnecting,
  isGroupMode,
  onGroupMode,
}: ZoomControlsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ left: 16, bottom: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origBottom: number;
  } | null>(null);

  const clampPanelPos = useCallback((left: number, bottom: number) => {
    const margin = 8;
    const el = rootRef.current;
    if (!el || typeof window === "undefined") {
      return { left, bottom };
    }
    const w = el.offsetWidth || 120;
    const h = el.offsetHeight || 80;
    const maxLeft = Math.max(margin, window.innerWidth - w - margin);
    const maxBottom = Math.max(margin, window.innerHeight - h - margin);
    return {
      left: Math.min(maxLeft, Math.max(margin, left)),
      bottom: Math.min(maxBottom, Math.max(margin, bottom)),
    };
  }, []);

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: panelPos.left,
        origBottom: panelPos.bottom,
      };
      setIsDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [panelPos.left, panelPos.bottom]
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setPanelPos(
        clampPanelPos(d.origLeft + dx, d.origBottom - dy)
      );
    },
    [clampPanelPos]
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    function onResize() {
      setPanelPos((p) => clampPanelPos(p.left, p.bottom));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPanelPos]);

  const zoomPercent = Math.round(viewport.zoom * 100);

  const btnStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    color: "var(--text-primary)",
    fontSize: 15,
    flexShrink: 0,
    transition: "background 0.12s",
  };

  const fitRowBtn: React.CSSProperties = {
    width: "100%",
    minHeight: 26,
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface-hover)",
    color: "var(--text-primary)",
    fontSize: 10,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    transition: "background 0.12s",
  };

  const layoutHint =
    autoLayoutTitle ??
    "자동 정렬 — 위치만 정렬 (줌/팬은 그대로)";
  const layoutAria =
    autoLayoutAriaLabel ?? "자동 정렬";

  return (
    <div
      ref={rootRef}
      data-zoom-controls="true"
      style={{
        position: "absolute",
        bottom: panelPos.bottom,
        left: panelPos.left,
        width: "max-content",
        maxWidth: "calc(100vw - 32px)",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        gap: 0,
        zIndex: 80,
        touchAction: "none",
      }}
    >
      <div
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => {
          dragRef.current = null;
          setIsDragging(false);
        }}
        style={{
          width: 22,
          minWidth: 22,
          flexShrink: 0,
          borderRadius: "8px 0 0 8px",
          background: "var(--surface-hover)",
          border: "1px solid var(--border-strong)",
          borderRight: "1px dashed var(--border)",
          cursor: isDragging ? "grabbing" : "grab",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "8px 0",
          userSelect: "none",
          color: "var(--text-muted)",
          fontWeight: 600,
        }}
        title="드래그하여 줌 패널 위치 이동"
        aria-label="줌 패널 위치 이동"
      >
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
          ⋮
        </span>
        <span
          style={{
            writingMode: "vertical-rl",
            textOrientation: "upright",
            fontSize: 10,
            letterSpacing: "0.12em",
          }}
        >
          이동
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 6,
          minWidth: 0,
        }}
      >
        {isConnecting && (
          <div
            style={{
              background: "var(--primary)",
              color: "var(--primary-fg)",
              borderRadius: "0 8px 8px 0",
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              boxShadow: "var(--shadow-md)",
              whiteSpace: "nowrap",
              animation: "connectPulse 1.4s ease-in-out infinite",
            }}
          >
            🔗 연결 모드 — 대상 모듈을 클릭하세요 &nbsp;·&nbsp; ESC 취소
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "0 8px 8px 8px",
            borderLeft: "none",
            padding: "2px 3px 3px",
            boxShadow: "var(--shadow-md)",
            boxSizing: "border-box",
          }}
        >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 4,
            rowGap: 6,
          }}
        >
          <button onClick={onZoomOut} style={btnStyle} aria-label="축소" title="축소">
            −
          </button>

          <button
            onClick={onFit}
            style={{
              ...btnStyle,
              width: "auto",
              paddingInline: 6,
              fontSize: 11,
              fontVariantNumeric: "tabular-nums",
              minWidth: 42,
            }}
            aria-label="전체 보기"
            title="전체 보기 — 보드의 모든 모듈이 들어오도록 줌"
          >
            {zoomPercent}%
          </button>

          <button onClick={onZoomIn} style={btnStyle} aria-label="확대" title="확대">
            +
          </button>

          <div
            style={{
              width: 1,
              height: 16,
              background: "var(--border)",
              marginInline: 2,
              flexShrink: 0,
            }}
          />

          {onAutoLayout && (
            <button
              onClick={onAutoLayout}
              style={{ ...btnStyle, fontSize: 15 }}
              aria-label={layoutAria}
              title={layoutHint}
            >
              ⊞
            </button>
          )}

          <button
            type="button"
            onClick={onGroupMode}
            style={{
              ...btnStyle,
              fontSize: 13,
              background: isGroupMode ? "var(--primary-soft)" : "transparent",
              color: isGroupMode ? "var(--primary)" : "var(--text-primary)",
              border: isGroupMode ? "1px solid var(--primary)" : "none",
              borderRadius: 6,
            }}
            aria-label="그룹 만들기"
            title="그룹 만들기 — 드래그로 여러 모듈을 묶습니다"
          >
            📦
          </button>
        </div>

        <button
          type="button"
          onClick={onFitToView}
          style={fitRowBtn}
          aria-label="Fit to View"
          title="Fit to View — 지금 화면에 보이는 모듈에 맞게 줌·팬 (없으면 전체와 동일)"
        >
          Fit to View
        </button>
        </div>
      </div>

      <style>{`
        @keyframes connectPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(0.99); }
        }
      `}</style>
    </div>
  );
}
