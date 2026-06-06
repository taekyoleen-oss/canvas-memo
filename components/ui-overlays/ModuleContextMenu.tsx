"use client";

import { useEffect, useState } from "react";

export type MoveBoardCategory = "memo_schedule" | "thinking" | "topic_notes";

export interface MoveBoardOption {
  id: string;
  label: string;
  category: MoveBoardCategory;
  categoryLabel: string;
  disabled: boolean;
}

interface ModuleContextMenuProps {
  isOpen: boolean;
  anchorRect?: DOMRect | null;
  onClose: () => void;
  onConnect: () => void;
  onColorChange: () => void;
  /** 캔버스에 동일 모듈(크기·위치·스타일·연결 제외 복제본) 추가 */
  onDuplicateModule: () => void;
  /** 모듈 데이터만 내부 클립보드에 저장 → 아래 「내용 붙여넣기」로 새 카드 생성 */
  onCopyContent: () => void;
  onPasteContent: () => void;
  hasPasteTarget: boolean;
  onToggleMinimize: () => void;
  isMinimized: boolean;
  onDelete: () => void;
  /** 세 카테고리(메모·일정 / 생각정리 / 주제별) 전체에서 이동 가능한 보드 */
  moveBoardOptions?: MoveBoardOption[];
  onMoveToBoard?: (targetBoardId: string) => void;
  /** false면 「연결하기」 항목을 숨긴다(정리 뷰 등 캔버스 좌표가 없는 곳). 기본 true */
  showConnect?: boolean;
  /** 배경/메뉴 z-index 기준값(기본 90). 더 높은 오버레이 위에 띄울 때 올린다. */
  zIndexBase?: number;
}

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  /** 보조 설명 — 복사 종류 구분용 */
  subtitle?: string;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const MENU_WIDTH = 220;
const MENU_ROW_BASE = 44;
const MENU_ROW_TALL = 52;
/** 카테고리별 그룹 + 보드 리스트 영역(대략) */
const MOVE_BLOCK_HEIGHT = 220;

export default function ModuleContextMenu({
  isOpen,
  anchorRect,
  onClose,
  onConnect,
  onColorChange,
  onDuplicateModule,
  onCopyContent,
  onPasteContent,
  hasPasteTarget,
  onToggleMinimize,
  isMinimized,
  onDelete,
  moveBoardOptions,
  onMoveToBoard,
  showConnect = true,
  zIndexBase = 90,
}: ModuleContextMenuProps) {
  const [moveTargetId, setMoveTargetId] = useState("");

  const hasMoveBlock =
    !!onMoveToBoard &&
    Array.isArray(moveBoardOptions) &&
    moveBoardOptions.some((o) => !o.disabled);

  useEffect(() => {
    if (isOpen) setMoveTargetId("");
  }, [isOpen]);

  if (!isOpen) return null;

  const items: MenuItem[] = [
    ...(showConnect
      ? [{ id: "connect", icon: "🔗", label: "연결하기", action: onConnect }]
      : []),
    { id: "color", icon: "🎨", label: "색상 변경", action: onColorChange },
    {
      id: "dup",
      icon: "📑",
      label: "모듈 전체 복제",
      subtitle: "크기·위치·모양·내용 그대로 복사본 추가",
      action: onDuplicateModule,
    },
    {
      id: "copy-content",
      icon: "📄",
      label: "내용만 복사",
      subtitle: "같은 종류 새 카드에 넣을 데이터만 저장",
      action: onCopyContent,
    },
    {
      id: "paste-content",
      icon: "📌",
      label: "내용 붙여넣기",
      subtitle: "「내용만 복사」로 저장한 것으로 새 모듈",
      action: onPasteContent,
      disabled: !hasPasteTarget,
    },
    {
      id: "minimize",
      icon: isMinimized ? "▣" : "─",
      label: isMinimized ? "제목만 보기 해제" : "제목만 보기",
      action: onToggleMinimize,
    },
    { id: "delete", icon: "🗑", label: "삭제", action: onDelete, danger: true },
  ];

  const menuHeight =
    (hasMoveBlock ? MOVE_BLOCK_HEIGHT : 0) +
    items.reduce(
      (h, it) => h + (it.subtitle ? MENU_ROW_TALL : MENU_ROW_BASE),
      0
    );

  function handleItemClick(action: () => void) {
    action();
    onClose();
  }

  // ⋮ 버튼의 실제 화면 위치로부터 메뉴 좌표 계산
  function calcMenuPos(): { top: number; left: number } {
    if (!anchorRect) return { top: "50%" as unknown as number, left: "50%" as unknown as number };

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 기본: 버튼 오른쪽 아래
    let left = anchorRect.right + 4;
    let top  = anchorRect.bottom + 4;

    // 오른쪽 잘림 방지
    if (left + MENU_WIDTH > vw - 8) left = anchorRect.left - MENU_WIDTH - 4;
    // 아래 잘림 방지
    if (top + menuHeight > vh - 8) top = anchorRect.top - menuHeight - 4;

    // 최소값 클램핑
    left = Math.max(8, left);
    top  = Math.max(8, top);

    return { top, left };
  }

  const pos = calcMenuPos();

  const groupedOptions = (() => {
    const groups: MoveBoardCategory[] = ["memo_schedule", "thinking", "topic_notes"];
    return groups
      .map((cat) => {
        const inCat = (moveBoardOptions ?? []).filter((o) => o.category === cat);
        return { cat, inCat };
      })
      .filter((g) => g.inCat.length > 0);
  })();

  const moveBlock =
    hasMoveBlock && onMoveToBoard ? (
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="px-5 md:px-3"
        style={{
          borderBottom: "1px solid var(--border)",
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            다른 보드로 이동
          </p>
          <button
            type="button"
            disabled={!moveTargetId}
            onClick={() => {
              if (moveTargetId) onMoveToBoard(moveTargetId);
              onClose();
            }}
            className="rounded-md font-medium"
            style={{
              padding: "4px 10px",
              fontSize: 12,
              background: moveTargetId ? "var(--primary)" : "var(--surface-hover)",
              color: moveTargetId ? "var(--primary-fg)" : "var(--text-muted)",
              border: "1px solid var(--border)",
              cursor: moveTargetId ? "pointer" : "not-allowed",
            }}
          >
            이동
          </button>
        </div>
        <div
          style={{
            maxHeight: 220,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {groupedOptions.map(({ cat, inCat }) => (
            <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  padding: "2px 4px",
                }}
              >
                {inCat[0].categoryLabel}
              </div>
              {inCat.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    if (o.disabled) return;
                    setMoveTargetId(o.id);
                  }}
                  style={{
                    textAlign: "left",
                    padding: "7px 10px",
                    borderRadius: 8,
                    border:
                      moveTargetId === o.id
                        ? "1px solid var(--primary)"
                        : "1px solid transparent",
                    background:
                      moveTargetId === o.id ? "var(--surface-hover)" : "transparent",
                    cursor: o.disabled ? "not-allowed" : "pointer",
                    color: o.disabled ? "var(--text-muted)" : "var(--text-primary)",
                    opacity: o.disabled ? 0.55 : 1,
                    fontSize: 13,
                  }}
                  title={o.disabled ? "이 보드는 해당 모듈 유형을 받을 수 없어요" : undefined}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <>
      {/* 모바일: 바텀시트 */}
      <div className="md:hidden">
        <div
          className="fixed inset-0"
          style={{ zIndex: zIndexBase, background: "rgba(0,0,0,0.4)" }}
          onClick={onClose}
        />
        <div
          className="fixed bottom-0 left-0 right-0 rounded-t-2xl pb-6"
          style={{
            zIndex: zIndexBase + 1,
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            animation: "slideUp 300ms ease-out",
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          }}
        >
          <div
            className="w-10 h-1 rounded-full mx-auto my-3"
            style={{ background: "var(--border-strong)" }}
          />
          <div className="flex flex-col">
            {moveBlock}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => !item.disabled && handleItemClick(item.action)}
                disabled={item.disabled}
                className="flex items-start gap-3 px-5 w-full"
                style={{
                  minHeight: item.subtitle ? 58 : 52,
                  paddingTop: item.subtitle ? 10 : 14,
                  paddingBottom: item.subtitle ? 10 : 14,
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  cursor: item.disabled ? "default" : "pointer",
                  color: item.danger ? "#EF4444" : item.disabled ? "var(--text-muted)" : "var(--text-primary)",
                  textAlign: "left",
                  opacity: item.disabled ? 0.45 : 1,
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    width: 28,
                    textAlign: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {item.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{item.label}</span>
                  {item.subtitle ? (
                    <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", lineHeight: 1.35 }}>
                      {item.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PC: ⋮ 버튼 옆 팝오버 */}
      <div className="hidden md:block">
        {/* 배경 클릭 시 닫기 */}
        <div
          className="fixed inset-0"
          style={{ zIndex: zIndexBase }}
          onClick={onClose}
        />
        <div
          className="fixed rounded-xl overflow-hidden"
          style={{
            zIndex: zIndexBase + 1,
            top: pos.top,
            left: pos.left,
            minWidth: MENU_WIDTH,
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
            animation: "ctxIn 120ms ease-out",
          }}
        >
          {moveBlock}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => !item.disabled && handleItemClick(item.action)}
              disabled={item.disabled}
              className="flex items-start gap-3 px-4 w-full"
              style={{
                minHeight: item.subtitle ? MENU_ROW_TALL : MENU_ROW_BASE,
                paddingTop: item.subtitle ? 8 : 10,
                paddingBottom: item.subtitle ? 8 : 10,
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--border)",
                cursor: item.disabled ? "default" : "pointer",
                color: item.danger ? "#EF4444" : item.disabled ? "var(--text-muted)" : "var(--text-primary)",
                opacity: item.disabled ? 0.45 : 1,
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  width: 22,
                  textAlign: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {item.icon}
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                {item.subtitle ? (
                  <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", lineHeight: 1.35 }}>
                    {item.subtitle}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes ctxIn {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </>
  );
}
