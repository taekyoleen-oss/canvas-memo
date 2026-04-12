"use client";

import type { MemoData } from "@/types";

interface MemoModuleProps {
  data: MemoData;
  isExpanded: boolean;
  onChange: (data: MemoData) => void;
}

export default function MemoModule({
  data,
  isExpanded,
  onChange,
}: MemoModuleProps) {
  const previewLines = data.content
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, data.previewLines ?? 2)
    .join("\n");

  if (!isExpanded) {
    return (
      <div className="px-3 py-2 flex flex-col gap-1">
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {data.title || "제목 없음"}
        </p>
        <p
          className="text-sm"
          style={{
            color: "var(--text-secondary)",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            whiteSpace: "pre-wrap",
          }}
        >
          {previewLines || "내용을 입력하세요..."}
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      <input
        type="text"
        value={data.title}
        onChange={(e) => onChange({ ...data, title: e.target.value })}
        placeholder="제목"
        className="text-sm font-medium rounded px-2"
        style={{
          height: 36,
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          outline: "none",
        }}
      />
      <textarea
        value={data.content}
        onChange={(e) => onChange({ ...data, content: e.target.value })}
        placeholder="마크다운 형식으로 입력하세요..."
        className="text-sm rounded px-2 py-1 resize-none"
        rows={6}
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          outline: "none",
          lineHeight: 1.6,
        }}
      />
    </div>
  );
}
