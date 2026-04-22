"use client";

import { useState, useMemo, useEffect } from "react";
import type { TableData } from "@/types";

const MIN_DIM = 1;
const MAX_DIM = 20;

interface TableModuleProps {
  data: TableData;
  isExpanded: boolean;
  onChange: (data: TableData) => void;
}

export function normalizeTableData(d: TableData): TableData {
  const r = Math.min(MAX_DIM, Math.max(MIN_DIM, Math.floor(Number(d.rowCount)) || 1));
  const c = Math.min(MAX_DIM, Math.max(MIN_DIM, Math.floor(Number(d.colCount)) || 1));
  const need = r * c;
  const cells = [...(d.cells ?? [])];
  while (cells.length < need) cells.push("");
  if (cells.length > need) cells.length = need;
  return { ...d, rowCount: r, colCount: c, cells };
}

function resizeTable(d: TableData, rows: number, cols: number): TableData {
  const base = normalizeTableData(d);
  const r = Math.min(MAX_DIM, Math.max(MIN_DIM, rows));
  const c = Math.min(MAX_DIM, Math.max(MIN_DIM, cols));
  const cells: string[] = [];
  for (let ri = 0; ri < r; ri++) {
    for (let ci = 0; ci < c; ci++) {
      if (ri < base.rowCount && ci < base.colCount) {
        const idx = ri * base.colCount + ci;
        cells.push(base.cells[idx] ?? "");
      } else {
        cells.push("");
      }
    }
  }
  return { ...base, rowCount: r, colCount: c, cells };
}

function setCell(d: TableData, row: number, col: number, value: string): TableData {
  const base = normalizeTableData(d);
  const idx = row * base.colCount + col;
  if (idx < 0 || idx >= base.cells.length) return base;
  const cells = [...base.cells];
  cells[idx] = value;
  return { ...base, cells };
}

export default function TableModule({
  data,
  isExpanded,
  onChange,
}: TableModuleProps) {
  const display = useMemo(() => normalizeTableData(data), [data]);
  const [rowInput, setRowInput] = useState(String(display.rowCount));
  const [colInput, setColInput] = useState(String(display.colCount));

  useEffect(() => {
    setRowInput(String(display.rowCount));
    setColInput(String(display.colCount));
  }, [display.rowCount, display.colCount]);

  if (!isExpanded) {
    return (
      <div className="px-3 py-2">
        <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>
          {display.rowCount}×{display.colCount} 표 · 셀 {display.cells.length}칸
        </p>
      </div>
    );
  }

  function applySize() {
    const r = parseInt(rowInput, 10);
    const c = parseInt(colInput, 10);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return;
    onChange(resizeTable(data, r, c));
  }

  return (
    <div className="px-2 py-2 flex flex-col gap-2" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
            행
          </span>
          <input
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            value={rowInput}
            onChange={(e) => setRowInput(e.target.value)}
            className="text-sm rounded px-2"
            style={{
              width: 64,
              height: 32,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
            열
          </span>
          <input
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            value={colInput}
            onChange={(e) => setColInput(e.target.value)}
            className="text-sm rounded px-2"
            style={{
              width: 64,
              height: 32,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          />
        </label>
        <button
          type="button"
          onClick={applySize}
          className="text-xs font-semibold rounded-lg px-3"
          style={{
            height: 32,
            background: "var(--primary)",
            color: "var(--primary-fg)",
            border: "none",
            cursor: "pointer",
          }}
        >
          크기 적용
        </button>
      </div>

      <div className="overflow-auto" style={{ maxHeight: 360 }}>
        <table
          className="w-full text-left border-collapse"
          style={{ fontSize: 12, border: "1px solid var(--border)" }}
        >
          <tbody>
            {Array.from({ length: display.rowCount }, (_, ri) => (
              <tr key={ri}>
                {Array.from({ length: display.colCount }, (_, ci) => {
                  const v = display.cells[ri * display.colCount + ci] ?? "";
                  return (
                    <td
                      key={ci}
                      style={{
                        border: "1px solid var(--border)",
                        padding: 0,
                        verticalAlign: "top",
                        minWidth: 56,
                      }}
                    >
                      <input
                        type="text"
                        value={v}
                        onChange={(e) =>
                          onChange(setCell(data, ri, ci, e.target.value))
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-full box-border"
                        style={{
                          minHeight: 28,
                          padding: "4px 6px",
                          border: "none",
                          background: "transparent",
                          color: "var(--text-primary)",
                          outline: "none",
                          fontSize: 12,
                        }}
                        placeholder="·"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
