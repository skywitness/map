/**
 * 這個瀏覽器自己的資料（IndexedDB `world-map-personal`）：我的路線（lib/personalRoutes.ts，store `routes`）與
 * 本機匯入（lib/localData.ts，store `local-sources`、`local-files`，2026-11-03 第 2 版加的）。兩邊共用同一個連線，
 * 版本號只寫在這裡：各自 open 不同版本的話，舊版的那一邊會打不開（VersionError）。
 */
const DB_NAME = 'world-map-personal';
const VERSION = 2;

export const ROUTES_STORE = 'routes';
export const LOCAL_SOURCES = 'local-sources';
export const LOCAL_FILES = 'local-files';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openPersonalDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ROUTES_STORE)) {
        const store = db.createObjectStore(ROUTES_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('topic', 'topic');
      }
      if (!db.objectStoreNames.contains(LOCAL_SOURCES)) db.createObjectStore(LOCAL_SOURCES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(LOCAL_FILES)) db.createObjectStore(LOCAL_FILES);
    };
    req.onsuccess = () => {
      const db = req.result;
      // 另一個分頁升級版本時讓出連線，下次再開
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('world-map-personal is open in another tab with an older version'));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
