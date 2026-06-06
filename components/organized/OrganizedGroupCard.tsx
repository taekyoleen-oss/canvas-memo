"use client";

import type { DisplayEntry, Module } from "@/types";
import OrganizedPreview, {
  MODULE_TYPE_ICON,
  cardTitle,
} from "./organizedPreview";

interface OrganizedGroupCardProps {
  entry: DisplayEntry;
  onExpand: (entry: DisplayEntry) => void;
}

const SOURCE_LABEL: Record<NonNullable<DisplayEntry["groupSource"]>, string> = {
  connection: "연결",
  group: "그룹",
  mapBundle: "맵",
};

/**
 * 그룹 카드 — 대표 모듈 미리보기 + 우상단 🔗N 배지 + 멤버 타입 믹스.
 * 클릭 → 그룹 확장 팝업.
 */
export default function OrganizedGroupCard({ entry, onExpand }: OrganizedGroupCardProps) {
  const anchor = entry.anchor;
  const members = entry.members ?? [anchor];
  const count = members.length;
  const source = entry.groupSource ?? "connection";

  // 멤버 타입 믹스(중복 제거, 최대 6개 표시)
  const typeMix: Module["type"][] = [];
  for (const m of members) {
    if (!typeMix.includes(m.type)) typeMix.push(m.type);
  }

  return (
    <button
      type="button"
      onClick={() => onExpand(entry)}
      className="relative flex w-full flex-col gap-2 rounded-xl p-3 text-left transition-shadow"
      style={{
        minHeight: 44,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
      }}
      aria-label={`그룹 (${count}개 모듈) · ${cardTitle(anchor)} 펼치기`}
    >
      {/* 우상단 🔗N 배지 */}
      <span
        className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
        style={{
          background: "var(--primary-soft)",
          color: "var(--primary)",
          border: "1px solid var(--primary)",
        }}
        aria-hidden
      >
        🔗 {count}
      </span>

      <div className="flex items-center gap-1.5 pr-12">
        <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden>
          {MODULE_TYPE_ICON[anchor.type]}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {cardTitle(anchor)}
        </span>
      </div>

      {/* 대표 미리보기 */}
      <OrganizedPreview module={anchor} compact />

      {/* 출처 + 멤버 타입 믹스 */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: "var(--surface-hover)", color: "var(--text-muted)" }}
        >
          {SOURCE_LABEL[source]}
        </span>
        <div className="flex items-center gap-0.5">
          {typeMix.slice(0, 6).map((t, i) => (
            <span key={`${t}-${i}`} style={{ fontSize: 12 }} aria-hidden title={t}>
              {MODULE_TYPE_ICON[t]}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
