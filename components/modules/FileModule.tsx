"use client";

import { useRef, useState } from "react";
import type { FileData } from "@/types";
import { useAuthStore } from "@/store/auth";
import { uploadFileToStorage } from "@/lib/supabase/fileUpload";

interface FileModuleProps {
  data: FileData;
  moduleId: string;
  isExpanded: boolean;
  onChange: (data: FileData) => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (!mimeType) return "📎";
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType.startsWith("video/")) return "🎥";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("compress")) return "🗜";
  if (mimeType.includes("text/")) return "📃";
  return "📎";
}

function openFile(src: string, fileType: string) {
  if (!src) return;
  // Supabase Storage URL or any http URL → 직접 열기
  if (src.startsWith("http")) {
    window.open(src, "_blank", "noopener,noreferrer");
    return;
  }
  // base64 데이터 URL → Blob URL 생성
  try {
    const parts = src.split(",");
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: fileType });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch {
    console.warn("파일을 열 수 없습니다.");
  }
}

export default function FileModule({ data, moduleId, isExpanded, onChange }: FileModuleProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuthStore();

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      let src = "";

      // 로그인 상태이면 Supabase Storage 시도
      if (user?.id) {
        const url = await uploadFileToStorage(user.id, moduleId, file);
        if (url) {
          src = url;
        }
      }

      // Storage 업로드 실패 또는 미로그인 → base64 폴백
      if (!src) {
        src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      onChange({
        ...data,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        src,
      });
    } finally {
      setUploading(false);
    }
  }

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!data.src) return;
    openFile(data.src, data.fileType);
  }

  const icon = getFileIcon(data.fileType);

  if (!isExpanded) {
    return (
      <div className="px-3 py-2">
        {data.fileName ? (
          <button
            onClick={handleOpen}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5"
            style={{
              background: "var(--surface-hover)",
              border: "1px solid var(--border)",
              cursor: data.src ? "pointer" : "default",
            }}
          >
            <span style={{ fontSize: 20 }}>{icon}</span>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="text-xs font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {data.fileName}
              </span>
              {data.fileSize > 0 && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatFileSize(data.fileSize)}
                </span>
              )}
            </div>
            {data.src && (
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>↗</span>
            )}
          </button>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            파일을 업로드하세요
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />

      {data.fileName && (
        <div
          className="flex items-center gap-3 rounded-lg px-3 py-2"
          style={{
            background: "var(--surface-hover)",
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 28 }}>{icon}</span>
          <div className="flex flex-col min-w-0 flex-1">
            <span
              className="text-sm font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {data.fileName}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {data.fileType || "알 수 없는 형식"}
              {data.fileSize > 0 ? ` · ${formatFileSize(data.fileSize)}` : ""}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={uploading}
          className="rounded-lg text-sm font-medium"
          style={{
            flex: 1,
            height: 36,
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            cursor: uploading ? "wait" : "pointer",
            color: "var(--text-primary)",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "업로드 중…" : data.fileName ? "파일 변경" : "📂 파일 업로드"}
        </button>

        {data.src && (
          <button
            onClick={handleOpen}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-lg text-sm font-medium"
            style={{
              flex: 1,
              height: 36,
              background: "var(--primary)",
              border: "none",
              cursor: "pointer",
              color: "var(--primary-fg)",
            }}
          >
            파일 열기 ↗
          </button>
        )}
      </div>
    </div>
  );
}
