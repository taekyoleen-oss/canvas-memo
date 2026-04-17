import { create } from "zustand";

interface RichTextState {
  isEditorFocused: boolean;
  setEditorFocused: (v: boolean) => void;
}

export const useRichTextStore = create<RichTextState>((set) => ({
  isEditorFocused: false,
  setEditorFocused: (v) => set({ isEditorFocused: v }),
}));
