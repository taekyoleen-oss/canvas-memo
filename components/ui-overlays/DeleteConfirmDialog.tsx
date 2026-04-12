"use client";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 100, background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 flex flex-col gap-4 w-full max-w-sm"
        style={{
          background: "var(--surface-elevated)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            이 모듈을 삭제할까요?
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            연결된 커넥션도 함께 삭제됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg font-medium"
            style={{
              height: 44,
              background: "var(--surface-hover)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            취소
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 rounded-lg font-medium"
            style={{
              height: 44,
              background: "#EF4444",
              border: "none",
              color: "#FFFFFF",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
