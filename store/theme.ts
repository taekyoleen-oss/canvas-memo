import { create } from "zustand";
import { loadAppData, saveAppData } from "@/lib/storage";

interface ThemeStore {
  theme: "light" | "dark" | "system";
  setTheme(theme: ThemeStore["theme"]): void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: "system",

  setTheme(theme) {
    set({ theme });

    // localStorage에 테마 설정 저장
    if (typeof window !== "undefined") {
      const existing = loadAppData();
      if (existing) {
        saveAppData({ ...existing, theme });
      }
    }
  },
}));
