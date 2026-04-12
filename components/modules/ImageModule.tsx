"use client";

import { useRef } from "react";
import type { ImageData } from "@/types";

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      onChange({ ...data, src: base64 });
    };
    reader.readAsDataURL(file);
  }

  if (!isExpanded) {
    return (
      <div className="px-3 py-2 flex flex-col gap-1">
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {data.title || "제목 없음"}
        </p>
        {data.src ? (
          <div
            className="rounded overflow-hidden"
            style={{ height: 80, background: "var(--surface-hover)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.src}
              alt={data.caption || data.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="rounded flex items-center justify-center"
            style={{
              height: 80,
              background: "var(--surface-hover)",
              border: "1px dashed var(--border-strong)",
            }}
          >
            <span style={{ fontSize: 28, opacity: 0.4 }}>🖼</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      <input
        type="text"
        value={data.title}
        onChange={(e) => onChange({ ...data, title: e.target.value })}
        placeholder="제목"
        className="text-sm font-medium rounded px-2"
        style={{
          height: 36,
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          outline: "none",
        }}
      />

      {data.src ? (
        <div className="relative rounded overflow-hidden" style={{ height: 160 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.src}
            alt={data.caption || data.title}
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
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
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg flex flex-col items-center justify-center gap-1"
          style={{
            height: 120,
            background: "var(--surface-hover)",
            border: "2px dashed var(--border-strong)",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 28 }}>🖼</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            이미지 업로드
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
        className="text-sm rounded px-2"
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
