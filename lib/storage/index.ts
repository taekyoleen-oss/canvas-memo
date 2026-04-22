import { AppData } from "@/types";
import { migrateAppData } from "./migrations";

/** 로그인 이전 단일 키(레거시). 계정별 키로 이전 후에는 사용하지 않습니다. */
export const STORAGE_KEY = "mindcanvas_v1";

/** 로그인한 사용자별 캔버스 캐시 키 */
export function canvasStorageKey(userId: string): string {
  return `mindcanvas_v1_u_${userId}`;
}

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

/** 특정 사용자 계정용 캔버스 캐시 로드 */
export function loadAppDataForUser(userId: string): AppData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(canvasStorageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return migrateAppData(parsed);
  } catch (err) {
    console.error("[MindCanvas] Failed to load user app data:", err);
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

export function saveAppDataForUser(userId: string, data: AppData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(canvasStorageKey(userId), JSON.stringify(data));
  } catch (err) {
    console.error("[MindCanvas] Failed to save user app data:", err);
  }
}

/**
 * 500ms debounce 자동저장 함수를 생성합니다.
 * @param fn 최신 AppData를 반환하는 함수
 * @param userId 지정 시 해당 계정 전용 키에 저장 (로그인 후 캔버스)
 * @returns debounced save 함수
 */
export function createDebouncedSave(fn: () => AppData, userId?: string): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function debouncedSave() {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      const data = fn();
      if (userId) saveAppDataForUser(userId, data);
      else saveAppData(data);
      timer = null;
    }, 500);
  };
}
