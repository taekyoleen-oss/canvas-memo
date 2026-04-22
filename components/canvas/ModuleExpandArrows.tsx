"use client";

import type { AnchorSide } from "@/lib/canvas/geometry";

const EXPAND_OFFSET = 50;
const BTN = 28;

const LABEL: Record<AnchorSide, string> = {
  top: "위쪽에 연결된 모듈 추가",
  right: "오른쪽에 연결된 모듈 추가",
  bottom: "아래쪽에 연결된 모듈 추가",
  left: "왼쪽에 연결된 모듈 추가",
};

const POSITION: Record<AnchorSide, React.CSSProperties> = {
  top: { top: -EXPAND_OFFSET, left: "50%", transform: "translate(-50%, -50%)" },
  right: { right: -EXPAND_OFFSET, top: "50%", transform: "translate(50%, -50%)" },
  bottom: { bottom: -EXPAND_OFFSET, left: "50%", transform: "translate(-50%, 50%)" },
  left: { left: -EXPAND_OFFSET, top: "50%", transform: "translate(-50%, -50%)" },
};

function ArrowIcon({ side }: { side: AnchorSide }) {
  const deg = { top: -90, right: 0, bottom: 90, left: 180 }[side];
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${deg}deg)` }}
      aria-hidden
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

const SIDES: AnchorSide[] = ["top", "right", "bottom", "left"];

interface ModuleExpandArrowsProps {
  onArrowClick: (direction: AnchorSide) => void;
  /** 지정 시 해당 방향만 렌더 (메모: 앵커 탭 후 해당 방향만 표시) */
  visibleSides?: AnchorSide[];
}

export default function ModuleExpandArrows({
  onArrowClick,
  visibleSides,
}: ModuleExpandArrowsProps) {
  const sides = visibleSides?.length ? visibleSides : SIDES;
  return (
    <>
      {sides.map((side) => (
        <button
          key={side}
          type="button"
          data-expand-arrow={side}
          aria-label={LABEL[side]}
          title={LABEL[side]}
          style={{
            position: "absolute",
            ...POSITION[side],
            width: BTN,
            height: BTN,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            borderRadius: "50%",
            border: "1px solid var(--border)",
            background: "var(--surface-elevated)",
            color: "var(--text-muted)",
            boxShadow: "var(--shadow-sm)",
            cursor: "pointer",
            zIndex: 52,
            transition: "color 0.12s, border-color 0.12s, background 0.12s",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onArrowClick(side);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--primary)";
            e.currentTarget.style.borderColor = "var(--primary)";
            e.currentTarget.style.background = "var(--surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--surface-elevated)";
          }}
        >
          <ArrowIcon side={side} />
        </button>
      ))}
    </>
  );
}
