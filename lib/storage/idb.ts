/**
 * 최소 IndexedDB 비동기 래퍼 — 외부 의존성 없이 `indexedDB`만 사용.
 *
 * DB명: `mindcanvas`, objectStore: `appData`, key: 문자열, value: 문자열(직렬화된 JSON).
 * SSR(window/indexedDB 없음) 환경에서는 모든 호출이 안전하게 no-op/null을 반환한다.
 *
 * 캔버스 캐시는 base64 미디어를 포함해 수 MB가 될 수 있어 localStorage(~5MB) 한도를
 * 넘기므로(QuotaExceededError) IndexedDB(수백 MB 가용)에 보관한다.
 */

const DB_NAME = "mindcanvas";
const STORE_NAME = "appData";
const DB_VERSION = 1;

/** IndexedDB 사용 가능 여부 (SSR/구형 브라우저 가드) */
export function isIdbAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!isIdbAvailable()) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // 다른 탭이 더 높은 버전으로 업그레이드를 요청하면 이 연결을 닫아 차단을 막는다.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });

  // 열기 실패 시 다음 호출에서 재시도할 수 있도록 캐시를 비운다.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STORE_NAME, mode);
        } catch (err) {
          reject(err);
          return;
        }
        const store = tx.objectStore(STORE_NAME);
        const req = body(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      })
  );
}

/** key에 해당하는 문자열 값을 읽는다. 없으면 null. 실패/미지원 시 null. */
export async function idbGet(key: string): Promise<string | null> {
  if (!isIdbAvailable()) return null;
  try {
    const value = await runTransaction<unknown>("readonly", (store) => store.get(key));
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/** key에 문자열 값을 저장한다. 실패/미지원 시 throw (호출부에서 폴백 처리). */
export async function idbSet(key: string, value: string): Promise<void> {
  if (!isIdbAvailable()) {
    throw new Error("IndexedDB unavailable");
  }
  await runTransaction<IDBValidKey>("readwrite", (store) => store.put(value, key));
}

/** key를 삭제한다. 실패/미지원 시 조용히 무시. */
export async function idbDel(key: string): Promise<void> {
  if (!isIdbAvailable()) return;
  try {
    await runTransaction<undefined>("readwrite", (store) => store.delete(key));
  } catch {
    /* ignore */
  }
}
