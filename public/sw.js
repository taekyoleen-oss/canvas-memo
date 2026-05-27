/* MindCanvas Service Worker — Web Share Target intercept.
 * Buffers POST /share-target into IndexedDB and redirects to /share-target?ok=1.
 * Bumping SW_VERSION forces clients to update.
 */
const SW_VERSION = "share-target-v1";
const MAX_BYTES = 8 * 1024 * 1024;
const DB_NAME = "mindcanvas-share";
const DB_VERSION = 1;
const STORE = "pending";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function openDB() {
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

async function pushItems(items) {
  if (!items.length) return;
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    for (const it of items) os.put(it);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function uuid() {
  if (self.crypto && typeof self.crypto.randomUUID === "function") {
    return self.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleShareTarget(request) {
  const items = [];
  const now = new Date().toISOString();
  try {
    const formData = await request.formData();
    const title = formData.get("title");
    const text = formData.get("text");
    const url = formData.get("url");
    const files = formData.getAll("files");

    if (typeof url === "string" && url.trim()) {
      items.push({
        id: uuid(),
        kind: "url",
        url: url.trim(),
        title: typeof title === "string" ? title : undefined,
        receivedAt: now,
      });
    }
    if (
      typeof text === "string" &&
      text.trim() &&
      !(typeof url === "string" && url.trim())
    ) {
      items.push({
        id: uuid(),
        kind: "text",
        text,
        title: typeof title === "string" ? title : undefined,
        receivedAt: now,
      });
    }

    for (const f of files) {
      if (!(f instanceof File)) continue;
      const isImage = f.type.startsWith("image/");
      if (f.size > MAX_BYTES) {
        items.push({
          id: uuid(),
          kind: isImage ? "image" : "file",
          fileName: f.name,
          fileType: f.type,
          fileSize: f.size,
          rejectedReason: "too_large",
          receivedAt: now,
        });
        continue;
      }
      const dataUrl = await fileToDataUrl(f);
      items.push({
        id: uuid(),
        kind: isImage ? "image" : "file",
        fileName: f.name,
        fileType: f.type,
        fileSize: f.size,
        dataUrl,
        receivedAt: now,
      });
    }

    await pushItems(items);
  } catch (err) {
    console.warn("[sw " + SW_VERSION + "] share-target handler error:", err);
  }
  return Response.redirect("/share-target?ok=1", 303);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "POST") return;
  const url = new URL(req.url);
  if (url.pathname !== "/share-target") return;
  event.respondWith(handleShareTarget(req));
});
