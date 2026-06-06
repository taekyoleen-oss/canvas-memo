"use client";

import type {
  Module,
  MemoData,
  ScheduleData,
  ImageData,
  LinkData,
  FileData,
  TableData,
  BrainstormData,
} from "@/types";
import { getImageSrcs } from "@/lib/imageData";
import { entryTitle } from "@/lib/canvas/organizedGroups";

/** 모듈 타입별 헤더 아이콘(이모지) */
export const MODULE_TYPE_ICON: Record<Module["type"], string> = {
  memo: "📝",
  schedule: "✅",
  image: "🖼",
  link: "🔗",
  file: "📎",
  table: "▦",
  brainstorm: "💡",
};

const MODULE_TYPE_LABEL: Record<Module["type"], string> = {
  memo: "메모",
  schedule: "일정",
  image: "이미지",
  link: "링크",
  file: "파일",
  table: "표",
  brainstorm: "브레인스토밍",
};

export function moduleTypeLabel(type: Module["type"]): string {
  return MODULE_TYPE_LABEL[type];
}

/** HTML 태그를 제거해 미리보기용 플레인 텍스트로 변환 */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<(?:div|p|h[1-6]|li|tr|blockquote)(?:\s[^>]*)?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 카드 표시 제목(빈 제목이면 타입 라벨 폴백) */
export function cardTitle(module: Module): string {
  const t = entryTitle(module);
  return t || MODULE_TYPE_LABEL[module.type];
}

interface PreviewProps {
  module: Module;
  /** 미리보기 줄 수 제한 등 컴팩트 표시 */
  compact?: boolean;
}

/**
 * 타입별 카드 미리보기(읽기 전용, 정적).
 * 어떤 변환/캔버스 좌표에도 의존하지 않는다 — 일반 DOM.
 */
export default function OrganizedPreview({ module, compact = false }: PreviewProps) {
  const muted = "var(--text-muted)";
  const secondary = "var(--text-secondary)";

  switch (module.type) {
    case "memo": {
      const d = module.data as MemoData;
      const text = stripHtml(d.content ?? "");
      if (!text) {
        return <EmptyPreview label="내용 없음" />;
      }
      return (
        <p
          className="text-xs leading-relaxed"
          style={{
            color: secondary,
            display: "-webkit-box",
            WebkitLineClamp: compact ? 2 : 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text}
        </p>
      );
    }

    case "schedule": {
      const d = module.data as ScheduleData;
      const items = d.items ?? [];
      const doneCount = items.filter((i) => i.done).length;
      const next = items.find((i) => !i.done) ?? items[0];
      const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
      if (items.length === 0) return <EmptyPreview label="일정 항목 없음" />;
      return (
        <div className="flex flex-col gap-1.5">
          {next ? (
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 12, flexShrink: 0 }}>{next.done ? "☑" : "▢"}</span>
              <span
                className="truncate text-xs"
                style={{
                  color: next.done ? muted : secondary,
                  textDecoration: next.done ? "line-through" : "none",
                }}
              >
                {next.text || "(빈 항목)"}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: "var(--surface-hover)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: "var(--primary)" }}
              />
            </div>
            <span className="text-[11px] tabular-nums" style={{ color: muted }}>
              {doneCount}/{items.length}
            </span>
          </div>
        </div>
      );
    }

    case "image": {
      const d = module.data as ImageData;
      const srcs = getImageSrcs(d);
      if (srcs.length === 0) return <EmptyPreview label="이미지 없음" icon="🖼" />;
      return (
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16 / 10", background: "var(--surface-hover)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={srcs[0]}
            alt={d.caption || d.title || "이미지"}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {srcs.length > 1 ? (
            <span
              className="absolute bottom-1 right-1 rounded px-1.5 text-[10px] font-medium"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
            >
              +{srcs.length - 1}
            </span>
          ) : null}
        </div>
      );
    }

    case "link": {
      const d = module.data as LinkData;
      if (!d.url) return <EmptyPreview label="URL 없음" icon="🔗" />;
      return (
        <div className="flex flex-col gap-1.5">
          {d.thumbnail ? (
            <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16 / 9", background: "var(--surface-hover)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.thumbnail}
                alt={d.title || "링크"}
                className="h-full w-full object-cover"
                draggable={false}
                onError={(e) => {
                  (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                }}
              />
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            {d.favicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.favicon}
                alt=""
                width={14}
                height={14}
                style={{ flexShrink: 0, borderRadius: 3 }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <span className="truncate text-xs" style={{ color: muted }}>
              {d.url}
            </span>
          </div>
        </div>
      );
    }

    case "file": {
      const d = module.data as FileData;
      const size = formatFileSize(d.fileSize);
      return (
        <div
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
          style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}
        >
          <span style={{ fontSize: 24, flexShrink: 0 }}>📎</span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium" style={{ color: secondary }}>
              {d.fileName || "파일 없음"}
            </span>
            {(d.fileType || size) && (
              <span className="truncate text-[11px]" style={{ color: muted }}>
                {[d.fileType, size].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        </div>
      );
    }

    case "table": {
      const d = module.data as TableData;
      const rows = Number(d.rowCount) || 0;
      const cols = Number(d.colCount) || 0;
      const firstRow = (d.cells ?? []).slice(0, Math.min(cols, 4)).filter((c) => c.trim());
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px]" style={{ color: muted }}>
            {rows}행 × {cols}열
          </span>
          {firstRow.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {firstRow.map((c, i) => (
                <span
                  key={i}
                  className="truncate rounded px-1.5 py-0.5 text-[11px]"
                  style={{
                    background: "var(--surface-hover)",
                    color: secondary,
                    maxWidth: 120,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <EmptyPreview label="빈 표" icon="▦" />
          )}
        </div>
      );
    }

    case "brainstorm": {
      const d = module.data as BrainstormData;
      const items = d.items ?? [];
      if (items.length === 0) return <EmptyPreview label="아이디어 없음" icon="💡" />;
      const shown = items.slice(0, compact ? 2 : 3);
      return (
        <div className="flex flex-col gap-1">
          {shown.map((it) => (
            <div key={it.id} className="flex items-center gap-1.5">
              <span style={{ color: muted, fontSize: 10, flexShrink: 0 }}>•</span>
              <span className="truncate text-xs" style={{ color: secondary }}>
                {it.text || "(빈 아이디어)"}
              </span>
            </div>
          ))}
          {items.length > shown.length ? (
            <span className="text-[11px]" style={{ color: muted }}>
              외 {items.length - shown.length}개
            </span>
          ) : null}
        </div>
      );
    }

    default:
      return null;
  }
}

function EmptyPreview({ label, icon }: { label: string; icon?: string }) {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {icon ? <span style={{ fontSize: 14, opacity: 0.5 }}>{icon}</span> : null}
      <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}
