"use client";

import { useState } from "react";
import type { BrainstormData } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface BrainstormModuleProps {
  data: BrainstormData;
  isExpanded: boolean;
  onChange: (data: BrainstormData) => void;
}

export default function BrainstormModule({
  data,
  isExpanded,
  onChange,
}: BrainstormModuleProps) {
  const [newItemText, setNewItemText] = useState("");

  const previewCount = data.previewCount ?? 4;
  const previewItems = data.items.slice(0, previewCount);
  const displayItems = isExpanded ? data.items : previewItems;

  function removeItem(id: string) {
    onChange({
      ...data,
      items: data.items.filter((item) => item.id !== id),
    });
  }

  function addItem() {
    if (!newItemText.trim()) return;
    onChange({
      ...data,
      items: [
        ...data.items,
        { id: uuidv4(), text: newItemText.trim() },
      ],
    });
    setNewItemText("");
  }

  return (
    <div className="px-3 py-2 flex flex-col gap-1">
      {displayItems.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          아이디어를 입력해 보세요…
        </p>
      )}
      {displayItems.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-2 py-0.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span
            className="text-sm select-none"
            style={{ color: "var(--accent)", flexShrink: 0, lineHeight: 1.45 }}
            aria-hidden
          >
            ·
          </span>
          <span
            className="text-sm flex-1 min-w-0"
            style={{
              color: "var(--text-primary)",
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {item.text}
          </span>
          {isExpanded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeItem(item.id);
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: 14,
                padding: "0 4px",
                flexShrink: 0,
                lineHeight: 1.45,
              }}
              aria-label="항목 삭제"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {!isExpanded && data.items.length > previewCount && (
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          +{data.items.length - previewCount}개 더
        </p>
      )}

      {isExpanded && (
        <div className="flex gap-1 mt-1">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="아이디어 추가…"
            className="flex-1 text-sm rounded px-2"
            style={{
              height: 32,
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={addItem}
            className="rounded px-2 font-bold"
            style={{
              height: 32,
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
