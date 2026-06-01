import { create } from "zustand";

// 앱 내부 이미지 클립보드 — 이미지 모듈에서 "이미지 복사" → 다른 이미지 모듈에 "붙여넣기".
// OS 클립보드와 별개. data URL(여러 장)도 안정적으로 옮긴다.
interface ImageClipboardState {
  srcs: string[];
  copy: (srcs: string[]) => void;
  clear: () => void;
}

export const useImageClipboardStore = create<ImageClipboardState>((set) => ({
  srcs: [],
  copy: (srcs) =>
    set({ srcs: srcs.filter((s) => typeof s === "string" && s.length > 0) }),
  clear: () => set({ srcs: [] }),
}));
