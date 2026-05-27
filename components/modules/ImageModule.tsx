"use client";

import { useCallback, useRef } from "react";
import type { ImageData } from "@/types";
import {
  fileToDataUrl,
  getImageFileFromClipboardEvent,
} from "@/lib/imagePasteClipboard";
import { appendImageSrcs, getImageSrcs, removeImageAt } from "@/lib/imageData";

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

  const srcs = getImageSrcs(data);

  const applyFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (list.length === 0) return;
      const urls = await Promise.all(list.map(fileToDataUrl));
      onChange(appendImageSrcs(data, urls));
    },
    [data, onChange]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;
    void applyFiles(files);
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const f = getImageFileFromClipboardEvent(e);
      if (f) {
        e.preventDefault();
        e.stopPropagation();
        void applyFiles([f]);
      }
    },
    [applyFiles]
  );

  function handleRemoveAt(index: number) {
    onChange(removeImageAt(data, index));
  }

  // ── 접힌 상태: 1~4 분할 미리보기 + 추가장수 ─────────────────────────
  if (!isExpanded) {
    const previewSrcs = srcs.slice(0, 4);
    const remaining = srcs.length - previewSrcs.length;
    return (
      <div
        ref={pasteRootRef}
        role="group"
        aria-label="이미지 모듈"
        tabIndex={0}
        className="flex flex-col gap-1 rounded px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
        onPaste={handlePaste}
      >
        {srcs.length > 0 ? (
          <div
            className="relative overflow-hidden rounded"
            style={{
              height: 90,
              background: "var(--surface-hover)",
              display: "grid",
              gridTemplateColumns: previewSrcs.length > 1 ? "1fr 1fr" : "1fr",
              gridTemplateRows: previewSrcs.length > 2 ? "1fr 1fr" : "1fr",
              gap: 2,
            }}
          >
            {previewSrcs.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={data.caption || data.title || `이미지 ${i + 1}`}
                className="h-full w-full object-cover"
              />
            ))}
            {remaining > 0 && (
              <span
                className="pointer-events-none absolute bottom-1 right-1 rounded px-1.5 text-[10px] font-semibold"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                }}
              >
                +{remaining}
              </span>
            )}
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
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              클릭하여 파일 선택 · Ctrl+V
            </span>
          </button>
        )}
        {data.description ? (
          <p
            className="text-xs"
            style={{
              color: "var(--text-secondary)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              wordBreak: "break-word",
            }}
          >
            {data.description}
          </p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // ── 펼친 상태: 2열 그리드 + 캡션 + 메모 ─────────────────────────────
  return (
    <div
      ref={pasteRootRef}
      role="group"
      aria-label="이미지 모듈"
      tabIndex={0}
      className="flex flex-col gap-2 rounded px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
      onPaste={handlePaste}
    >
      {srcs.length > 0 ? (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: srcs.length === 1 ? "1fr" : "1fr 1fr",
          }}
        >
          {srcs.map((src, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded"
              style={{
                height: srcs.length === 1 ? 200 : 120,
                background: "var(--surface-hover)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={data.caption || data.title || `이미지 ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveAt(i);
                }}
                className="absolute top-1 right-1 rounded-full"
                style={{
                  width: 22,
                  height: 22,
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="이 이미지 제거"
                aria-label="이미지 제거"
              >
                ✕
              </button>
            </div>
          ))}
          {/* 추가 버튼 — 그리드 마지막 슬롯 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex flex-col items-center justify-center gap-1 rounded"
            style={{
              height: srcs.length === 1 ? 80 : 120,
              gridColumn: srcs.length === 1 ? "1 / -1" : undefined,
              background: "var(--surface-hover)",
              border: "1px dashed var(--border-strong)",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
            title="이미지 더 추가"
          >
            <span style={{ fontSize: 20 }}>＋</span>
            <span>이미지 추가 · Ctrl+V</span>
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
            이미지 업로드 (여러 장 가능) · Ctrl+V
          </span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        type="text"
        value={data.caption}
        onChange={(e) => onChange({ ...data, caption: e.target.value })}
        placeholder="캡션 (선택)"
        className="rounded px-2 text-sm"
        style={{
          height: 32,
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          outline: "none",
        }}
      />

      <textarea
        value={data.description ?? ""}
        onChange={(e) =>
          onChange({ ...data, description: e.target.value })
        }
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Escape") e.stopPropagation();
        }}
        placeholder="간단한 메모 (선택)"
        className="rounded px-2 py-1.5 text-sm"
        style={{
          minHeight: 60,
          resize: "vertical",
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          outline: "none",
          fontFamily: "inherit",
          lineHeight: 1.55,
        }}
      />
    </div>
  );
}
