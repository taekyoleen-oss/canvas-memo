import { AppData } from "@/types";
import { migrateAppData } from "./migrations";

export const STORAGE_KEY = "mindcanvas_v1";

/**
 * localStorage에서 AppData를 읽어 반환합니다.
 * 데이터가 없거나 파싱 실패 시 null을 반환합니다.
 */
export function loadAppData(): AppData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return migrateAppData(parsed);
  } catch (err) {
    console.error("[MindCanvas] Failed to load app data:", err);
    return null;
  }
}

/**
 * AppData를 localStorage에 저장합니다.
 */
export function saveAppData(data: AppData): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("[MindCanvas] Failed to save app data:", err);
  }
}

/**
 * 500ms debounce 자동저장 함수를 생성합니다.
 * @param fn 최신 AppData를 반환하는 함수
 * @returns debounced save 함수
 */
export function createDebouncedSave(fn: () => AppData): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function debouncedSave() {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      const data = fn();
      saveAppData(data);
      timer = null;
    }, 500);
  };
}
