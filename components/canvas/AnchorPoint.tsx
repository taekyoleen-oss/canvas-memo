"use client";

import { useRef, useState } from "react";
import type { AnchorSide } from "@/lib/canvas/geometry";
import { screenToCanvas, getAnchorPosition } from "@/lib/canvas/geometry";
import { useCanvasStore } from "@/store/canvas";
import { useConnectionStore } from "@/store/connection";
import type { Module } from "@/types";

interface AnchorPointProps {
  type: "output" | "input";
  moduleId: string;
  anchor: AnchorSide;
  viewport: { x: number; y: number; zoom: number };
}

const ANCHOR_OFFSET: Record<AnchorSide, React.CSSProperties> = {
  top:    { top: 0,    left: "50%",  transform: "translate(-50%, -50%)" },
  right:  { top: "50%", right: 0,   transform: "translate(50%,  -50%)" },
  bottom: { bottom: 0, left: "50%", transform: "translate(-50%, 50%)"  },
  left:   { top: "50%", left: 0,    transform: "translate(-50%, -50%)" },
};

function calcBestToAnchor(from: Module, to: Module): AnchorSide {
  const fx = from.position.x + from.size.width  / 2;
  const fy = from.position.y + from.size.height / 2;
  const tx = to.position.x  + to.size.width   / 2;
  const ty = to.position.y  + to.size.height  / 2;
  const dx = fx - tx, dy = fy - ty;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

export default function AnchorPoint({
  type, moduleId, anchor, viewport,
}: AnchorPointProps) {
  const mode             = useConnectionStore((s) => s.mode);
  const fromModuleId     = useConnectionStore((s) => s.fromModuleId);
  const fromAnchor       = useConnectionStore((s) => s.fromAnchor);
  const startConnecting  = useConnectionStore((s) => s.startConnecting);
  const finishConnecting = useConnectionStore((s) => s.finishConnecting);
  const cancelConnecting = useConnectionStore((s) => s.cancelConnecting);
  const updatePreviewPos = useConnectionStore((s) => s.updatePreviewPos);
  const setDragSource    = useConnectionStore((s) => s.setDragSource);
  const clearDragSource  = useConnectionStore((s) => s.clearDragSource);

  const isConnecting       = mode === "connecting";
  const isThisSource       = fromModuleId === moduleId;

  const [hovered, setHovered] = useState(false);

  // 최신 viewport를 ref로 유지
  const vpRef = useRef(viewport);
  vpRef.current = viewport;

  // 드래그 상태 ref (re-render 불필요)
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    started: boolean;  // startConnecting 이미 호출됐는지
  } | null>(null);

  // ── OUTPUT anchor ─────────────────────────────────────────────

  function handlePointerDown(e: React.PointerEvent) {
    if (type !== "output") return;
    e.stopPropagation();
    e.preventDefault();

    // 포인터 캡처 → 마우스가 어디 있어도 이 앵커가 모든 이벤트 수신
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
    };

    // 드래그 전에도 앵커 DOM 유지
    setDragSource(moduleId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (type !== "output") return;
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;

    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);

    // 5 px 임계값 초과 → 실제 드래그 연결 시작
    if (!d.started && dist > 5) {
      d.started = true;
      startConnecting(moduleId, anchor);
    }

    if (d.started) {
      const rect = document
        .querySelector("[data-canvas-container]")
        ?.getBoundingClientRect();
      if (rect) {
        updatePreviewPos(
          screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, vpRef.current)
        );
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (type === "input") {
      // input anchor: connecting 모드면 연결 완성
      if (!isConnecting || isThisSource) return;
      e.stopPropagation();
      finishConnecting(moduleId, anchor);
      return;
    }

    // output anchor
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;

    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    clearDragSource();
    drag.current = null;

    if (d.started) {
      // ── 드래그 완료: 드롭 위치에서 대상 감지 ──
      e.preventDefault(); // 드래그 후 불필요한 click 이벤트 방지

      const els = document.elementsFromPoint(e.clientX, e.clientY);

      // 1순위: input anchor 위에 정확히 드롭
      const inputEl = els.find(
        (el) => el.getAttribute("data-anchor-input") === "true"
      );
      if (inputEl) {
        const toId     = inputEl.getAttribute("data-module-id");
        const toAnchor = inputEl.getAttribute("data-anchor-side") as AnchorSide;
        if (toId && toAnchor && toId !== moduleId) {
          finishConnecting(toId, toAnchor);
          return;
        }
      }

      // 2순위: 모듈 본체 위에 드롭 (자동 앵커)
      const wrapEl = els.find(
        (el) => el.getAttribute("data-module-wrapper-id")
      );
      if (wrapEl) {
        const toId = wrapEl.getAttribute("data-module-wrapper-id");
        if (toId && toId !== moduleId) {
          const st    = useCanvasStore.getState();
          const board = st.boards.find((b) => b.id === st.activeBoardId);
          const from  = board?.modules.find((m) => m.id === moduleId);
          const to    = board?.modules.find((m) => m.id === toId);
          finishConnecting(toId, from && to ? calcBestToAnchor(from, to) : "left");
          return;
        }
      }

      // 빈 공간 드롭 → 취소
      cancelConnecting();
    } else {
      // ── 클릭(드래그 없음): 클릭-투-커넥트 모드 토글 ──
      if (isConnecting && isThisSource) {
        cancelConnecting();
      } else if (!isConnecting) {
        startConnecting(moduleId, anchor);
        // 클릭 즉시 previewPos를 소스 앵커 위치로 초기화 → 마우스 이동 시 선 바로 표시
        const st  = useCanvasStore.getState();
        const brd = st.boards.find((b) => b.id === st.activeBoardId);
        const mod = brd?.modules.find((m) => m.id === moduleId);
        if (mod) updatePreviewPos(getAnchorPosition(mod, anchor));
      }
    }
  }

  function handlePointerCancel(e: React.PointerEvent) {
    if (type !== "output") return;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    clearDragSource();
    drag.current = null;
    cancelConnecting();
  }

  // input은 connecting 모드 + 다른 모듈만 렌더
  if (type === "input" && (!isConnecting || isThisSource)) return null;

  // 드래그 시작된 그 앵커만 active (나머지 3개는 inactive)
  const isActive = type === "output" && isConnecting && isThisSource && anchor === fromAnchor;

  return (
    <div
      data-anchor-input={type === "input" ? "true"   : undefined}
      data-module-id=   {type === "input" ? moduleId : undefined}
      data-anchor-side= {type === "input" ? anchor   : undefined}
      style={{
        position: "absolute",
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: type === "output" ? "crosshair" : "copy",
        zIndex: 50,
        touchAction: "none",
        ...ANCHOR_OFFSET[anchor],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown  ={handlePointerDown}
      onPointerMove  ={type === "output" ? handlePointerMove   : undefined}
      onPointerUp    ={handlePointerUp}
      onPointerCancel={type === "output" ? handlePointerCancel : undefined}
    >
      <div
        style={{
          width:  hovered || isActive ? 16 : 10,
          height: hovered || isActive ? 16 : 10,
          borderRadius: "50%",
          background:
            type === "output"
              ? hovered || isActive ? "var(--primary)" : "var(--border-strong)"
              : hovered ? "var(--primary)" : "var(--surface)",
          border: type === "input" ? "2.5px solid var(--primary)" : "none",
          boxShadow:
            hovered
              ? "0 0 0 4px var(--primary-soft), 0 0 0 7px var(--primary)"
              : isActive
              ? "0 0 0 3px var(--surface), 0 0 0 6px var(--primary)"
              : type === "input"
              ? "0 0 0 4px var(--primary-soft)"
              : "none",
          transition: "all 120ms ease",
          animation: isActive ? "aP 0.9s ease-in-out infinite" : "none",
          pointerEvents: "none",
        }}
      />
      <style>{`
        @keyframes aP {
          0%,100%{ box-shadow: 0 0 0 3px var(--surface), 0 0 0 6px var(--primary); }
          50%    { box-shadow: 0 0 0 3px var(--surface), 0 0 0 14px var(--primary); opacity:.5; }
        }
      `}</style>
    </div>
  );
}
