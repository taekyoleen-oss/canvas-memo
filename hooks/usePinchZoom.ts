"use client";

import { useEffect, useRef, useCallback } from "react";
import { getTouchDistance, getTouchMidpoint } from "@/lib/canvas/touch";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface UsePinchZoomOptions {
  onViewportChange: (viewport: Viewport) => void;
  initialViewport: Viewport;
  minZoom?: number;
  maxZoom?: number;
}

export function usePinchZoom(
  ref: React.RefObject<HTMLElement | null>,
  options: UsePinchZoomOptions
) {
  const { onViewportChange, initialViewport, minZoom = 0.1, maxZoom = 3 } = options;

  // 현재 뷰포트를 ref로 관리 (리렌더 없이 최신값 유지)
  const viewportRef = useRef<Viewport>(initialViewport);
  const lastTouchDistRef = useRef<number>(0);
  const lastTouchMidRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpaceDownRef = useRef(false);
  const isMouseDraggingRef = useRef(false);

  // 외부에서 viewport가 바뀌면 ref도 동기화
  useEffect(() => {
    viewportRef.current = initialViewport;
  }, [initialViewport]);

  const clampZoom = useCallback(
    (z: number) => Math.min(maxZoom, Math.max(minZoom, z)),
    [minZoom, maxZoom]
  );

  const emit = useCallback(
    (vp: Viewport) => {
      viewportRef.current = vp;
      onViewportChange(vp);
    },
    [onViewportChange]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // ── 터치 이벤트 ────────────────────────────────────────────

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastTouchDistRef.current = getTouchDistance(e.touches);
        lastTouchMidRef.current = getTouchMidpoint(e.touches);
        isPanningRef.current = false;
      } else if (e.touches.length === 1) {
        // 모듈 또는 그룹 위에서 시작한 단일 터치는 캔버스 패닝 금지
        const target = e.target as HTMLElement;
        const onDraggable =
          !!target.closest("[data-module-wrapper-id]") ||
          !!target.closest("[data-group-draggable]");
        if (onDraggable) {
          isPanningRef.current = false;
          return;
        }
        lastPanPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        isPanningRef.current = true;
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const newDist = getTouchDistance(e.touches);
        const newMid = getTouchMidpoint(e.touches);
        const vp = viewportRef.current;

        const scaleFactor = newDist / (lastTouchDistRef.current || newDist);
        const newZoom = clampZoom(vp.zoom * scaleFactor);

        // focal point 유지: 중간점이 캔버스에서 동일한 위치를 유지
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const focalX = newMid.x - rect.left;
        const focalY = newMid.y - rect.top;

        // pan delta (핀치하면서 동시에 이동)
        const panDx = newMid.x - lastTouchMidRef.current.x;
        const panDy = newMid.y - lastTouchMidRef.current.y;

        const newX = focalX - (focalX - vp.x) * (newZoom / vp.zoom) + panDx;
        const newY = focalY - (focalY - vp.y) * (newZoom / vp.zoom) + panDy;

        lastTouchDistRef.current = newDist;
        lastTouchMidRef.current = newMid;

        emit({ x: newX, y: newY, zoom: newZoom });
      } else if (e.touches.length === 1 && isPanningRef.current) {
        e.preventDefault();
        const vp = viewportRef.current;
        const dx = e.touches[0].clientX - lastPanPosRef.current.x;
        const dy = e.touches[0].clientY - lastPanPosRef.current.y;
        lastPanPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        emit({ ...vp, x: vp.x + dx, y: vp.y + dy });
      }
    }

    function handleTouchEnd() {
      isPanningRef.current = false;
      lastTouchDistRef.current = 0;
    }

    // ── 마우스 휠 줌 ────────────────────────────────────────────

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const vp = viewportRef.current;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;

      // deltaY 방향 정규화, 핀치/휠 속도 조정
      const delta = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const newZoom = clampZoom(vp.zoom * delta);

      const newX = focalX - (focalX - vp.x) * (newZoom / vp.zoom);
      const newY = focalY - (focalY - vp.y) * (newZoom / vp.zoom);

      emit({ x: newX, y: newY, zoom: newZoom });
    }

    // ── 스페이스+마우스드래그 팬 ────────────────────────────────

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat) {
        isSpaceDownRef.current = true;
        el!.style.cursor = "grab";
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        isSpaceDownRef.current = false;
        isMouseDraggingRef.current = false;
        el!.style.cursor = "";
      }
    }

    function handleMouseDown(e: MouseEvent) {
      if (isSpaceDownRef.current && e.button === 0) {
        e.preventDefault();
        isMouseDraggingRef.current = true;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        el!.style.cursor = "grabbing";
      }
    }

    function handleMouseMove(e: MouseEvent) {
      if (isMouseDraggingRef.current) {
        const vp = viewportRef.current;
        const dx = e.clientX - lastPanPosRef.current.x;
        const dy = e.clientY - lastPanPosRef.current.y;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        emit({ ...vp, x: vp.x + dx, y: vp.y + dy });
      }
    }

    function handleMouseUp() {
      if (isMouseDraggingRef.current) {
        isMouseDraggingRef.current = false;
        if (isSpaceDownRef.current) {
          el!.style.cursor = "grab";
        }
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("mousedown", handleMouseDown);
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("mousedown", handleMouseDown);
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [ref, emit, clampZoom]);
}
