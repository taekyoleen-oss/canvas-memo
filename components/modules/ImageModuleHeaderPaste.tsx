"use client";

import { useCallback } from "react";
import { fileToDataUrl, readImageFromNavigatorClipboard } from "@/lib/imagePasteClipboard";

export default function ImageModuleHeaderPaste({
  onApplyDataUrl,
}: {
  onApplyDataUrl: (dataUrl: string) => void;
}) {
  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const file = await readImageFromNavigatorClipboard();
      if (!file) return;
      const url = await fileToDataUrl(file);
      onApplyDataUrl(url);
    },
    [onApplyDataUrl]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex-shrink-0 rounded px-1.5 font-medium"
      style={{
        height: 26,
        fontSize: 10,
        background: "var(--surface-hover)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      title="클립보드 이미지 붙여넣기. 안 되면 카드 안을 클릭한 뒤 Ctrl+V"
    >
      붙여넣기
    </button>
  );
}
