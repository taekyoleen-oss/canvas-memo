"use client";

import { useEffect, useState } from "react";

export interface ToastProps {
  message: string;
  durationMs?: number;
  onDismiss?: () => void;
}

export default function Toast({ message, durationMs = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 600,
        padding: "10px 16px",
        borderRadius: 999,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
        color: "var(--text-primary)",
        fontSize: 13,
        maxWidth: "calc(100vw - 32px)",
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      {message}
    </div>
  );
}
