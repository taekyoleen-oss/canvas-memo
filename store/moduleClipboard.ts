import { create } from "zustand";
import type { Module } from "@/types";

interface ModuleClipboardState {
  payload: { type: Module["type"]; data: Module["data"] } | null;
  copy: (type: Module["type"], data: Module["data"]) => void;
  clear: () => void;
}

export const useModuleClipboardStore = create<ModuleClipboardState>((set) => ({
  payload: null,
  copy: (type, data) =>
    set({ payload: { type, data: JSON.parse(JSON.stringify(data)) } }),
  clear: () => set({ payload: null }),
}));
