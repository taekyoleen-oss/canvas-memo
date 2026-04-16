"use client";

import { useState } from "react";
import type { ModuleType } from "@/types";

interface ModuleFABProps {
  onAdd: (type: ModuleType) => void;
}

const MODULE_OPTIONS: { type: ModuleType; icon: string; label: string }[] = [
  { type: "memo",     icon: "📝", label: "메모" },
  { type: "schedule", icon: "✅", label: "일정" },
  { type: "image",    icon: "🖼", label: "이미지" },
  { type: "link",     icon: "🔗", label: "링크" },
  { type: "file",     icon: "📎", label: "파일" },
];

export default function ModuleFAB({ onAdd }: ModuleFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  function handleSelect(type: ModuleType) {
    onAdd(type);
    setIsOpen(false);
  }

  return (
    <div
      className="fixed right-4 bottom-20 md:bottom-6 flex flex-col-reverse items-end gap-2"
      style={{ zIndex: 60 }}
    >
      {/* 메인 FAB */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          background: "var(--primary)",
          color: "var(--primary-fg)",
          border: "none",
          cursor: "pointer",
          boxShadow: "var(--shadow-lg)",
          fontSize: 26,
          fontWeight: "bold",
          transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
          transition: "transform 200ms",
        }}
        aria-label={isOpen ? "메뉴 닫기" : "모듈 추가"}
      >
        +
      </button>

      {/* 서브 메뉴 */}
      {isOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0"
            style={{ zIndex: -1 }}
            onClick={() => setIsOpen(false)}
          />
          <div className="flex flex-col-reverse gap-2">
            {MODULE_OPTIONS.map((option, idx) => (
              <div
                key={option.type}
                className="flex items-center gap-2 justify-end"
                style={{
                  animation: `fabItemIn 150ms ease-out ${idx * 40}ms both`,
                }}
              >
                <span
                  className="rounded-lg px-3 text-sm font-medium whitespace-nowrap"
                  style={{
                    height: 36,
                    lineHeight: "36px",
                    background: "var(--surface-elevated)",
                    boxShadow: "var(--shadow-md)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {option.label}
                </span>
                <button
                  onClick={() => handleSelect(option.type)}
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 44,
                    height: 44,
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-md)",
                    cursor: "pointer",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                  aria-label={option.label}
                >
                  {option.icon}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes fabItemIn {
          from { opacity: 0; transform: translateY(8px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
