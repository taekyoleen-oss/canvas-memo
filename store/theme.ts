import { create } from "zustand";
import { loadAppDataForUserSync, saveAppDataForUser } from "@/lib/storage";
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

    const existing = loadAppDataForUserSync(userId);
    const base = existing ?? {
      version: 1,
      theme: "system",
      boards: [],
      lastOpenedBoardId: null,
    };
    void saveAppDataForUser(userId, { ...base, theme });
  },
}));
