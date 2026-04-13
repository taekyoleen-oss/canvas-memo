"use client";

import { useState } from "react";
import Image from "next/image";
import { useCanvasStore } from "@/store/canvas";
import type { Group, GroupColor } from "@/types";

// 그룹 색상별 배경/테두리 CSS 값
const GROUP_COLORS: Record<GroupColor, { bg: string; border: string; folderCol: number; folderRow: number }> = {
  yellow: { bg: "rgba(250,204,21,0.10)",  border: "rgba(234,179,8,0.45)",   folderCol: 0, folderRow: 0 },
  pink:   { bg: "rgba(236,72,153,0.08)",  border: "rgba(219,39,119,0.35)",  folderCol: 1, folderRow: 0 },
  teal:   { bg: "rgba(20,184,166,0.08)",  border: "rgba(13,148,136,0.35)",  folderCol: 2, folderRow: 0 },
  blue:   { bg: "rgba(99,102,241,0.08)",  border: "rgba(79,70,229,0.35)",   folderCol: 0, folderRow: 1 },
  purple: { bg: "rgba(168,85,247,0.08)",  border: "rgba(147,51,234,0.35)",  folderCol: 1, folderRow: 1 },
  orange: { bg: "rgba(249,115,22,0.08)",  border: "rgba(234,88,12,0.35)",   folderCol: 2, folderRow: 1 },
};

// 이미지는 3열×2행 스프라이트 (각 셀 약 103×105px, 전체 약 310×210px)
const SPRITE_COLS = 3;
const SPRITE_ROWS = 2;
const FOLDER_W = 90;   // 표시 크기 (px, 캔버스 좌표)
const FOLDER_H = 76;

interface GroupLayerProps {
  boardId: string;
  onDoubleClickGroup?: (groupId: string) => void;
}

export default function GroupLayer({ boardId, onDoubleClickGroup }: GroupLayerProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const updateGroup = useCanvasStore((s) => s.updateGroup);
  const removeGroup = useCanvasStore((s) => s.removeGroup);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const groups = board?.groups ?? [];
  if (groups.length === 0) return null;

  function handleCollapse(groupId: string) {
    updateGroup(boardId, groupId, { isCollapsed: true });
  }

  function handleExpand(groupId: string) {
    updateGroup(boardId, groupId, { isCollapsed: false });
    onDoubleClickGroup?.(groupId);
  }

  function startRename(g: Group, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingGroupId(g.id);
    setEditValue(g.name);
  }

  function commitRename(groupId: string) {
    if (editValue.trim()) updateGroup(boardId, groupId, { name: editValue.trim() });
    setEditingGroupId(null);
  }

  return (
    <>
      {groups.map((g) => {
        const colorDef = GROUP_COLORS[g.color] ?? GROUP_COLORS.yellow;

        if (g.isCollapsed) {
          // ── 폴더 아이콘 (접힌 상태) ────────────────────────────────────
          const col = colorDef.folderCol;
          const row = colorDef.folderRow;
          // 스프라이트 오프셋: 캔버스 좌표에서 px를 쓸 때는 zoom-scaled이므로
          // FOLDER_W × SPRITE_COLS = 전체 이미지 렌더 너비
          const bgSizeW = FOLDER_W * SPRITE_COLS;
          const bgSizeH = FOLDER_H * SPRITE_ROWS;
          const bgPosX = -(col * FOLDER_W);
          const bgPosY = -(row * FOLDER_H);

          return (
            <div
              key={g.id}
              style={{
                position: "absolute",
                left: g.position.x,
                top: g.position.y,
                width: FOLDER_W + 20,
                textAlign: "center",
                cursor: "pointer",
                userSelect: "none",
                zIndex: 5,
              }}
              onDoubleClick={() => handleExpand(g.id)}
              title={`${g.name} — 더블클릭하면 펼쳐집니다`}
            >
              {/* 폴더 이미지 스프라이트 */}
              <div
                style={{
                  width: FOLDER_W,
                  height: FOLDER_H,
                  margin: "0 auto",
                  backgroundImage: "url('/folder-icon.png')",
                  backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
                  backgroundPosition: `${bgPosX}px ${bgPosY}px`,
                  backgroundRepeat: "no-repeat",
                  imageRendering: "crisp-edges",
                }}
              />
              {/* 그룹 이름 */}
              {editingGroupId === g.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(g.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(g.id);
                    if (e.key === "Escape") setEditingGroupId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 11,
                    width: FOLDER_W + 20,
                    textAlign: "center",
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--primary)",
                    borderRadius: 4,
                    outline: "none",
                    color: "var(--text-primary)",
                    marginTop: 4,
                    padding: "1px 4px",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginTop: 4,
                    maxWidth: FOLDER_W + 20,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    background: "var(--surface-elevated)",
                    borderRadius: 4,
                    padding: "1px 6px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                  onDoubleClick={(e) => { e.stopPropagation(); startRename(g, e); }}
                >
                  {g.name}
                </div>
              )}
            </div>
          );
        }

        // ── 확장된 그룹 배경 rect ──────────────────────────────────────
        const PAD = 16; // 모듈 바깥 여백
        return (
          <div
            key={g.id}
            style={{
              position: "absolute",
              left: g.position.x - PAD,
              top: g.position.y - PAD - 28,
              width: g.size.width + PAD * 2,
              height: g.size.height + PAD * 2 + 28,
              background: colorDef.bg,
              border: `1.5px solid ${colorDef.border}`,
              borderRadius: 16,
              zIndex: 0,
              pointerEvents: "none",
            }}
          >
            {/* 그룹 헤더 */}
            <div
              style={{
                position: "absolute",
                top: 6,
                left: 10,
                right: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
                pointerEvents: "all",
              }}
            >
              <span style={{ fontSize: 14 }}>📁</span>
              {editingGroupId === g.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(g.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(g.id);
                    if (e.key === "Escape") setEditingGroupId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    flex: 1,
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--primary)",
                    borderRadius: 4,
                    outline: "none",
                    color: "var(--text-primary)",
                    padding: "0 4px",
                    height: 22,
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    flex: 1,
                    cursor: "text",
                  }}
                  onDoubleClick={(e) => startRename(g, e)}
                  title="더블클릭하여 이름 수정"
                >
                  {g.name}
                </span>
              )}
              {/* 접기 버튼 */}
              <button
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `1px solid ${colorDef.border}`,
                  background: "var(--surface-elevated)",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="폴더로 접기"
                onClick={() => handleCollapse(g.id)}
              >
                ▾
              </button>
              {/* 그룹 삭제 버튼 */}
              <button
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `1px solid ${colorDef.border}`,
                  background: "var(--surface-elevated)",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="그룹 해제"
                onClick={() => {
                  if (confirm(`"${g.name}" 그룹을 해제할까요? (모듈은 유지됩니다)`)) {
                    removeGroup(boardId, g.id);
                  }
                }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
