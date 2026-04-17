"use client";

import { useRef, useEffect } from "react";
import { useRichTextStore } from "@/store/richText";
import type { MemoData } from "@/types";

// HTML 태그를 제거해 미리보기용 플레인 텍스트로 변환
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface MemoModuleProps {
  data: MemoData;
  isExpanded: boolean;
  onChange: (data: MemoData) => void;
}

export default function MemoModule({ data, isExpanded, onChange }: MemoModuleProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const setEditorFocused = useRichTextStore((s) => s.setEditorFocused);

  // 포커스 없을 때만 innerHTML 동기화 (타이핑 중 커서 리셋 방지)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const newHtml = data.content ?? "";
    if (el.innerHTML !== newHtml) {
      el.innerHTML = newHtml;
    }
  });

  // ── 접힌 상태: 플레인 텍스트 미리보기 ──────────────────────────────────
  if (!isExpanded) {
    const preview = stripHtml(data.content ?? "");
    return (
      <div className="px-3 py-2">
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
          {preview || "내용을 입력하세요..."}
        </p>
      </div>
    );
  }

  // ── 펼친 상태: 리치 텍스트 에디터 ──────────────────────────────────────
  return (
    <div className="px-3 py-2">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="내용을 입력하세요..."
        onFocus={() => setEditorFocused(true)}
        onBlur={() => setEditorFocused(false)}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={(e) => {
          isComposing.current = false;
          onChange({ ...data, content: (e.currentTarget as HTMLDivElement).innerHTML });
        }}
        onInput={(e) => {
          if (isComposing.current) return;
          onChange({ ...data, content: (e.currentTarget as HTMLDivElement).innerHTML });
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // 캔버스 단축키 충돌 방지
          if (e.key === " " || e.key === "Escape") e.stopPropagation();
        }}
        style={{
          minHeight: 100,
          outline: "none",
          fontSize: 14,
          color: "var(--text-primary)",
          lineHeight: 1.65,
          wordBreak: "break-word",
          overflowWrap: "break-word",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "8px 10px",
        }}
      />
      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
          display: block;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
