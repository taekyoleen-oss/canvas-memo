"use client";

import { useState } from "react";
import type { ScheduleData } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface ScheduleModuleProps {
  data: ScheduleData;
  isExpanded: boolean;
  onChange: (data: ScheduleData) => void;
}

export default function ScheduleModule({
  data,
  isExpanded,
  onChange,
}: ScheduleModuleProps) {
  const [newItemText, setNewItemText] = useState("");

  const previewItems = data.items.slice(0, data.previewCount ?? 3);
  const displayItems = isExpanded ? data.items : previewItems;

  function toggleItem(id: string) {
    onChange({
      ...data,
      items: data.items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      ),
    });
  }

  function addItem() {
    if (!newItemText.trim()) return;
    onChange({
      ...data,
      items: [
        ...data.items,
        {
          id: uuidv4(),
          text: newItemText.trim(),
          dueDate: null,
          done: false,
        },
      ],
    });
    setNewItemText("");
  }

  return (
    <div className="px-3 py-2 flex flex-col gap-1">
      {displayItems.map((item) => (
        <label
          key={item.id}
          className="flex items-center gap-2 cursor-pointer py-0.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => toggleItem(item.id)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 16,
              height: 16,
              accentColor: "var(--primary)",
              flexShrink: 0,
            }}
          />
          <span
            className="text-sm"
            style={{
              color: item.done ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: item.done ? "line-through" : "none",
            }}
          >
            {item.text}
          </span>
        </label>
      ))}

      {!isExpanded && data.items.length > (data.previewCount ?? 3) && (
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          +{data.items.length - (data.previewCount ?? 3)}개 더
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
            placeholder="새 항목 추가..."
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
