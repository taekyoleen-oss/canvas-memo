"use client";

import { useRef, useCallback } from "react";

interface UseLongPressOptions {
  delay?: number;
}

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
}

export function useLongPress(
  onLongPress: () => void,
  options: UseLongPressOptions = {}
): LongPressHandlers {
  const { delay = 500 } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // 멀티터치이면 롱프레스 무시 (핀치줌과 충돌 방지)
      if (e.touches.length > 1) return;
      clear();
      timerRef.current = setTimeout(() => {
        onLongPress();
        timerRef.current = null;
      }, delay);
    },
    [onLongPress, delay, clear]
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  const onTouchMove = useCallback(() => {
    // 손가락이 움직이면 롱프레스 취소
    clear();
  }, [clear]);

  return { onTouchStart, onTouchEnd, onTouchMove };
}
