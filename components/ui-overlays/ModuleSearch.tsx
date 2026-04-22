"use client";

import { useState, useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/canvas";
import type {
  Module,
  MemoData,
  ScheduleData,
  ImageData,
  LinkData,
  FileData,
  TableData,
  BrainstormData,
} from "@/types";

interface ModuleSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

function getModuleText(module: Module): string {
  const parts: string[] = [];
  const d = module.data;

  // title 필드
  if ("title" in d && typeof d.title === "string") parts.push(d.title);

  switch (module.type) {
    case "memo":
      parts.push((d as MemoData).content ?? "");
      break;
    case "schedule":
      (d as ScheduleData).items.forEach((item) => parts.push(item.text));
      break;
    case "brainstorm":
      (d as BrainstormData).items.forEach((item) => parts.push(item.text));
      break;
    case "image":
      parts.push((d as ImageData).caption ?? "");
      break;
    case "link":
      parts.push((d as LinkData).url ?? "", (d as LinkData).description ?? "");
      break;
    case "file":
      parts.push((d as FileData).fileName ?? "");
      break;
    case "table":
      parts.push(
        ...(d as TableData).cells ?? [],
        `${(d as TableData).rowCount}행`,
        `${(d as TableData).colCount}열`
      );
      break;
  }

  return parts.filter(Boolean).join(" ").toLowerCase();
}

function getModuleTypeLabel(type: Module["type"]): string {
  const map: Record<Module["type"], string> = {
    memo: "📝",
    schedule: "✅",
    brainstorm: "💡",
    image: "🖼",
    link: "🔗",
    file: "📎",
    table: "▦",
  };
  return map[type] ?? "📋";
}

function getModuleTitle(module: Module): string {
  const d = module.data;
  if ("title" in d && typeof d.title === "string" && d.title) return d.title;
  if (module.type === "memo") return (d as MemoData).content?.slice(0, 40) || "빈 메모";
  if (module.type === "file") return (d as FileData).fileName || "파일";
  return `${getModuleTypeLabel(module.type)} 모듈`;
}

function getModuleSubtitle(module: Module): string {
  const d = module.data;
  if (module.type === "memo") {
    const content = (d as MemoData).content ?? "";
    return content.length > 60 ? content.slice(0, 60) + "…" : content;
  }
  if (module.type === "schedule") {
    const items = (d as ScheduleData).items;
    return `항목 ${items.length}개 (완료: ${items.filter((i) => i.done).length}개)`;
  }
  if (module.type === "brainstorm") {
    const items = (d as BrainstormData).items;
    return `아이디어 ${items.length}개`;
  }
  if (module.type === "link") return (d as LinkData).url ?? "";
  if (module.type === "file") {
    const f = d as FileData;
    return f.fileType ? `${f.fileType} · ${f.fileSize ? Math.round(f.fileSize / 1024) + " KB" : ""}` : "";
  }
  if (module.type === "image") return (d as ImageData).caption ?? "";
  if (module.type === "table") {
    const t = d as TableData;
    return `${t.rowCount}×${t.colCount} 표`;
  }
  return "";
}

export default function ModuleSearch({ isOpen, onClose }: ModuleSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const boards = useCanvasStore((s) => s.boards);
  const activeBoardId = useCanvasStore((s) => s.activeBoardId);
  const setFocusModule = useCanvasStore((s) => s.setFocusModule);
  const setActiveBoard = useCanvasStore((s) => s.setActiveBoard);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmed = query.trim().toLowerCase();

  // 현재 보드를 우선, 나머지 보드도 포함
  const sortedBoards = [
    ...boards.filter((b) => b.id === activeBoardId),
    ...boards.filter((b) => b.id !== activeBoardId),
  ];

  type SearchResult = { module: Module; boardId: string; boardName: string; boardIcon: string };

  const results: SearchResult[] = trimmed
    ? sortedBoards.flatMap((board) =>
        board.modules
          .filter((m) => getModuleText(m).includes(trimmed))
          .map((m) => ({ module: m, boardId: board.id, boardName: board.name, boardIcon: board.icon }))
      ).slice(0, 30)
    : [];

  function handleSelect(result: SearchResult) {
    if (result.boardId !== activeBoardId) {
      setActiveBoard(result.boardId);
    }
    setFocusModule(result.module.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[10vh]"
      style={{ zIndex: 300, background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: "min(560px, 92vw)",
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          maxHeight: "70vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 검색 입력 */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            height: 54,
            borderBottom: results.length > 0 || trimmed ? "1px solid var(--border)" : "none",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 18, color: "var(--text-muted)" }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="모듈 검색…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 16,
              color: "var(--text-primary)",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                color: "var(--text-muted)",
                padding: "4px",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 결과 목록 */}
        {trimmed && (
          <div className="overflow-y-auto">
            {results.length === 0 ? (
              <div
                className="text-center py-10 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                검색 결과 없음
              </div>
            ) : (
              results.map(({ module, boardId, boardName, boardIcon }) => (
                <button
                  key={`${boardId}-${module.id}`}
                  onClick={() => handleSelect({ module, boardId, boardName, boardIcon })}
                  className="w-full flex items-center gap-3 px-4 text-left"
                  style={{
                    minHeight: 56,
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "background 100ms",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--surface-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span style={{ fontSize: 22, flexShrink: 0, width: 28, textAlign: "center" }}>
                    {getModuleTypeLabel(module.type)}
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {getModuleTitle(module)}
                    </span>
                    {getModuleSubtitle(module) && (
                      <span
                        className="text-xs truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {getModuleSubtitle(module)}
                      </span>
                    )}
                  </div>
                  {boardId !== activeBoardId && (
                    <span
                      className="text-xs flex-shrink-0 rounded px-1.5 py-0.5"
                      style={{
                        background: "var(--surface-hover)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {boardIcon} {boardName}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* 힌트 */}
        {!trimmed && (
          <div
            className="flex items-center justify-center gap-4 py-6 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <span>↵ 이동</span>
            <span>Esc 닫기</span>
            <span>전체 보드 검색</span>
          </div>
        )}
      </div>
    </div>
  );
}
