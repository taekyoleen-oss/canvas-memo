"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "pwa_install_hint_dismissed";

export default function PwaInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "true") return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isAndroidChrome =
      ua.includes("android") && ua.includes("chrome") && !ua.includes("samsung");
    if (!isAndroidChrome) return;

    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 400,
        padding: "10px 14px",
        borderRadius: 999,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        color: "var(--text-primary)",
        fontSize: 12,
        maxWidth: 280,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>📲 홈에 추가하면 안드로이드 공유 메뉴에서 바로 보낼 수 있어요</span>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(DISMISS_KEY, "true");
          setVisible(false);
        }}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          fontSize: 14,
          padding: "2px 6px",
        }}
        aria-label="안내 닫기"
      >
        ✕
      </button>
    </div>
  );
}
