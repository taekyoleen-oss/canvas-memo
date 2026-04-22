"use client";

import type { BoardCategory, ModuleType } from "@/types";
import {
  MEMO_SCHEDULE_MODULE_OPTIONS,
  STANDARD_MODULE_OPTIONS,
  BRAINSTORM_ADD_OPTION,
} from "./moduleAddOptions";

interface ModuleToolbarProps {
  onAdd: (type: ModuleType) => void;
  onSearch: () => void;
  boardCategory?: BoardCategory;
}

export default function ModuleToolbar({
  onAdd,
  onSearch,
  boardCategory = "memo_schedule",
}: ModuleToolbarProps) {
  const isThinking = boardCategory === "thinking";

  return (
    <div
      className="flex items-center gap-2 px-4 flex-wrap"
      style={{
        minHeight: 48,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <span
        className="text-xs font-medium mr-1"
        style={{ color: "var(--text-muted)" }}
      >
        {isThinking ? "생각정리" : "메모·일정"}
      </span>

      {isThinking ? (
        <>
          <button
            type="button"
            onClick={() => onAdd(BRAINSTORM_ADD_OPTION.type)}
            className="flex items-center gap-1.5 rounded-lg px-3"
            style={{
              height: 34,
              background: "var(--primary-soft)",
              border: "1px solid var(--primary)",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--primary)",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
            title="아이디어 카드 — 캔버스 하단 🗺 맵 템플릿으로 여러 모듈을 한 번에 넣을 수 있어요"
          >
            <span style={{ fontSize: 15 }}>{BRAINSTORM_ADD_OPTION.icon}</span>
            {BRAINSTORM_ADD_OPTION.label}
          </button>
          {STANDARD_MODULE_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => onAdd(option.type)}
              className="flex items-center gap-1.5 rounded-lg px-3"
              style={{
                height: 34,
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--text-primary)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
              title={`${option.label} 추가`}
            >
              <span style={{ fontSize: 15 }}>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </>
      ) : (
        <>
          {MEMO_SCHEDULE_MODULE_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => onAdd(option.type)}
              className="flex items-center gap-1.5 rounded-lg px-3"
              style={{
                height: 34,
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--text-primary)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
              title={`${option.label} 추가`}
            >
              <span style={{ fontSize: 15 }}>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </>
      )}

      <div
        style={{
          width: 1,
          height: 24,
          background: "var(--border)",
          marginLeft: "auto",
          flexShrink: 0,
        }}
      />

      <button
        onClick={onSearch}
        className="flex items-center gap-1.5 rounded-lg px-3"
        style={{
          height: 34,
          background: "transparent",
          border: "1px solid var(--border)",
          cursor: "pointer",
          fontSize: 13,
          color: "var(--text-secondary)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        title="모듈 검색 (Ctrl+K)"
      >
        <span style={{ fontSize: 15 }}>🔍</span>
        <span className="hidden sm:inline">검색</span>
      </button>
    </div>
  );
}
