"use client";

import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Board } from "@/types";
import {
  buildOrganizedEntries,
  sortEntries,
  entryKeyOf,
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

/**
 * 정렬 종류와 무관하게 모든 카드를 드래그로 재배치할 수 있는 래퍼.
 * 좌측 그립 핸들로만 드래그가 시작돼(카드 본문 클릭·⋮ 메뉴와 충돌 없음) 모바일 스크롤을 막지 않는다.
 */
function SortableEntry({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className="flex items-stretch gap-1"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="flex flex-shrink-0 items-center justify-center rounded-lg"
        style={{
          width: 24,
          minHeight: 44,
          alignSelf: "stretch",
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
          fontSize: 14,
          lineHeight: 1,
        }}
        aria-label="드래그하여 순서 변경"
        title="드래그하여 순서 변경"
        {...attributes}
        {...listeners}
      >
        <span aria-hidden>⠿</span>
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * 정리 뷰 — 일반 스크롤 DOM(캔버스 transform 아님). 모듈 position 변경 없음.
 * PC: auto-fill 그리드 / 모바일: 1열. 좌측 그립으로 카드 순서를 직접 바꿀 수 있고,
 * 순서를 바꾸면 정렬 기준이 자동으로 "사용자정의(custom)"로 전환·저장된다.
 */
export default function OrganizedView({ board, onSwitchToCanvas }: OrganizedViewProps) {
  // 정렬 상태(보드별). 미지정이면 기본값.
  const sortKey =
    useCanvasStore((s) => s.organizedView.sortKeyByBoardId[board.id]) ??
    "createdDesc";
  // 사용자정의 순서(보드별). custom 정렬일 때 사용.
  const customOrder = useCanvasStore(
    (s) => s.organizedView.customOrderByBoardId[board.id]
  );
  const setCustomOrder = useCanvasStore((s) => s.setCustomOrder);

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
    return sortEntries(built, sortKey, customOrder);
    // organizedTick 의존: 대표 수동 지정 변경 시 재계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    board.modules,
    board.connections,
    board.groups,
    board.id,
    sortKey,
    customOrder,
    organizedTick,
  ]);

  const sensors = useSensors(
    // 6px 이상 움직여야 드래그 시작 → 핸들 탭/짧은 클릭과 구분
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const itemIds = useMemo(() => entries.map(entryKeyOf), [entries]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    // 현재 보이는 전체 순서를 기준으로 재배치 → 그대로 사용자정의 순서로 저장.
    // (setCustomOrder 내부에서 정렬 기준을 "custom"으로 자동 전환)
    setCustomOrder(board.id, arrayMove(itemIds, oldIndex, newIndex));
  }

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
            위 도구 모음에서 메모·일정·이미지 등을 바로 추가할 수 있어요.
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemIds} strategy={rectSortingStrategy}>
            <div
              className="organized-grid mx-auto w-full p-4"
              style={{ maxWidth: 1400 }}
            >
              {entries.map((entry) => {
                const key = entryKeyOf(entry);
                return (
                  <SortableEntry key={key} id={key}>
                    {entry.kind === "group" ? (
                      <OrganizedGroupCard
                        boardId={board.id}
                        entry={entry}
                        onExpand={openGroup}
                      />
                    ) : (
                      <OrganizedCard
                        boardId={board.id}
                        module={entry.anchor}
                        onOpen={(m) => openEditor(m.id)}
                      />
                    )}
                  </SortableEntry>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
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
