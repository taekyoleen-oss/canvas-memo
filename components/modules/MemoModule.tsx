"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { useRichTextStore } from "@/store/richText";
import type { MemoData } from "@/types";
import RichTextToolbar from "@/components/ui-overlays/RichTextToolbar";

// HTML 태그를 제거해 미리보기용 플레인 텍스트로 변환
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<(?:div|p|h[1-6]|li|tr|blockquote)(?:\s[^>]*)?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** -webkit-line-clamp 환경에서는 \\n + pre-wrap이 무시되는 경우가 있어 <br />로 표시 */
function previewNodes(text: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {i > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

interface MemoModuleProps {
  data: MemoData;
  isExpanded: boolean;
  onChange: (data: MemoData) => void;
  /** 주제별 보드의 넓은 노트 — 편집 영역·플레이스홀더 확대 */
  variant?: "default" | "note";
}

export default function MemoModule({
  data,
  isExpanded,
  onChange,
  variant = "default",
}: MemoModuleProps) {
  const isNote = variant === "note";
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const setEditorFocused = useRichTextStore((s) => s.setEditorFocused);

  // 포커스 없을 때만 innerHTML 동기화 (타이핑 중 커서 리셋 방지)
  useEffect(() => {
    if (!isExpanded) return;
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const newHtml = data.content ?? "";
    if (el.innerHTML !== newHtml) {
      el.innerHTML = newHtml;
    }
  }, [data.content, isExpanded]);

  // ── 접힌 상태: 플레인 텍스트 미리보기 ──────────────────────────────────
  if (!isExpanded) {
    const preview = stripHtml(data.content ?? "");
    const lineClamp =
      data.previewLines > 0 ? data.previewLines : isNote ? 5 : 2;
    return (
      <div className={isNote ? "px-3 py-2.5" : "px-3 py-2"}>
        <p
          className={isNote ? "text-[15px] leading-relaxed" : "text-sm"}
          style={{
            color: "var(--text-secondary)",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: lineClamp,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {preview ? previewNodes(preview) : "내용을 입력하세요..."}
        </p>
      </div>
    );
  }

  // ── 펼친 상태: 리치 텍스트 에디터 (툴바는 노트 카드 안에 표시) ─────────────
  return (
    <div
      className={isNote ? "px-3 py-2.5" : "px-3 py-2"}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div onPointerDown={(e) => e.stopPropagation()} className="-mx-0.5">
        <RichTextToolbar variant="embedded" />
      </div>
      <div
        ref={editorRef}
        className={isNote ? "memo-note-editor" : undefined}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={
          isNote
            ? "명령어, 프롬프트, 링크, 글머리표, 이미지… 한 노트에 함께 정리하세요"
            : "내용을 입력하세요..."
        }
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
          minHeight: isNote ? 220 : 100,
          outline: "none",
          fontSize: isNote ? 15 : 14,
          color: "var(--text-primary)",
          lineHeight: isNote ? 1.7 : 1.65,
          wordBreak: "break-word",
          overflowWrap: "break-word",
          border: "1px solid var(--border)",
          borderRadius: isNote ? 10 : 6,
          padding: isNote ? "12px 14px" : "8px 10px",
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
        .memo-note-editor ul, .memo-note-editor ol {
          margin: 0.45em 0;
          padding-left: 1.35em;
        }
        .memo-note-editor li { margin: 0.2em 0; }
        .memo-note-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          vertical-align: middle;
        }
        .memo-note-editor a { color: var(--primary); text-decoration: underline; }
        .memo-note-editor code {
          font-size: 0.9em;
          padding: 0.1em 0.35em;
          border-radius: 4px;
          background: var(--surface-hover);
        }
        .memo-note-editor h1, .memo-note-editor h2, .memo-note-editor h3 {
          margin: 0.6em 0 0.35em 0;
          font-weight: 600;
          line-height: 1.35;
        }
      `}</style>
    </div>
  );
}
