"use client";

import { useCallback, useRef } from "react";
import type { ImageData } from "@/types";
import {
  fileToDataUrl,
  getImageFileFromClipboardEvent,
} from "@/lib/imagePasteClipboard";

interface ImageModuleProps {
  data: ImageData;
  isExpanded: boolean;
  onChange: (data: ImageData) => void;
}

export default function ImageModule({
  data,
  isExpanded,
  onChange,
}: ImageModuleProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteRootRef = useRef<HTMLDivElement>(null);

  const applyDataUrl = useCallback(
    (base64: string) => {
      onChange({ ...data, src: base64 });
    },
    [data, onChange]
  );

  const applyImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const base64 = await fileToDataUrl(file);
      applyDataUrl(base64);
    },
    [applyDataUrl]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void applyImageFile(file);
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const f = getImageFileFromClipboardEvent(e);
      if (f) {
        e.preventDefault();
        e.stopPropagation();
        void applyImageFile(f);
      }
    },
    [applyImageFile]
  );

  if (!isExpanded) {
    return (
      <div
        ref={pasteRootRef}
        role="group"
        aria-label="이미지 모듈"
        tabIndex={0}
        className="flex flex-col gap-1 rounded px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
        onPaste={handlePaste}
      >
        {data.src ? (
          <div
            className="overflow-hidden rounded"
            style={{ height: 80, background: "var(--surface-hover)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.src}
              alt={data.caption || data.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex flex-col items-center justify-center gap-1 rounded"
            style={{
              height: 80,
              background: "var(--surface-hover)",
              border: "1px dashed var(--border-strong)",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 24, opacity: 0.45 }}>🖼</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              클릭하여 파일 선택 · Ctrl+V
            </span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <div
      ref={pasteRootRef}
      role="group"
      aria-label="이미지 모듈"
      tabIndex={0}
      className="flex flex-col gap-2 rounded px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
      onPaste={handlePaste}
    >
      {data.src ? (
        <div className="relative overflow-hidden rounded" style={{ height: 160 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.src}
            alt={data.caption || data.title}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="absolute bottom-2 right-2 rounded-lg px-2 text-xs"
            style={{
              height: 28,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            변경
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="flex flex-col items-center justify-center gap-1 rounded-lg"
          style={{
            height: 120,
            background: "var(--surface-hover)",
            border: "2px dashed var(--border-strong)",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 28 }}>🖼</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            이미지 업로드 · Ctrl+V
          </span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        type="text"
        value={data.caption}
        onChange={(e) => onChange({ ...data, caption: e.target.value })}
        placeholder="이미지 설명 (선택)"
        className="rounded px-2 text-sm"
        style={{
          height: 32,
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          outline: "none",
        }}
      />
    </div>
  );
}
