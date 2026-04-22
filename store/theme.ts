import { create } from "zustand";
import { loadAppDataForUser, saveAppDataForUser } from "@/lib/storage";
import { useAuthStore } from "@/store/auth";

interface ThemeStore {
  theme: "light" | "dark" | "system";
  setTheme(theme: ThemeStore["theme"]): void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: "system",

  setTheme(theme) {
    set({ theme });

    if (typeof window === "undefined") return;
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    const existing = loadAppDataForUser(userId);
    const base = existing ?? {
      version: 1,
      theme: "system",
      boards: [],
      lastOpenedBoardId: null,
    };
    saveAppDataForUser(userId, { ...base, theme });
  },
}));
