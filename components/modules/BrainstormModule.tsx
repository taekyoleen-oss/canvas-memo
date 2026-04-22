"use client";

import { useState } from "react";
import type {
  BrainstormData,
  BrainstormItemLink,
  BrainstormItemStatus,
} from "@/types";
import { v4 as uuidv4 } from "uuid";

export interface BrainstormCanvasLinkSummary {
  connectionId: string;
  otherTitle: string;
  label: string;
  outgoing: boolean;
}

interface BrainstormModuleProps {
  data: BrainstormData;
  isExpanded: boolean;
  onChange: (data: BrainstormData) => void;
  canvasLinkSummaries?: BrainstormCanvasLinkSummary[];
}

const STATUS_OPTIONS: { value: BrainstormItemStatus; label: string }[] = [
  { value: "raw", label: "초안" },
  { value: "refined", label: "정리됨" },
  { value: "archived", label: "보관" },
];

export default function BrainstormModule({
  data,
  isExpanded,
  onChange,
  canvasLinkSummaries = [],
}: BrainstormModuleProps) {
  const [newItemText, setNewItemText] = useState("");
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [linkToId, setLinkToId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const previewCount = data.previewCount ?? 4;
  const previewItems = data.items.slice(0, previewCount);
  const displayItems = isExpanded ? data.items : previewItems;
  const itemLinks = data.itemLinks ?? [];

  function removeItem(id: string) {
    onChange({
      ...data,
      items: data.items.filter((item) => item.id !== id),
      itemLinks: itemLinks.filter((l) => l.fromItemId !== id && l.toItemId !== id),
    });
  }

  function setItemStatus(id: string, status: BrainstormItemStatus) {
    onChange({
      ...data,
      items: data.items.map((item) =>
        item.id === id ? { ...item, status } : item
      ),
    });
  }

  function addItem() {
    if (!newItemText.trim()) return;
    onChange({
      ...data,
      items: [...data.items, { id: uuidv4(), text: newItemText.trim(), status: "raw" }],
    });
    setNewItemText("");
  }

  function addItemLink() {
    if (!linkFromId || !linkToId || linkFromId === linkToId) return;
    const exists = itemLinks.some(
      (l) =>
        (l.fromItemId === linkFromId && l.toItemId === linkToId) ||
        (l.fromItemId === linkToId && l.toItemId === linkFromId)
    );
    if (exists) return;
    const next: BrainstormItemLink = {
      id: uuidv4(),
      fromItemId: linkFromId,
      toItemId: linkToId,
      label: linkLabel.trim() || undefined,
    };
    onChange({ ...data, itemLinks: [...itemLinks, next] });
    setLinkLabel("");
    setLinkToId("");
  }

  function removeLink(linkId: string) {
    onChange({
      ...data,
      itemLinks: itemLinks.filter((l) => l.id !== linkId),
    });
  }

  function linksForItem(itemId: string) {
    return itemLinks.filter((l) => l.fromItemId === itemId || l.toItemId === itemId);
  }

  function peerTitle(itemId: string, link: BrainstormItemLink) {
    const peer = link.fromItemId === itemId ? link.toItemId : link.fromItemId;
    const item = data.items.find((i) => i.id === peer);
    return item?.text?.slice(0, 24) ?? peer;
  }

  return (
    <div className="px-3 py-2 flex flex-col gap-1">
      {canvasLinkSummaries.length > 0 && (
        <div
          className="mb-1 rounded-lg px-2 py-1.5"
          style={{
            background: "var(--surface-hover)",
            border: "1px solid var(--border)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            캔버스 연결
          </p>
          <ul className="flex flex-col gap-0.5 m-0 p-0 list-none">
            {canvasLinkSummaries.map((s) => (
              <li
                key={s.connectionId}
                className="text-xs truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {s.outgoing ? "→" : "←"} {s.otherTitle}
                {s.label ? (
                  <span style={{ color: "var(--accent)" }}> · {s.label}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] m-0 mb-1 leading-snug" style={{ color: "var(--text-muted)" }}>
        프로세스·SWOT 등 구조화 맵은 캔버스 왼쪽 하단 <strong>맵</strong> 버튼에서 템플릿을 넣을 수
        있습니다.
      </p>

      {displayItems.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          아이디어를 입력해 보세요…
        </p>
      )}
      {displayItems.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-0.5 py-0.5"
          style={{ borderBottom: "1px solid var(--border)" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2">
            <span
              className="text-sm select-none"
              style={{ color: "var(--accent)", flexShrink: 0, lineHeight: 1.45 }}
              aria-hidden
            >
              ·
            </span>
            <span
              className="text-sm flex-1 min-w-0"
              style={{
                color: "var(--text-primary)",
                lineHeight: 1.45,
                wordBreak: "break-word",
              }}
            >
              {item.text}
            </span>
            {isExpanded && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.id);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: 14,
                  padding: "0 4px",
                  flexShrink: 0,
                  lineHeight: 1.45,
                }}
                aria-label="항목 삭제"
              >
                ✕
              </button>
            )}
          </div>
          {isExpanded && (
            <div className="flex flex-wrap items-center gap-1 pl-5">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                상태
              </span>
              <select
                value={item.status ?? "raw"}
                onChange={(e) =>
                  setItemStatus(item.id, e.target.value as BrainstormItemStatus)
                }
                className="text-xs rounded border px-1 py-0.5"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {linksForItem(item.id).length > 0 && (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  연결:{" "}
                  {linksForItem(item.id).map((l) => (
                    <span key={l.id} className="inline-flex items-center gap-0.5 mr-1">
                      {peerTitle(item.id, l)}
                      {l.label ? `(${l.label})` : ""}
                      <button
                        type="button"
                        className="text-[10px] px-0.5 rounded"
                        style={{ border: "1px solid var(--border)", cursor: "pointer" }}
                        onClick={() => removeLink(l.id)}
                        aria-label="항목 연결 삭제"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </span>
              )}
            </div>
          )}
        </div>
      ))}

      {!isExpanded && data.items.length > previewCount && (
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          +{data.items.length - previewCount}개 더
        </p>
      )}

      {isExpanded && data.items.length >= 2 && (
        <div
          className="mt-2 rounded-lg p-2 flex flex-col gap-1"
          style={{
            background: "var(--surface-hover)",
            border: "1px dashed var(--border)",
          }}
        >
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            항목 간 연결
          </span>
          <div className="flex flex-wrap gap-1 items-center">
            <select
              value={linkFromId ?? ""}
              onChange={(e) => setLinkFromId(e.target.value || null)}
              className="text-xs rounded border px-1 py-1 flex-1 min-w-[100px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">출발 항목</option>
              {data.items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.text.slice(0, 40)}
                  {it.text.length > 40 ? "…" : ""}
                </option>
              ))}
            </select>
            <span className="text-xs">→</span>
            <select
              value={linkToId}
              onChange={(e) => setLinkToId(e.target.value)}
              className="text-xs rounded border px-1 py-1 flex-1 min-w-[100px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">도착 항목</option>
              {data.items
                .filter((it) => it.id !== linkFromId)
                .map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.text.slice(0, 40)}
                    {it.text.length > 40 ? "…" : ""}
                  </option>
                ))}
            </select>
          </div>
          <input
            type="text"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="관계 라벨 (선택)"
            className="text-xs rounded px-2 py-1"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="button"
            onClick={addItemLink}
            className="text-xs font-semibold rounded py-1"
            style={{
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "none",
              cursor: "pointer",
            }}
          >
            연결 추가
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="flex gap-1 mt-1">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="아이디어 추가…"
            className="flex-1 text-sm rounded px-2"
            style={{
              height: 32,
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={addItem}
            className="rounded px-2 font-bold"
            style={{
              height: 32,
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
