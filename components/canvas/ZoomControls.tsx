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
  /** ▦ 정렬 메뉴 열기 — 기준이 되는 버튼의 화면 좌표(left, bottom)를 전달 */
  onArrange?: (anchor: { x: number; y: number }) => void;
  arrangeActive?: boolean;
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
  onArrange,
  arrangeActive,
  isConnecting,
  isGroupMode,
  onGroupMode,
}: ZoomControlsProps) {
  const arrangeBtnRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ left: 12, top: 64 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
  } | null>(null);

  const clampPanelPos = useCallback((left: number, top: number) => {
    const margin = 8;
    const el = rootRef.current;
    if (!el || typeof window === "undefined") {
      return { left, top };
    }
    const w = el.offsetWidth || 120;
    const h = el.offsetHeight || 60;
    const maxLeft = Math.max(margin, window.innerWidth - w - margin);
    const maxTop = Math.max(margin, window.innerHeight - h - margin);
    return {
      left: Math.min(maxLeft, Math.max(margin, left)),
      top: Math.min(maxTop, Math.max(margin, top)),
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
        origTop: panelPos.top,
      };
      setIsDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [panelPos.left, panelPos.top]
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setPanelPos(
        clampPanelPos(d.origLeft + dx, d.origTop + dy)
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
      setPanelPos((p) => clampPanelPos(p.left, p.top));
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
    minHeight: 26,
    padding: "0 8px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface-hover)",
    color: "var(--text-primary)",
    fontSize: 10,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    transition: "background 0.12s",
    whiteSpace: "nowrap",
    flexShrink: 0,
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
        top: panelPos.top,
        left: panelPos.left,
        width: "max-content",
        maxWidth: "calc(100vw - 32px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        zIndex: 80,
        touchAction: "none",
      }}
    >
      {isConnecting && (
        <div
          style={{
            background: "var(--primary)",
            color: "var(--primary-fg)",
            borderRadius: 8,
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
          flexDirection: "row",
          alignItems: "stretch",
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "var(--shadow-md)",
          boxSizing: "border-box",
          overflow: "hidden",
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
            background: "var(--surface-hover)",
            borderRight: "1px dashed var(--border)",
            cursor: isDragging ? "grabbing" : "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
            color: "var(--text-muted)",
            fontWeight: 600,
            fontSize: 14,
          }}
          title="드래그하여 줌 패널 위치 이동"
          aria-label="줌 패널 위치 이동"
        >
          ⋮⋮
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "nowrap",
            gap: 2,
            padding: "3px 4px",
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
              height: 18,
              background: "var(--border)",
              marginInline: 2,
              flexShrink: 0,
            }}
          />

          <button
            type="button"
            onClick={onFitToView}
            style={fitRowBtn}
            aria-label="Fit to View"
            title="Fit to View — 지금 화면에 보이는 모듈에 맞게 줌·팬"
          >
            Fit
          </button>

          <div
            style={{
              width: 1,
              height: 18,
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

          {onArrange && (
            <button
              ref={arrangeBtnRef}
              type="button"
              onClick={() => {
                const rect = arrangeBtnRef.current?.getBoundingClientRect();
                const anchor = rect
                  ? { x: rect.left, y: rect.bottom + 4 }
                  : { x: 16, y: 80 };
                onArrange(anchor);
              }}
              style={{
                ...btnStyle,
                fontSize: 14,
                background: arrangeActive ? "var(--primary-soft)" : "transparent",
                color: arrangeActive ? "var(--primary)" : "var(--text-primary)",
                border: arrangeActive ? "1px solid var(--primary)" : "none",
                borderRadius: 6,
              }}
              aria-label="정렬해서 보기"
              title="정렬해서 보기 — 격자·목록·종류별·컴팩트로 한 번에 정리"
            >
              ▦
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
