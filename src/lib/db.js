// IndexedDB 래퍼: ISS 좌표를 timestamp(ms) 키로 저장하고 최근 4시간만 유지한다.
const DB_NAME = 'iss-tracker';
const STORE = 'positions';
export const RETENTION_MS = 4 * 60 * 60 * 1000;

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 't' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const result = fn(store);
        t.oncomplete = () => resolve(result?.result ?? result);
        t.onerror = () => reject(t.error);
      }),
  );
}

export function addPosition(point) {
  return tx('readwrite', (store) => store.put(point));
}

export function pruneOld(now = Date.now()) {
  return tx('readwrite', (store) => store.delete(IDBKeyRange.upperBound(now - RETENTION_MS, true)));
}

export function getRecent(now = Date.now()) {
  return tx('readonly', (store) => store.getAll(IDBKeyRange.lowerBound(now - RETENTION_MS)));
}

export function clearAll() {
  return tx('readwrite', (store) => store.clear());
}
