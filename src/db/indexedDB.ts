import { AppSettings, BookkeepingRecord } from '../types';
import { DEFAULT_SETTINGS } from '../utils/calculator';

const DB_NAME = 'CatatanIswandiDB';
const DB_VERSION = 1;

const STORE_RECORDS = 'catatan';
const STORE_PHOTOS = 'foto_asli';
const STORE_SETTINGS = 'pengaturan';

let dbInstance: IDBDatabase | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store: Catatan Pembukuan
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const recordStore = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        recordStore.createIndex('tanggal', 'tanggal', { unique: false });
        recordStore.createIndex('rumpon', 'rumpon', { unique: false });
        recordStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Store: Foto Asli Buku Catatan (Large binary data)
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
      }

      // Store: Pengaturan & Konfigurasi
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// ======================
// FOTO ASLI OPERATIONS
// ======================
export async function savePhoto(id: string, base64Data: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PHOTOS], 'readwrite');
    const store = tx.objectStore(STORE_PHOTOS);
    const req = store.put({ id, data: base64Data, savedAt: new Date().toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPhoto(id: string): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PHOTOS], 'readonly');
    const store = tx.objectStore(STORE_PHOTOS);
    const req = store.get(id);
    req.onsuccess = () => {
      const result = req.result;
      resolve(result ? result.data : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PHOTOS], 'readwrite');
    const store = tx.objectStore(STORE_PHOTOS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ======================
// CATATAN OPERATIONS
// ======================
export async function getAllRecords(): Promise<BookkeepingRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDS], 'readonly');
    const store = tx.objectStore(STORE_RECORDS);
    const req = store.getAll();
    req.onsuccess = () => {
      const records: BookkeepingRecord[] = req.result || [];
      // Sort newest first
      records.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getRecordById(id: string): Promise<BookkeepingRecord | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDS], 'readonly');
    const store = tx.objectStore(STORE_RECORDS);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecord(record: BookkeepingRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDS], 'readwrite');
    const store = tx.objectStore(STORE_RECORDS);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRecord(id: string): Promise<void> {
  const record = await getRecordById(id);
  const db = await openDatabase();
  
  if (record?.fotoAsliId) {
    try {
      await deletePhoto(record.fotoAsliId);
    } catch (e) {
      console.warn('Failed to delete associated photo', e);
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDS], 'readwrite');
    const store = tx.objectStore(STORE_RECORDS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ======================
// PENGATURAN OPERATIONS
// ======================
export async function getSettings(): Promise<AppSettings> {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_SETTINGS], 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);
    const req = store.get('app_settings');
    req.onsuccess = () => {
      if (req.result && req.result.value) {
        resolve({ ...DEFAULT_SETTINGS, ...req.result.value });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    };
    req.onerror = () => {
      resolve(DEFAULT_SETTINGS);
    };
  });
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SETTINGS], 'readwrite');
    const store = tx.objectStore(STORE_SETTINGS);
    const req = store.put({ key: 'app_settings', value: settings, updatedAt: new Date().toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ======================
// CADANGKAN & PULIHKAN DATA
// ======================
export interface BackupArchive {
  version: number;
  appName: string;
  exportedAt: string;
  settings: AppSettings;
  records: BookkeepingRecord[];
  photos: Record<string, string>; // photoId -> base64
}

export async function exportBackupArchive(): Promise<BackupArchive> {
  const records = await getAllRecords();
  const settings = await getSettings();

  const photos: Record<string, string> = {};
  for (const r of records) {
    if (r.fotoAsliId) {
      const p = await getPhoto(r.fotoAsliId);
      if (p) photos[r.fotoAsliId] = p;
    }
  }

  return {
    version: 1,
    appName: 'Catatan by Iswandi',
    exportedAt: new Date().toISOString(),
    settings,
    records,
    photos,
  };
}

export async function importBackupArchive(archive: BackupArchive): Promise<{ recordsCount: number }> {
  if (!archive || !Array.isArray(archive.records)) {
    throw new Error('Format berkas cadangan tidak valid.');
  }

  const db = await openDatabase();

  // Save settings if present
  if (archive.settings) {
    await saveSettings(archive.settings);
  }

  // Save photos
  if (archive.photos) {
    for (const [id, base64] of Object.entries(archive.photos)) {
      if (id && base64) {
        await savePhoto(id, base64);
      }
    }
  }

  // Save records
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDS], 'readwrite');
    const store = tx.objectStore(STORE_RECORDS);

    for (const rec of archive.records) {
      store.put(rec);
    }

    tx.oncomplete = () => {
      resolve({ recordsCount: archive.records.length });
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Storage quota check for Android storage diagnostics
 */
export async function getStorageEstimate(): Promise<{ usedMb: number; quotaMb: number; percent: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const usedMb = Number((used / (1024 * 1024)).toFixed(1));
      const quotaMb = Number((quota / (1024 * 1024)).toFixed(1));
      const percent = quota > 0 ? Number(((used / quota) * 100).toFixed(1)) : 0;
      return { usedMb, quotaMb, percent };
    } catch (e) {
      console.warn('Storage estimate failed', e);
    }
  }
  return { usedMb: 0, quotaMb: 0, percent: 0 };
}
