import { AppData, Module, ImageData, FileData } from "@/types";
import { migrateAppData } from "./migrations";
import { idbGet, idbSet, idbDel, isIdbAvailable } from "./idb";

/** 로그인 이전 단일 키(레거시). 계정별 키로 이전 후에는 사용하지 않습니다. */
export const STORAGE_KEY = "mindcanvas_v1";

/** 로그인한 사용자별 캔버스 캐시 키 (IndexedDB / 폴백 localStorage 공용) */
export function canvasStorageKey(userId: string): string {
  return `mindcanvas_v1_u_${userId}`;
}

/**
 * 사용자별 캐시의 동기 미러.
 *
 * 캐시 저장소가 IndexedDB(비동기)로 이전됨에 따라, 동기 접근이 필요한 기존 호출부
 * (theme 저장, debouncedSave의 이전 theme 조회, boardRecovery 스냅샷 수집)를 위해
 * 마지막으로 로드/저장된 AppData를 메모리에 미러링한다. hydrate 단계에서 async
 * load가 한 번 await되면 이 미러가 채워진다.
 */
const userDataMirror = new Map<string, AppData>();

/** 동기 미러에서 사용자 AppData를 반환 (로드/저장 이력이 없으면 null) */
export function loadAppDataForUserSync(userId: string): AppData | null {
  return userDataMirror.get(userId) ?? null;
}

/**
 * localStorage에서 AppData를 읽어 반환합니다. (레거시 공용 키 전용 — 동기 유지)
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
 * 특정 사용자 계정용 캔버스 캐시 로드 (async, IndexedDB 기반).
 *
 * - 최초 1회: 기존 localStorage 키(`mindcanvas_v1_u_<userId>`)가 있으면 IndexedDB로
 *   옮기고 localStorage 키를 제거한다(마이그레이션).
 * - IndexedDB 미지원/실패 시 localStorage 폴백.
 * - 로드 성공 시 동기 미러를 갱신한다.
 */
export async function loadAppDataForUser(userId: string): Promise<AppData | null> {
  if (typeof window === "undefined") return null;
  const key = canvasStorageKey(userId);

  // 1) localStorage → IndexedDB 1회성 마이그레이션
  await migrateLegacyLocalToIdb(key);

  // 2) IndexedDB 우선
  let raw: string | null = null;
  if (isIdbAvailable()) {
    raw = await idbGet(key);
  }

  // 3) IDB에 없으면 localStorage 폴백(미지원 환경 포함)
  if (raw === null) {
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
  }

  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    const data = migrateAppData(parsed);
    userDataMirror.set(userId, data);
    return data;
  } catch (err) {
    console.error("[MindCanvas] Failed to load user app data:", err);
    return null;
  }
}

/** 기존 localStorage 계정 캐시가 있으면 IDB로 옮기고 localStorage에서 제거 */
async function migrateLegacyLocalToIdb(key: string): Promise<void> {
  if (!isIdbAvailable()) return;
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(key);
  } catch {
    legacy = null;
  }
  if (legacy === null) return;
  try {
    await idbSet(key, legacy);
    localStorage.removeItem(key);
  } catch {
    // IDB 저장 실패 시 localStorage 원본을 보존(다음 로드에서 다시 시도)
  }
}

/**
 * AppData를 localStorage에 저장합니다. (레거시 공용 키 전용 — 동기 유지)
 */
export function saveAppData(data: AppData): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    if (isQuotaError(err)) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slimAppData(data)));
        return;
      } catch (err2) {
        console.error("[MindCanvas] Failed to save app data (slim):", err2);
        return;
      }
    }
    console.error("[MindCanvas] Failed to save app data:", err);
  }
}

/**
 * 특정 사용자 계정용 캔버스 캐시 저장 (async, IndexedDB 기반).
 *
 * - 동기 미러를 즉시 갱신한다.
 * - IndexedDB 저장. 미지원/실패 시 localStorage 폴백.
 * - localStorage 폴백이 QuotaExceeded면 base64 미디어를 제외한 슬림 복사본으로 재시도.
 */
export async function saveAppDataForUser(userId: string, data: AppData): Promise<void> {
  if (typeof window === "undefined") return;
  userDataMirror.set(userId, data);
  const key = canvasStorageKey(userId);
  const serialized = JSON.stringify(data);

  if (isIdbAvailable()) {
    try {
      await idbSet(key, serialized);
      return;
    } catch (err) {
      console.warn(
        "[MindCanvas] IndexedDB save failed, falling back to localStorage:",
        err
      );
    }
  }

  // localStorage 폴백
  try {
    localStorage.setItem(key, serialized);
  } catch (err) {
    if (isQuotaError(err)) {
      try {
        localStorage.setItem(key, JSON.stringify(slimAppData(data)));
        notifyQuotaFallback();
        return;
      } catch (err2) {
        console.error("[MindCanvas] Failed to save user app data (slim):", err2);
        notifyQuotaFallback();
        return;
      }
    }
    console.error("[MindCanvas] Failed to save user app data:", err);
  }
}

/** QuotaExceededError 판별 (브라우저별 name/코드 차이 흡수) */
function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    /quota/i.test(err.message)
  );
}

/**
 * base64 미디어(ImageData.src/srcs, FileData.src)를 제거한 슬림 복사본.
 * localStorage 폴백 시 용량 초과를 피하기 위한 최후의 수단(미디어는 Supabase/IDB에 보존).
 */
function slimAppData(data: AppData): AppData {
  return {
    ...data,
    boards: data.boards.map((board) => ({
      ...board,
      modules: board.modules.map(slimModule),
    })),
  };
}

function slimModule(m: Module): Module {
  if (m.type === "image") {
    const d = m.data as ImageData;
    const slim: ImageData = { ...d, src: "", srcs: [] };
    return { ...m, data: slim };
  }
  if (m.type === "file") {
    const d = m.data as FileData;
    const slim: FileData = { ...d, src: "" };
    return { ...m, data: slim };
  }
  return m;
}

/** 폴백(슬림) 저장이 발생했음을 앱에 알리는 훅. UI 레이어가 등록한다. */
let quotaFallbackListener: (() => void) | null = null;
export function setQuotaFallbackListener(fn: (() => void) | null): void {
  quotaFallbackListener = fn;
}
function notifyQuotaFallback(): void {
  try {
    quotaFallbackListener?.();
  } catch {
    /* ignore */
  }
}

/** 사용자 캐시를 IndexedDB와 localStorage 양쪽에서 제거 (계정 정리용) */
export async function clearAppDataForUser(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const key = canvasStorageKey(userId);
  userDataMirror.delete(userId);
  await idbDel(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * 500ms debounce 자동저장 함수를 생성합니다.
 *
 * 저장은 비동기(IndexedDB)이며, debounce 타이밍 자체는 동기 setTimeout으로 유지됩니다.
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
      timer = null;
      const data = fn();
      if (userId) {
        void saveAppDataForUser(userId, data);
      } else {
        saveAppData(data);
      }
    }, 500);
  };
}
