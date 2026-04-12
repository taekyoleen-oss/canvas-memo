"use client";

import { useCallback } from "react";
import { useConnectionStore } from "@/store/connection";
import type { Connection } from "@/types";

export function useConnectionMode() {
  const mode = useConnectionStore((s) => s.mode);
  const fromModuleId = useConnectionStore((s) => s.fromModuleId);
  const fromAnchor = useConnectionStore((s) => s.fromAnchor);
  const previewPos = useConnectionStore((s) => s.previewPos);
  const startConnecting = useConnectionStore((s) => s.startConnecting);
  const finishConnecting = useConnectionStore((s) => s.finishConnecting);
  const cancelConnecting = useConnectionStore((s) => s.cancelConnecting);
  const updatePreviewPos = useConnectionStore((s) => s.updatePreviewPos);

  const isConnecting = mode === "connecting";

  const handleStartConnecting = useCallback(
    (moduleId: string, anchor: Connection["fromAnchor"]) => {
      startConnecting(moduleId, anchor);
    },
    [startConnecting]
  );

  const handleFinishConnecting = useCallback(
    (toModuleId: string, toAnchor: Connection["toAnchor"]) => {
      if (!isConnecting) return;
      finishConnecting(toModuleId, toAnchor);
    },
    [isConnecting, finishConnecting]
  );

  const handleCancelConnecting = useCallback(() => {
    cancelConnecting();
  }, [cancelConnecting]);

  const handleUpdatePreviewPos = useCallback(
    (pos: { x: number; y: number }) => {
      if (isConnecting) {
        updatePreviewPos(pos);
      }
    },
    [isConnecting, updatePreviewPos]
  );

  return {
    isConnecting,
    fromModuleId,
    fromAnchor,
    previewPos,
    startConnecting: handleStartConnecting,
    finishConnecting: handleFinishConnecting,
    cancelConnecting: handleCancelConnecting,
    updatePreviewPos: handleUpdatePreviewPos,
  };
}
