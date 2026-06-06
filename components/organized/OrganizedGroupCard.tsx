"use client";

import type { DisplayEntry, Module } from "@/types";
import OrganizedPreview, {
  MODULE_TYPE_ICON,
  cardTitle,
} from "./organizedPreview";
import OrganizedModuleMenu from "./OrganizedModuleMenu";

interface OrganizedGroupCardProps {
  /** 활성 보드 id — 대표 모듈 액션(복사·삭제 등)에 필요 */
  boardId: string;
  entry: DisplayEntry;
  onExpand: (entry: DisplayEntry) => void;
}

const SOURCE_LABEL: Record<NonNullable<DisplayEntry["groupSource"]>, string> = {
  connection: "연결",
  group: "그룹",
  mapBundle: "맵",
};

/**
 * 그룹 카드 — 대표 모듈 미리보기 + 멤버 타입 믹스 + 🔗N.
 * 본문 클릭 → 그룹 확장 팝업. 우상단 ⋮ → 대표 모듈에 캔버스와 동일한 액션(복사·삭제 등).
 * (개별 멤버 액션은 펼침 팝업의 각 멤버 ⋮ 에서 동일하게 제공)
 */
export default function OrganizedGroupCard({
  boardId,
  entry,
  onExpand,
}: OrganizedGroupCardProps) {
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
    <div
      className="relative flex w-full flex-col rounded-xl transition-shadow"
      style={{
        minHeight: 44,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <button
        type="button"
        onClick={() => onExpand(entry)}
        className="flex w-full flex-col gap-2 p-3 text-left"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
        aria-label={`그룹 (${count}개 모듈) · ${cardTitle(anchor)} 펼치기`}
      >
        <div className="flex items-center gap-1.5" style={{ paddingRight: 84 }}>
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

        {/* 출처 + 🔗N + 멤버 타입 믹스 */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <span
            className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: "var(--primary-soft)",
              color: "var(--primary)",
              border: "1px solid var(--primary)",
            }}
          >
            🔗 {count}
          </span>
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

      {/* 우상단 ⋮ — 대표 모듈에 캔버스와 동일한 액션(복사·삭제·색상·이동 등) */}
      <div className="absolute right-1 top-1">
        <OrganizedModuleMenu boardId={boardId} moduleId={anchor.id} />
      </div>
    </div>
  );
}
