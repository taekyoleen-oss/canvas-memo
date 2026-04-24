"use client";

import { useCallback, useState } from "react";
import { useCanvasStore } from "@/store/canvas";
import { useAuthStore } from "@/store/auth";

interface CloudSaveButtonProps {
  compact?: boolean;
  variant?: "sidebar" | "drawer";
}

export default function CloudSaveButton({
  compact,
  variant = "sidebar",
}: CloudSaveButtonProps) {
  const { user } = useAuthStore();
  const syncToSupabase = useCanvasStore((s) => s.syncToSupabase);
  const autoSyncStatus = useCanvasStore((s) => s.autoSyncStatus);
  const exportBackupJson = useCanvasStore((s) => s.exportBackupJson);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const onForceSave = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setHint(null);
    try {
      await syncToSupabase(user.id);
      setHint("모든 데이터를 저장했습니다.");
      window.setTimeout(() => setHint(null), 2200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "저장에 실패했습니다.";
      setHint(msg);
      window.setTimeout(() => setHint(null), 5000);
    } finally {
      setLoading(false);
    }
  }, [user, syncToSupabase]);

  const onExportBackup = useCallback(() => {
    try {
      const json = exportBackupJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindcanvas-backup-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setHint("백업 파일을 내려받았습니다.");
      window.setTimeout(() => setHint(null), 2000);
    } catch {
      setHint("내보내기에 실패했습니다.");
      window.setTimeout(() => setHint(null), 3000);
    }
  }, [exportBackupJson]);

  if (!user) return null;

  const syncLabel =
    autoSyncStatus === "syncing"
      ? "저장 중…"
      : autoSyncStatus === "pending"
        ? "변경 감지됨"
        : autoSyncStatus === "error"
          ? "동기화 오류"
          : "자동 저장됨";

  const syncDot =
    autoSyncStatus === "syncing"
      ? "#f59e0b"
      : autoSyncStatus === "pending"
        ? "#6366f1"
        : autoSyncStatus === "error"
          ? "#ef4444"
          : "#22c55e";

  const forceSaveLabel = loading ? "저장 중…" : "지금 저장";
  const disabled = loading;

  if (compact) {
    return (
      <div className="flex flex-col items-center" style={{ padding: "8px 0", gap: 6 }}>
        {/* 자동 저장 상태 표시 점 */}
        <div
          title={syncLabel}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: syncDot,
            marginBottom: 2,
          }}
        />
        {/* 강제 저장 버튼 */}
        <button
          type="button"
          onClick={onForceSave}
          disabled={disabled}
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 40,
            height: 40,
            border: "1px solid var(--border)",
            background: "var(--surface-hover)",
            cursor: disabled ? "wait" : "pointer",
            opacity: disabled ? 0.65 : 1,
            fontSize: 18,
          }}
          title={forceSaveLabel}
          aria-label={forceSaveLabel}
        >
          ☁️
        </button>
        {/* 백업 내보내기 버튼 */}
        <button
          type="button"
          onClick={onExportBackup}
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 40,
            height: 40,
            border: "1px solid var(--border)",
            background: "var(--surface-hover)",
            cursor: "pointer",
            fontSize: 16,
          }}
          title="JSON 백업 내보내기"
          aria-label="JSON 백업 내보내기"
        >
          💾
        </button>
        {hint && (
          <span
            className="text-center"
            style={{
              fontSize: 9,
              color: "var(--text-muted)",
              marginTop: 2,
              padding: "0 4px",
              lineHeight: 1.2,
              maxWidth: 56,
              wordBreak: "break-word",
            }}
          >
            {hint}
          </span>
        )}
      </div>
    );
  }

  const pad = variant === "drawer" ? "10px 16px" : "10px 12px";

  return (
    <div style={{ padding: pad, borderBottom: "1px solid var(--border)" }}>
      {/* 자동 저장 상태 표시 */}
      <div
        className="flex items-center gap-1.5 mb-2"
        style={{ fontSize: 11, color: "var(--text-muted)" }}
      >
        <span
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: syncDot,
            flexShrink: 0,
          }}
        />
        {syncLabel}
      </div>
      {/* 강제 저장 버튼 */}
      <button
        type="button"
        onClick={onForceSave}
        disabled={disabled}
        className="w-full rounded-lg font-medium"
        style={{
          height: 38,
          border: "1px solid var(--primary)",
          background: "var(--primary-soft)",
          color: "var(--primary)",
          cursor: disabled ? "wait" : "pointer",
          fontSize: 13,
          opacity: disabled ? 0.7 : 1,
          marginBottom: 6,
        }}
      >
        {forceSaveLabel}
      </button>
      {/* 백업 내보내기 버튼 */}
      <button
        type="button"
        onClick={onExportBackup}
        className="w-full rounded-lg font-medium"
        style={{
          height: 34,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-secondary)",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        JSON 백업 내보내기
      </button>
      {hint && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            color: "var(--text-muted)",
            lineHeight: 1.35,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
