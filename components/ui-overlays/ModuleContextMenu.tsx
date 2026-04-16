"use client";

interface ModuleContextMenuProps {
  isOpen: boolean;
  anchorRect?: DOMRect | null;
  onClose: () => void;
  onConnect: () => void;
  onColorChange: () => void;
  onCopy: () => void;
  onPaste: () => void;
  hasPasteTarget: boolean;
  onToggleMinimize: () => void;
  isMinimized: boolean;
  onDelete: () => void;
}

interface MenuItem {
  icon: string;
  label: string;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const MENU_WIDTH = 180;
const MENU_HEIGHT = 44 * 6; // 6 items × 44px

export default function ModuleContextMenu({
  isOpen,
  anchorRect,
  onClose,
  onConnect,
  onColorChange,
  onCopy,
  onPaste,
  hasPasteTarget,
  onToggleMinimize,
  isMinimized,
  onDelete,
}: ModuleContextMenuProps) {
  if (!isOpen) return null;

  const items: MenuItem[] = [
    { icon: "🔗", label: "연결하기",                      action: onConnect },
    { icon: "🎨", label: "색상 변경",                     action: onColorChange },
    { icon: "📋", label: "복사",                          action: onCopy },
    { icon: "📌", label: "붙여넣기",                      action: onPaste, disabled: !hasPasteTarget },
    { icon: isMinimized ? "▣" : "─", label: isMinimized ? "제목만 보기 해제" : "제목만 보기", action: onToggleMinimize },
    { icon: "🗑",  label: "삭제",                         action: onDelete, danger: true },
  ];

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
    if (top + MENU_HEIGHT > vh - 8) top = anchorRect.top - MENU_HEIGHT - 4;

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
                key={item.label}
                onClick={() => !item.disabled && handleItemClick(item.action)}
                disabled={item.disabled}
                className="flex items-center gap-3 px-5"
                style={{
                  height: 52,
                  background: "transparent",
                  border: "none",
                  cursor: item.disabled ? "default" : "pointer",
                  color: item.danger ? "#EF4444" : item.disabled ? "var(--text-muted)" : "var(--text-primary)",
                  fontSize: 15,
                  textAlign: "left",
                  opacity: item.disabled ? 0.45 : 1,
                }}
              >
                <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>
                  {item.icon}
                </span>
                {item.label}
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
              key={item.label}
              onClick={() => !item.disabled && handleItemClick(item.action)}
              disabled={item.disabled}
              className="flex items-center gap-3 px-4 w-full"
              style={{
                height: 44,
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--border)",
                cursor: item.disabled ? "default" : "pointer",
                color: item.danger ? "#EF4444" : item.disabled ? "var(--text-muted)" : "var(--text-primary)",
                opacity: item.disabled ? 0.45 : 1,
                fontSize: 14,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>
                {item.icon}
              </span>
              {item.label}
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
