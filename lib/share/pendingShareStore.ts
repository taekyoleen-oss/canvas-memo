import type { PendingShareItem } from "@/types";

/**
 * Web Share Target 큐 — 서비스워커가 push, /share-target 페이지가 drain.
 * vanilla IndexedDB로 직접 구현해 추가 의존성 없이 유지.
 *
 * DB: "mindcanvas-share"
 * Store: "pending"  keyPath: "id"
 */

const DB_NAME = "mindcanvas-share";
const DB_VERSION = 1;
const STORE = "pending";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("receivedAt", "receivedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function pushPendingShareItems(items: PendingShareItem[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    for (const it of items) os.put(it);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function drainPendingShareItems(): Promise<PendingShareItem[]> {
  const db = await openDB();
  const items = await new Promise<PendingShareItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    const getAll = os.getAll();
    getAll.onsuccess = () => {
      const list = (getAll.result ?? []) as PendingShareItem[];
      const clear = os.clear();
      clear.onsuccess = () => {
        list.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
        resolve(list);
      };
      clear.onerror = () => reject(clear.error);
    };
    getAll.onerror = () => reject(getAll.error);
  });
  db.close();
  return items;
}
