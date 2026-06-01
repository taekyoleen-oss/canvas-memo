"use client";

import { useState } from "react";
import { useImageClipboardStore } from "@/store/imageClipboard";

// 이미지 모듈 우측 상단 "이미지 복사" 버튼.
// 이 모듈의 이미지(여러 장)를 앱 내부 이미지 클립보드에 복사 → 다른 이미지 모듈에서 붙여넣기.
export default function ImageModuleHeaderCopy({ srcs }: { srcs: string[] }) {
  const copy = useImageClipboardStore((s) => s.copy);
  const [copied, setCopied] = useState(false);

  if (srcs.length === 0) return null;

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        copy(srcs);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="flex-shrink-0 rounded px-1.5 font-medium"
      style={{
        height: 26,
        fontSize: 10,
        background: copied ? "var(--primary-soft)" : "var(--surface-hover)",
        border: "1px solid var(--border)",
        color: copied ? "var(--primary)" : "var(--text-primary)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      title="이 모듈의 이미지를 복사 (다른 이미지 모듈에 붙여넣기 가능)"
    >
      {copied ? "복사됨!" : `이미지 복사${srcs.length > 1 ? ` ${srcs.length}` : ""}`}
    </button>
  );
}
