"use client";

import type { ModuleType } from "@/types";
import { STANDARD_MODULE_OPTIONS, BRAINSTORM_ADD_OPTION } from "./moduleAddOptions";

interface ModuleToolbarProps {
  onAdd: (type: ModuleType) => void;
  onSearch: () => void;
}

export default function ModuleToolbar({ onAdd, onSearch }: ModuleToolbarProps) {
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
        추가
      </span>
      {STANDARD_MODULE_OPTIONS.map((option) => (
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

      {/* 브레인스토밍: 일반 모듈과 구분된 그룹 */}
      <div
        className="flex items-center gap-2 pl-3 ml-1"
        style={{
          borderLeft: "1px solid var(--border)",
        }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wide hidden sm:inline"
          style={{ color: "var(--text-muted)" }}
        >
          발상
        </span>
        <button
          type="button"
          onClick={() => onAdd(BRAINSTORM_ADD_OPTION.type)}
          className="flex items-center gap-1.5 rounded-lg px-3"
          style={{
            height: 34,
            background: "var(--surface-hover)",
            border: "1px dashed var(--accent)",
            cursor: "pointer",
            fontSize: 13,
            color: "var(--text-primary)",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
          title={`${BRAINSTORM_ADD_OPTION.label} 추가`}
        >
          <span style={{ fontSize: 15 }}>{BRAINSTORM_ADD_OPTION.icon}</span>
          {BRAINSTORM_ADD_OPTION.label}
        </button>
      </div>

      {/* 구분선 */}
      <div
        style={{
          width: 1,
          height: 24,
          background: "var(--border)",
          marginLeft: "auto",
          flexShrink: 0,
        }}
      />

      {/* 검색 버튼 */}
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
