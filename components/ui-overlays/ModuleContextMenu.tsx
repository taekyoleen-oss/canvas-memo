"use client";

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
}: ModuleContextMenuProps) {
  if (!isOpen) return null;

  const items: MenuItem[] = [
    { id: "connect", icon: "🔗", label: "연결하기", action: onConnect },
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

  const menuHeight = items.reduce(
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

  return (
    <>
      {/* 모바일: 바텀시트 */}
      <div className="md:hidden">
        <div
          className="fixed inset-0"
          style={{ zIndex: 90, background: "rgba(0,0,0,0.4)" }}
          onClick={onClose}
        />
        <div
          className="fixed bottom-0 left-0 right-0 rounded-t-2xl pb-6"
          style={{
            zIndex: 91,
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
          style={{ zIndex: 90 }}
          onClick={onClose}
        />
        <div
          className="fixed rounded-xl overflow-hidden"
          style={{
            zIndex: 91,
            top: pos.top,
            left: pos.left,
            minWidth: MENU_WIDTH,
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
            animation: "ctxIn 120ms ease-out",
          }}
        >
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
