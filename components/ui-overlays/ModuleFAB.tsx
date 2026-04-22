"use client";

import { useState } from "react";
import type { ModuleType } from "@/types";
import { STANDARD_MODULE_OPTIONS, BRAINSTORM_ADD_OPTION } from "./moduleAddOptions";

interface ModuleFABProps {
  onAdd: (type: ModuleType) => void;
}

export default function ModuleFAB({ onAdd }: ModuleFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  function handleSelect(type: ModuleType) {
    onAdd(type);
    setIsOpen(false);
  }

  const standardCount = STANDARD_MODULE_OPTIONS.length;

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
          <div className="flex flex-col-reverse gap-2 items-end">
            {STANDARD_MODULE_OPTIONS.map((option, idx) => (
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
                  type="button"
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

            <div
              className="w-full max-w-[220px] my-1"
              style={{
                height: 1,
                background: "linear-gradient(90deg, transparent, var(--border), transparent)",
              }}
              aria-hidden
            />

            <div
              className="flex flex-col gap-1.5 items-end w-full max-w-[220px]"
              style={{
                animation: `fabItemIn 150ms ease-out ${standardCount * 40}ms both`,
              }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-wide pr-1"
                style={{ color: "var(--text-muted)" }}
              >
                발상
              </span>
              <div className="flex items-center gap-2 justify-end w-full">
                <span
                  className="rounded-lg px-3 text-sm font-semibold whitespace-nowrap"
                  style={{
                    height: 36,
                    lineHeight: "36px",
                    background: "var(--surface-hover)",
                    boxShadow: "var(--shadow-md)",
                    border: "1px dashed var(--accent)",
                    color: "var(--text-primary)",
                  }}
                >
                  {BRAINSTORM_ADD_OPTION.label}
                </span>
                <button
                  type="button"
                  onClick={() => handleSelect(BRAINSTORM_ADD_OPTION.type)}
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 44,
                    height: 44,
                    background: "var(--surface-hover)",
                    border: "1px dashed var(--accent)",
                    boxShadow: "var(--shadow-md)",
                    cursor: "pointer",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                  aria-label={BRAINSTORM_ADD_OPTION.label}
                >
                  {BRAINSTORM_ADD_OPTION.icon}
                </button>
              </div>
            </div>
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
