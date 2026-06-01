"use client";

// 캔버스 상단 중앙 "순서 지정 합치기" 컨트롤.
// idle: 합칠 수 있는(메모/이미지) 모듈이 2개 이상이면 시작 버튼 표시.
// ordering: 모듈을 순서대로 탭 → "합치기 실행".
interface MergeOrderBarProps {
  mode: "idle" | "ordering";
  mergeableCount: number;
  pickedCount: number;
  onStart: () => void;
  onExecute: () => void;
  onCancel: () => void;
}

export default function MergeOrderBar({
  mode,
  mergeableCount,
  pickedCount,
  onStart,
  onExecute,
  onCancel,
}: MergeOrderBarProps) {
  if (mode === "idle" && mergeableCount < 2) return null;

  const wrap: React.CSSProperties = {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 86,
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "var(--surface-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 4,
    boxShadow: "var(--shadow-lg)",
    maxWidth: "calc(100vw - 24px)",
    pointerEvents: "auto",
  };

  const btn: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 12px",
    minHeight: 36,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 6,
    whiteSpace: "nowrap",
  };

  if (mode === "idle") {
    return (
      <div
        style={wrap}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onStart}
          style={{
            ...btn,
            background: "var(--primary-soft)",
            color: "var(--primary)",
          }}
          title="모듈을 순서대로 탭해서 하나의 노트로 합치기"
        >
          📝 순서대로 합치기
        </button>
      </div>
    );
  }

  const canExecute = pickedCount >= 2;
  return (
    <div
      style={{ ...wrap, flexWrap: "wrap", justifyContent: "center" }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        style={{
          padding: "0 8px",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        합칠 모듈을 순서대로 탭하세요 · {pickedCount}개
      </span>
      <div style={{ width: 1, height: 20, background: "var(--border)" }} />
      <button
        type="button"
        onClick={onExecute}
        disabled={!canExecute}
        style={{
          ...btn,
          opacity: canExecute ? 1 : 0.45,
          cursor: canExecute ? "pointer" : "not-allowed",
          background: canExecute ? "var(--primary)" : "transparent",
          color: canExecute ? "var(--primary-fg)" : "var(--text-muted)",
        }}
        title={canExecute ? "선택한 순서대로 합치기" : "2개 이상 탭해야 합니다"}
      >
        ✓ 합치기 실행
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{ ...btn, background: "transparent", color: "var(--text-muted)" }}
        title="순서 지정 취소"
      >
        취소
      </button>
    </div>
  );
}
