"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
import { useCanvasStore } from "@/store/canvas";
import { normalizeBoardCategory } from "@/lib/boardCategory";
import MemoModule from "@/components/modules/MemoModule";
import ScheduleModule from "@/components/modules/ScheduleModule";
import ImageModule from "@/components/modules/ImageModule";
import LinkModule from "@/components/modules/LinkModule";
import FileModule from "@/components/modules/FileModule";
import TableModule from "@/components/modules/TableModule";
import BrainstormModule, {
  type BrainstormCanvasLinkSummary,
} from "@/components/modules/BrainstormModule";
import { MODULE_TYPE_ICON, cardTitle } from "./organizedPreview";
import OrganizedModuleMenu from "./OrganizedModuleMenu";

interface ModuleEditOverlayProps {
  boardId: string;
  /** 편집할 모듈 id (스토어에서 항상 최신 모듈을 다시 읽는다 — 외부 편집 반영) */
  moduleId: string;
  onClose: () => void;
}

function connectionPeerTitle(other: Module | undefined): string {
  if (!other) return "모듈";
  const d = other.data as { title?: string; fileName?: string; url?: string };
  if (typeof d.title === "string" && d.title.trim()) return d.title.trim();
  if (other.type === "file") return d.fileName || "파일";
  if (other.type === "link") return d.url || "링크";
  return cardTitle(other);
}

/**
 * 기존 모듈 컴포넌트(MemoModule 등)를 expanded 모드로 모달에 렌더한다.
 * store 액션(updateModule)을 그대로 호출 → 저장/Supabase 동기화 경로 동일.
 * 모듈 컴포넌트 자체는 캔버스 변환 밖에서도 단독 렌더 가능하므로 수정 없이 재사용.
 */
export default function ModuleEditOverlay({
  boardId,
  moduleId,
  onClose,
}: ModuleEditOverlayProps) {
  const updateModule = useCanvasStore((s) => s.updateModule);
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const mod = board?.modules.find((m) => m.id === moduleId);
  const [titleEdit, setTitleEdit] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isTopicNote =
    board != null && normalizeBoardCategory(board) === "topic_notes";

  const brainstormCanvasLinks: BrainstormCanvasLinkSummary[] = useMemo(() => {
    if (!mod || mod.type !== "brainstorm" || !board) return [];
    return board.connections
      .filter((c) => c.fromModuleId === mod.id || c.toModuleId === mod.id)
      .map((c) => {
        const otherId =
          c.fromModuleId === mod.id ? c.toModuleId : c.fromModuleId;
        const other = board.modules.find((m) => m.id === otherId);
        return {
          connectionId: c.id,
          otherTitle: connectionPeerTitle(other),
          label: c.label || "",
          outgoing: c.fromModuleId === mod.id,
        };
      });
  }, [board, mod]);

  if (typeof document === "undefined" || !mod) return null;

  function handleDataChange(data: Module["data"]) {
    updateModule(boardId, moduleId, { data });
  }

  function handleTitleChange(title: string) {
    if (!mod) return;
    updateModule(boardId, moduleId, { data: { ...mod.data, title } });
  }

  function renderBody() {
    if (!mod) return null;
    switch (mod.type) {
      case "memo":
        return (
          <MemoModule
            data={mod.data as MemoData}
            isExpanded
            onChange={handleDataChange}
            variant={isTopicNote ? "note" : "default"}
          />
        );
      case "schedule":
        return (
          <ScheduleModule
            data={mod.data as ScheduleData}
            isExpanded
            onChange={handleDataChange}
          />
        );
      case "image":
        return (
          <ImageModule
            data={mod.data as ImageData}
            isExpanded
            onChange={handleDataChange}
          />
        );
      case "link":
        return (
          <LinkModule
            data={mod.data as LinkData}
            isExpanded
            onChange={handleDataChange}
          />
        );
      case "file":
        return (
          <FileModule
            data={mod.data as FileData}
            moduleId={mod.id}
            isExpanded
            onChange={handleDataChange}
          />
        );
      case "table":
        return (
          <TableModule
            data={mod.data as TableData}
            isExpanded
            onChange={handleDataChange}
          />
        );
      case "brainstorm":
        return (
          <BrainstormModule
            data={mod.data as BrainstormData}
            isExpanded
            onChange={handleDataChange}
            canvasLinkSummaries={brainstormCanvasLinks}
          />
        );
      default:
        return null;
    }
  }

  const title = (mod.data as { title?: string }).title ?? "";

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 300, background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-2xl"
        style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          width: "min(640px, 100%)",
          maxHeight: "88vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${cardTitle(mod)} 편집`}
      >
        <div
          className="flex flex-shrink-0 items-center gap-2 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }} aria-hidden>
            {MODULE_TYPE_ICON[mod.type]}
          </span>
          {titleEdit ? (
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => setTitleEdit(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setTitleEdit(false);
                }
              }}
              autoFocus
              placeholder={isTopicNote && mod.type === "memo" ? "노트 제목" : "제목"}
              className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
              style={{ fontSize: 16, color: "var(--text-primary)", border: "none" }}
            />
          ) : (
            <span
              className="min-w-0 flex-1 cursor-text truncate font-semibold"
              style={{ fontSize: 16, color: "var(--text-primary)" }}
              onClick={() => setTitleEdit(true)}
              title="클릭: 제목 편집"
            >
              {cardTitle(mod)}
            </span>
          )}
          {/* 제목 옆 ⋮ — 캔버스와 동일한 모듈 액션. 삭제 시 오버레이도 닫기 */}
          <OrganizedModuleMenu
            boardId={boardId}
            moduleId={moduleId}
            onDeleted={onClose}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 44,
              height: 44,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: 0 }}>
          {renderBody()}
        </div>
      </div>
    </div>,
    document.body
  );
}
