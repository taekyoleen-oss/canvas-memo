"use client";

import type { FC } from "react";
import type { BoardCategory } from "@/types";
import { useCanvasStore } from "@/store/canvas";

/** 메모/할일 — 문서·목록 느낌의 얇은 라인 */
const IconMemoSchedule: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 2v6h6M8 13h8M8 17h5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 17.5 18.5 19 21 15.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** 생각정리 — 전구 실루엣 */
const IconThinking: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M9 21h6M12 3a6 6 0 0 0-6 6c0 1.7.7 3.2 2 4.2V19a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-5.8c1.3-1 2-2.5 2-4.2a6 6 0 0 0-6-6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** 주제별 — 코드 괄호 </> 스타일 */
const IconTopic: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="m16 18 6-6-6-6M8 6 2 12l6 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TABS: {
  id: BoardCategory;
  label: string;
  Icon: FC;
}[] = [
  { id: "memo_schedule", label: "메모/할일", Icon: IconMemoSchedule },
  { id: "thinking", label: "생각정리", Icon: IconThinking },
  { id: "topic_notes", label: "주제별", Icon: IconTopic },
];

export type WorkspaceSwitcherVariant = "default" | "inline";

interface WorkspaceSwitcherProps {
  /** inline: 상단 한 줄에 모듈 툴바와 나란히 둘 때 (세로 중첩 방지) */
  variant?: WorkspaceSwitcherVariant;
}

export default function WorkspaceSwitcher({
  variant = "default",
}: WorkspaceSwitcherProps) {
  const activeWorkspace = useCanvasStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useCanvasStore((s) => s.setActiveWorkspace);

  const isInline = variant === "inline";

  return (
    <div
      className={
        isInline
          ? "flex h-full min-h-[48px] flex-shrink-0 flex-row flex-nowrap items-center px-2"
          : "flex w-full min-w-0 flex-shrink-0 flex-row flex-nowrap items-center justify-center px-2 py-1.5"
      }
      style={{
        background: "var(--surface)",
        borderBottom: isInline ? undefined : "1px solid var(--border)",
        borderRight: isInline ? "1px solid var(--border)" : undefined,
        flexDirection: "row",
        flexWrap: "nowrap",
      }}
    >
      <div
        className="grid max-w-full min-w-0 auto-cols-max grid-flow-col items-center gap-0.5 overflow-x-auto rounded-full p-px"
        style={{
          background: "var(--surface-hover)",
          boxShadow: "inset 0 1px 1px rgba(0,0,0,0.04)",
          WebkitOverflowScrolling: "touch",
          gridAutoFlow: "column",
        }}
        role="tablist"
        aria-label="작업 영역 선택"
      >
        {TABS.map((tab) => {
          const selected = activeWorkspace === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={tab.label}
              title={tab.label}
              onClick={() => setActiveWorkspace(tab.id)}
              className="flex flex-shrink-0 flex-row flex-nowrap items-center justify-center outline-none transition-[background,color,box-shadow] duration-150"
              style={{
                height: 32,
                flexDirection: "row",
                padding: "0 8px",
                borderRadius: 9999,
                background: selected ? "var(--surface-elevated)" : "transparent",
                color: selected ? "var(--text-primary)" : "var(--text-muted)",
                border: selected ? "1px solid var(--border)" : "1px solid transparent",
                boxShadow: selected ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                gap: 5,
                cursor: "pointer",
              }}
            >
              <Icon />
              <span
                className="font-medium leading-none whitespace-nowrap"
                style={{
                  fontSize: selected ? 11 : 10,
                  letterSpacing: "-0.02em",
                  fontWeight: selected ? 600 : 500,
                  maxWidth: selected ? undefined : "4.5rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
