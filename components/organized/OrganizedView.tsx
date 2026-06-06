"use client";

import { useMemo } from "react";
import type { Board, DisplayEntry, OrganizedSortKey } from "@/types";
import {
  buildOrganizedEntries,
  sortEntries,
} from "@/lib/canvas/organizedGroups";
import { useCanvasStore } from "@/store/canvas";
import { useOrganizedOverlayStore } from "@/store/organizedOverlay";
import { loadViewPrefs } from "@/lib/storage/viewPrefs";
import OrganizedCard from "./OrganizedCard";
import OrganizedGroupCard from "./OrganizedGroupCard";
import GroupExpandPopup from "./GroupExpandPopup";
import ModuleEditOverlay from "./ModuleEditOverlay";

interface OrganizedViewProps {
  board: Board;
  /** 캔버스로 전환 (빈 보드 안내 등) */
  onSwitchToCanvas: () => void;
}

function entryKey(entry: DisplayEntry): string {
  return entry.kind === "group"
    ? `g:${entry.groupKey ?? entry.anchor.id}`
    : `s:${entry.anchor.id}`;
}

/**
 * 정리 뷰 — 일반 스크롤 DOM(캔버스 transform 아님). 모듈 position 변경 없음.
 * PC: auto-fill 그리드 / 모바일: 1열.
 */
export default function OrganizedView({ board, onSwitchToCanvas }: OrganizedViewProps) {
  // 정렬 상태(보드별). 미지정이면 기본값.
  const sortKey: OrganizedSortKey =
    useCanvasStore((s) => s.organizedView.sortKeyByBoardId[board.id]) ??
    "createdDesc";

  // primary(대표 수동 지정)는 스토어 상태에 미보관 → viewPrefs에서 직접 읽음.
  // setGroupPrimary 호출 시 organizedView 참조가 새로 만들어져 재구독/재계산됨.
  const organizedTick = useCanvasStore((s) => s.organizedView);

  const expandedEntry = useOrganizedOverlayStore((s) => s.expandedEntry);
  const editingModuleId = useOrganizedOverlayStore((s) => s.editingModuleId);
  const openGroup = useOrganizedOverlayStore((s) => s.openGroup);
  const openEditor = useOrganizedOverlayStore((s) => s.openEditor);
  const closeGroup = useOrganizedOverlayStore((s) => s.closeGroup);
  const closeEditor = useOrganizedOverlayStore((s) => s.closeEditor);

  const entries = useMemo(() => {
    const prefs = loadViewPrefs();
    const built = buildOrganizedEntries({
      modules: board.modules,
      connections: board.connections,
      groups: board.groups,
      primaryOverrides: prefs.primary[board.id],
    });
    return sortEntries(built, sortKey);
    // organizedTick 의존: 대표 수동 지정 변경 시 재계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.modules, board.connections, board.groups, board.id, sortKey, organizedTick]);

  const isEmpty = board.modules.length === 0;

  return (
    <div
      className="h-full w-full overflow-y-auto"
      style={{ background: "var(--background)", overscrollBehavior: "contain" }}
    >
      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
          <span style={{ fontSize: 44, opacity: 0.6 }} aria-hidden>
            🗂
          </span>
          <p
            className="text-center text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            이 보드에는 아직 모듈이 없어요.
            <br />
            캔버스에서 메모·일정·이미지 등을 추가해 보세요.
          </p>
          <button
            type="button"
            onClick={onSwitchToCanvas}
            className="rounded-xl px-5 font-semibold"
            style={{
              height: 44,
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            캔버스로 전환
          </button>
        </div>
      ) : (
        <div
          className="organized-grid mx-auto w-full p-4"
          style={{ maxWidth: 1400 }}
        >
          {entries.map((entry) =>
            entry.kind === "group" ? (
              <OrganizedGroupCard
                key={entryKey(entry)}
                entry={entry}
                onExpand={openGroup}
              />
            ) : (
              <OrganizedCard
                key={entryKey(entry)}
                module={entry.anchor}
                onOpen={(m) => openEditor(m.id)}
              />
            )
          )}
        </div>
      )}

      {expandedEntry ? (
        <GroupExpandPopup
          entry={expandedEntry}
          boardId={board.id}
          onClose={closeGroup}
          onOpenMember={(m) => openEditor(m.id)}
        />
      ) : null}

      {editingModuleId ? (
        <ModuleEditOverlay
          boardId={board.id}
          moduleId={editingModuleId}
          onClose={closeEditor}
        />
      ) : null}

      <style>{`
        .organized-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        @media (min-width: 768px) {
          .organized-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 16px;
            align-items: start;
          }
        }
      `}</style>
    </div>
  );
}
