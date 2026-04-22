"use client";

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
  onAutoLayout: () => void;
  /** 메모·브레인 연결 그래프 층 배치 */
  onMindMapLayout?: () => void;
  /** 프로세스·SWOT 등 맵 템플릿(여러 모듈) 삽입 */
  onMapTemplates?: () => void;
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
  onMindMapLayout,
  onMapTemplates,
  isConnecting,
  isGroupMode,
  onGroupMode,
}: ZoomControlsProps) {
  const zoomPercent = Math.round(viewport.zoom * 100);

  const btnStyle: React.CSSProperties = {
    width: 34,
    height: 34,
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
    minHeight: 30,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface-hover)",
    color: "var(--text-primary)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    transition: "background 0.12s",
  };

  return (
    <div
      data-zoom-controls="true"
      style={{
        position: "absolute",
        bottom: 20,
        left: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 6,
        zIndex: 80,
        maxWidth: 200,
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
          flexDirection: "column",
          gap: 6,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "6px 6px 8px",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button onClick={onZoomOut} style={btnStyle} aria-label="축소" title="축소">
            −
          </button>

          <button
            onClick={onFit}
            style={{
              ...btnStyle,
              width: "auto",
              paddingInline: 8,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              minWidth: 46,
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
              marginInline: 3,
            }}
          />

          <button
            onClick={onAutoLayout}
            style={{ ...btnStyle, fontSize: 16 }}
            aria-label="메모형 자동 정렬"
            title="메모형 자동 정렬 — 위치만 정렬 (줌/팬은 그대로)"
          >
            ⊞
          </button>

          {onMindMapLayout && (
            <button
              onClick={onMindMapLayout}
              style={{ ...btnStyle, fontSize: 15 }}
              aria-label="마인드맵 자동 배치"
              title="마인드맵 자동 배치 — 연결된 메모·브레인을 왼쪽 루트 기준으로 층 나열"
            >
              ◫
            </button>
          )}

          {onMapTemplates && (
            <button
              onClick={onMapTemplates}
              style={{ ...btnStyle, fontSize: 15 }}
              aria-label="맵 템플릿"
              title="맵 템플릿 — 여러 모듈과 연결이 한 번에 추가됩니다"
            >
              🗺
            </button>
          )}

          <button
            onClick={onGroupMode}
            style={{
              ...btnStyle,
              fontSize: 14,
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

      <style>{`
        @keyframes connectPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(0.99); }
        }
      `}</style>
    </div>
  );
}
