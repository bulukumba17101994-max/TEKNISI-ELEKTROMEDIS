import {
  AlkesItem,
  BeritaAcaraPenarikan,
  PemeliharaanItem,
  PerbaikanItem,
  DAFTAR_RUANGAN,
  RuanganType,
  KondisiAlatType,
  KeteranganAlatType,
  StatusKalibrasiType,
} from '../types';
import {
  INITIAL_BERITA_ACARA,
  INITIAL_INVENTARIS,
  INITIAL_PEMELIHARAAN,
  INITIAL_PERBAIKAN,
  DEMO_DATA_IDS,
  isDemoId,
} from '../data/initialData';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// BroadcastChannel for instant cross-tab / multi-window sync
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('rsud_lamaddukelleng_sync_channel_v2');
  }
} catch (e) {
  console.warn('BroadcastChannel not supported in this environment', e);
}

const DELETED_IDS_STORAGE_KEY = 'sim_alkes_deleted_ids';

export const getDeletedIdsMap = (): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    // Ensure all demo data IDs are recorded as deleted
    DEMO_DATA_IDS.forEach((id) => {
      map[id] = map[id] || 1;
    });
    return map;
  } catch {
    return {};
  }
};

export const recordDeletedId = (id: string) => {
  if (typeof window === 'undefined' || !id) return;
  try {
    const map = getDeletedIdsMap();
    map[id] = Date.now();
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(map));

    // Instantly remove from local storage caches
    ['sim_alkes_inventaris', 'sim_alkes_pemeliharaan', 'sim_alkes_perbaikan', 'sim_alkes_bap'].forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const next = parsed.filter((it: any) => it && it.id !== id);
            localStorage.setItem(key, JSON.stringify(next));
          }
        } catch {}
      }
    });
  } catch (e) {
    console.warn('Failed to record deleted id', e);
  }
};

/**
 * Pembersihan Menyeluruh Data Demo dari Seluruh Storage Browser
 */
export const purgeDemoDataFromLocalStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const delMap = getDeletedIdsMap();
    DEMO_DATA_IDS.forEach((id) => {
      delMap[id] = delMap[id] || Date.now();
    });
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(delMap));

    const purgeKey = (key: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((it: any) => it && it.id && !delMap[it.id] && !isDemoId(it.id));
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      } catch {}
    };

    purgeKey('sim_alkes_inventaris');
    purgeKey('sim_alkes_pemeliharaan');
    purgeKey('sim_alkes_perbaikan');
    purgeKey('sim_alkes_bap');
  } catch (e) {
    console.warn('Failed to purge demo data from localStorage', e);
  }
};

// Auto-purge demo data on client load
if (typeof window !== 'undefined') {
  purgeDemoDataFromLocalStorage();
}

export const loadLocalData = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    if (item) {
      const parsed = JSON.parse(item);
      if (Array.isArray(parsed)) {
        const delMap = getDeletedIdsMap();
        const nonDeleted = parsed.filter((it: any) => it && it.id && !delMap[it.id] && !isDemoId(it.id));

        if (key === 'sim_alkes_inventaris') {
          return nonDeleted.map((it: any) => ({
            ...it,
            kalibrasiTerakhir: normalizeDateString(it.kalibrasiTerakhir),
            kalibrasiBerikutnya: normalizeDateString(it.kalibrasiBerikutnya),
          })) as unknown as T;
        }
        if (key === 'sim_alkes_pemeliharaan' || key === 'sim_alkes_perbaikan' || key === 'sim_alkes_bap') {
          return nonDeleted.map((it: any) => ({
            ...it,
            tanggal: normalizeDateString(it.tanggal),
          })) as unknown as T;
        }
        return nonDeleted as unknown as T;
      }
      return parsed;
    }
  } catch (err) {
    console.error(`Error loading key ${key} from localStorage`, err);
  }
  return defaultValue;
};

/**
 * Resilient Bidirectional Merge:
 * Merges local and remote datasets by ID.
 * - Never drops local unpushed items.
 * - Always keeps the newest version based on timestamp.
 * - Filters out deleted items and demo data.
 * - Returns pendingToPush so local changes get persisted to backend.
 */
export const mergeDatasets = <T extends { id: string; updatedAt?: string; createdAt?: string }>(
  localList: T[],
  remoteList: T[],
  deletedIdMap?: Record<string, number>
): { merged: T[]; pendingToPush: T[] } => {
  const map = new Map<string, T>();
  const pendingToPush: T[] = [];
  const delMap = deletedIdMap || getDeletedIdsMap();

  // 1. Add remote items
  if (Array.isArray(remoteList)) {
    remoteList.forEach((remoteItem) => {
      if (!remoteItem || !remoteItem.id) return;
      if (delMap[remoteItem.id] || isDemoId(remoteItem.id)) return;
      map.set(remoteItem.id, remoteItem);
    });
  }

  // 2. Merge local items
  if (Array.isArray(localList)) {
    localList.forEach((localItem) => {
      if (!localItem || !localItem.id) return;
      if (delMap[localItem.id] || isDemoId(localItem.id)) return;

      if (!map.has(localItem.id)) {
        // Exists in client but NOT in remote -> keep locally and queue to push to server!
        map.set(localItem.id, localItem);
        pendingToPush.push(localItem);
      } else {
        const remoteItem = map.get(localItem.id)!;
        const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
        const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime();

        if (localTime >= remoteTime) {
          // Local is newer or equal -> keep local
          map.set(localItem.id, localItem);
          if (localTime > remoteTime) {
            pendingToPush.push(localItem);
          }
        }
      }
    });
  }

  // Anti-wipe protection: If remote is empty, but localList had items, preserve all of localList and queue to push
  if ((!remoteList || remoteList.length === 0) && Array.isArray(localList) && localList.length > 0) {
    localList.forEach((it) => {
      if (it && it.id && !delMap[it.id] && !isDemoId(it.id)) {
        if (!map.has(it.id)) {
          map.set(it.id, it);
        }
        if (!pendingToPush.some((p) => p.id === it.id)) {
          pendingToPush.push(it);
        }
      }
    });
  }

  return {
    merged: Array.from(map.values()),
    pendingToPush,
  };
};

/**
 * Request permanent browser storage permission to prevent 7-day eviction in iOS Safari & Android Chrome
 */
export const requestStoragePersistence = async (): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[SIM-ALKES] Storage persistence granted: ${granted}`);
        return granted;
      }
      return true;
    } catch (e) {
      console.warn('[SIM-ALKES] Error requesting storage persistence:', e);
    }
  }
  return false;
};

// Automatic call on client startup
if (typeof window !== 'undefined') {
  requestStoragePersistence().catch(() => {});
}

const CACHE_SNAPSHOT_NAME = 'sim_alkes_offline_snapshot_v1';

export const saveToCacheBackup = async (key: string, data: any) => {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open(CACHE_SNAPSHOT_NAME);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'X-SIM-ALKES-TIMESTAMP': String(Date.now()) },
    });
    await cache.put(new Request(`/offline-backup/${key}`), response);
  } catch {}
};

export const loadFromCacheBackup = async <T>(key: string): Promise<T | null> => {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await caches.open(CACHE_SNAPSHOT_NAME);
    const response = await cache.match(new Request(`/offline-backup/${key}`));
    if (response) {
      return (await response.json()) as T;
    }
  } catch {}
  return null;
};

const IDB_NAME = 'sim_alkes_offline_db_v1';
const IDB_STORE = 'collections';

const openPersistentDb = (): Promise<IDBDatabase | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) return resolve(null);
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const saveToPersistentStorage = async (key: string, data: any) => {
  try {
    const db = await openPersistentDb();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(data, key);
  } catch {
    // Non-blocking background save
  }
};

export const loadFromPersistentStorage = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await openPersistentDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const restoreFromPersistentIndexedDb = async (): Promise<{
  inventaris?: AlkesItem[];
  pemeliharaan?: PemeliharaanItem[];
  perbaikan?: PerbaikanItem[];
  beritaAcara?: BeritaAcaraPenarikan[];
} | null> => {
  if (typeof window === 'undefined') return null;
  try {
    let inv = await loadFromPersistentStorage<AlkesItem[]>('sim_alkes_inventaris');
    let ppm = await loadFromPersistentStorage<PemeliharaanItem[]>('sim_alkes_pemeliharaan');
    let fix = await loadFromPersistentStorage<PerbaikanItem[]>('sim_alkes_perbaikan');
    let bap = await loadFromPersistentStorage<BeritaAcaraPenarikan[]>('sim_alkes_bap');

    // Fallback to CacheStorage snapshot if IndexedDB was somehow cleared
    if (!inv || inv.length === 0) inv = await loadFromCacheBackup<AlkesItem[]>('sim_alkes_inventaris');
    if (!ppm || ppm.length === 0) ppm = await loadFromCacheBackup<PemeliharaanItem[]>('sim_alkes_pemeliharaan');
    if (!fix || fix.length === 0) fix = await loadFromCacheBackup<PerbaikanItem[]>('sim_alkes_perbaikan');
    if (!bap || bap.length === 0) bap = await loadFromCacheBackup<BeritaAcaraPenarikan[]>('sim_alkes_bap');

    const result: any = {};
    const delMap = getDeletedIdsMap();

    if (Array.isArray(inv) && inv.length > 0) {
      result.inventaris = inv.filter((i) => i && i.id && !delMap[i.id] && !isDemoId(i.id));
      localStorage.setItem('sim_alkes_inventaris', JSON.stringify(result.inventaris));
    }
    if (Array.isArray(ppm) && ppm.length > 0) {
      result.pemeliharaan = ppm.filter((p) => p && p.id && !delMap[p.id] && !isDemoId(p.id));
      localStorage.setItem('sim_alkes_pemeliharaan', JSON.stringify(result.pemeliharaan));
    }
    if (Array.isArray(fix) && fix.length > 0) {
      result.perbaikan = fix.filter((p) => p && p.id && !delMap[p.id] && !isDemoId(p.id));
      localStorage.setItem('sim_alkes_perbaikan', JSON.stringify(result.perbaikan));
    }
    if (Array.isArray(bap) && bap.length > 0) {
      result.beritaAcara = bap.filter((b) => b && b.id && !delMap[b.id] && !isDemoId(b.id));
      localStorage.setItem('sim_alkes_bap', JSON.stringify(result.beritaAcara));
    }

    if (Object.keys(result).length > 0) {
      return result;
    }
  } catch (e) {
    console.warn('Failed to restore from persistent storage', e);
  }
  return null;
};

export const saveLocalData = (key: string, data: any, forceAllowEmpty: boolean = false) => {
  if (typeof window === 'undefined') return;

  // Anti-accidental-wipe guard:
  // If data is an empty array and not explicitly forced, but localStorage already has valid items, do NOT wipe!
  if (!forceAllowEmpty && Array.isArray(data) && data.length === 0) {
    try {
      const existing = localStorage.getItem(key);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Keep existing items!
          return;
        }
      }
    } catch {}
  }

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving key ${key} to localStorage`, err);
  }
  // Secondary persistent IndexedDB backup (resilient against iOS 7-day eviction)
  saveToPersistentStorage(key, data);
  // Tertiary CacheStorage backup snapshot
  saveToCacheBackup(key, data);
};

export const broadcastChange = (type: 'inventaris' | 'pemeliharaan' | 'perbaikan' | 'bap', payload: any) => {
  if (syncChannel) {
    try {
      syncChannel.postMessage({
        type,
        payload,
        sender: 'Tab-' + Math.random().toString(36).substring(2, 6),
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('Failed to broadcast change', e);
    }
  }
};

export const broadcastDelete = (
  type: 'inventaris' | 'pemeliharaan' | 'perbaikan' | 'bap',
  id: string
) => {
  if (syncChannel) {
    try {
      syncChannel.postMessage({
        type: `delete_${type}`,
        payload: { id },
        sender: 'Tab-' + Math.random().toString(36).substring(2, 6),
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('Failed to broadcast delete', e);
    }
  }
};

export const subscribeSyncChannel = (
  callback: (event: { type: string; payload: any; sender: string; timestamp: number }) => void
) => {
  if (!syncChannel) return () => {};

  const handler = (msg: MessageEvent) => {
    if (msg.data && msg.data.type) {
      callback(msg.data);
    }
  };

  syncChannel.addEventListener('message', handler);
  return () => {
    syncChannel?.removeEventListener('message', handler);
  };
};

/**
 * Real-Time Multi-Device SSE Stream (Server-Sent Events)
 * Receives instant server broadcasts across all devices, tabs, and background sessions
 */
export const subscribeServerEvents = (onEvent: (event: any) => void) => {
  if (typeof window === 'undefined' || !('EventSource' in window)) return () => {};

  let eventSource: EventSource | null = null;
  let reconnectTimer: any = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onEvent(parsed);
        } catch (err) {
          // ignore keep-alive or raw strings
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      if (!isClosed) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 4000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
};

export const pullBackendData = async () => {
  try {
    const res = await fetch('/api/sync/all');
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        return json.data;
      }
    }
  } catch (e) {
    console.warn('Backend sync is currently unreachable. Using client-side database.', e);
  }
  return null;
};

export const pushItemToBackend = async (
  type: 'inventaris' | 'pemeliharaan' | 'perbaikan' | 'bap',
  item: any
) => {
  try {
    const collection = type === 'bap' ? 'beritaAcara' : type;
    const res = await fetch('/api/sync/item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, collection, item }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Offline mode
  }
  return null;
};

export const deleteItemFromBackend = async (
  type: 'inventaris' | 'pemeliharaan' | 'perbaikan' | 'bap',
  id: string
) => {
  // Always record locally immediately
  recordDeletedId(id);
  try {
    const collection = type === 'bap' ? 'beritaAcara' : type;
    const res = await fetch(`/api/sync/item/${collection}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to delete item from backend', e);
  }
  return null;
};

export const pushBatchAlkesToBackend = async (items: AlkesItem[]) => {
  try {
    const res = await fetch('/api/inventaris/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to push batch alkes to backend', e);
  }
  return null;
};

export const clearLocalInventarisCache = (clearedAt?: number) => {
  saveLocalData('sim_alkes_inventaris', [], true);
  if (typeof window !== 'undefined' && clearedAt) {
    try {
      localStorage.setItem('sim_alkes_inventaris_cleared_at', String(clearedAt));
    } catch {}
  }
};

export const clearInventarisFromBackend = async (): Promise<{ success?: boolean; clearedAt?: number } | null> => {
  try {
    const res = await fetch('/api/inventaris/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to clear inventaris on backend', e);
  }
  return null;
};

export const pushBatchSyncToBackend = async (payload: {
  inventaris?: any[];
  pemeliharaan?: any[];
  perbaikan?: any[];
  beritaAcara?: any[];
}) => {
  try {
    const res = await fetch('/api/sync/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
    // Fallback to /api/sync/merge
    const resMerge = await fetch('/api/sync/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resMerge.ok) {
      return await resMerge.json();
    }
  } catch (e) {
    console.warn('Failed to push batch sync to backend', e);
  }
  return null;
};

export const normalizeDateString = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  let str = String(val).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return '';

  // 1. Format YYYY-MM-DD langsung
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.slice(0, 10);
  }

  // 2. Format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Tangani format angka serial Excel (misal 46247)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const utcDays = serial - 25569;
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) {
      const y = dateInfo.getFullYear();
      const m = String(dateInfo.getMonth() + 1).padStart(2, '0');
      const d = String(dateInfo.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 4. Tangani format JavaScript Date string seperti "Thu Aug 13 2026 00:00:00 GMT+0800 (Singapore Standard Time)"
  // atau format teks standar Date.parse
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
};

export const calculateNextCalibration = (
  lastCalibDate: string
): { nextDate: string; status: 'Terkalibrasi' | 'Perlu Kalibrasi' | 'Kadaluarsa' } => {
  if (!lastCalibDate) {
    return { nextDate: '', status: 'Perlu Kalibrasi' };
  }
  try {
    const cleanDateStr = normalizeDateString(lastCalibDate);
    if (!cleanDateStr) return { nextDate: '', status: 'Perlu Kalibrasi' };

    // Parse YYYY-MM-DD components directly to avoid timezone drift
    const parts = cleanDateStr.split('-');
    let nextDate = '';
    let targetTime = 0;

    if (parts.length === 3) {
      const y = parseInt(parts[0], 10) + 1;
      const m = parts[1];
      const d = parts[2];
      nextDate = `${y}-${m}-${d}`;
      targetTime = new Date(y, parseInt(m, 10) - 1, parseInt(d, 10)).getTime();
    } else {
      const d = new Date(cleanDateStr);
      if (isNaN(d.getTime())) return { nextDate: '', status: 'Perlu Kalibrasi' };
      d.setFullYear(d.getFullYear() + 1);
      const ny = d.getFullYear();
      const nm = String(d.getMonth() + 1).padStart(2, '0');
      const nd = String(d.getDate()).padStart(2, '0');
      nextDate = `${ny}-${nm}-${nd}`;
      targetTime = d.getTime();
    }

    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const diffDays = Math.round((targetTime - todayZero) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { nextDate, status: 'Kadaluarsa' };
    } else if (diffDays <= 30) {
      return { nextDate, status: 'Perlu Kalibrasi' };
    } else {
      return { nextDate, status: 'Terkalibrasi' };
    }
  } catch {
    return { nextDate: '', status: 'Perlu Kalibrasi' };
  }
};

export const dispatchBapEmail = async (
  bap: BeritaAcaraPenarikan,
  recipientEmail?: string,
  notes?: string,
  senderTechnician?: string
) => {
  try {
    const res = await fetch('/api/email/dispatch-bap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bap,
        recipientEmail,
        notes,
        senderTechnician,
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Email dispatch server unreachable', e);
  }
  return null;
};

export const syncToGoogleSheets = async (data: {
  webhookUrl?: string;
  inventaris?: AlkesItem[];
  pemeliharaan?: PemeliharaanItem[];
  perbaikan?: PerbaikanItem[];
  beritaAcara?: BeritaAcaraPenarikan[];
}) => {
  try {
    const res = await fetch('/api/sheets/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Sheets sync request failed', e);
  }
  return null;
};

export const pullFromGoogleSheets = async (webhookUrl?: string) => {
  try {
    const res = await fetch('/api/sheets/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.data) {
        const delMap = getDeletedIdsMap();
        if (Array.isArray(data.data.inventaris)) {
          data.data.inventaris = data.data.inventaris.filter((i: any) => i && i.id && !delMap[i.id] && !isDemoId(i.id));
        }
        if (Array.isArray(data.data.pemeliharaan)) {
          data.data.pemeliharaan = data.data.pemeliharaan.filter((p: any) => p && p.id && !delMap[p.id] && !isDemoId(p.id));
        }
        if (Array.isArray(data.data.perbaikan)) {
          data.data.perbaikan = data.data.perbaikan.filter((p: any) => p && p.id && !delMap[p.id] && !isDemoId(p.id));
        }
        if (Array.isArray(data.data.beritaAcara)) {
          data.data.beritaAcara = data.data.beritaAcara.filter((b: any) => b && b.id && !delMap[b.id] && !isDemoId(b.id));
        }
      }
      return data;
    }
  } catch (e) {
    console.warn('Pull from Google Sheets failed', e);
  }
  return null;
};

export const importFromGoogleSheetUrl = async (url: string) => {
  try {
    const res = await fetch('/api/sheets/import-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.data) {
        const delMap = getDeletedIdsMap();
        if (Array.isArray(data.data.inventaris)) {
          data.data.inventaris = data.data.inventaris.filter((i: any) => i && i.id && !delMap[i.id] && !isDemoId(i.id));
        }
      }
      return data;
    }
  } catch (e) {
    console.warn('Import from Google Sheets URL failed', e);
  }
  return null;
};

export const purgeDemoDataFromServerAndSheets = async () => {
  purgeDemoDataFromLocalStorage();
  try {
    const res = await fetch('/api/sync/purge-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to call purge-demo API', e);
  }
  return null;
};

export const testGoogleSheetsConnection = async (webhookUrl: string) => {
  try {
    const res = await fetch('/api/sheets/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Test connection failed', e);
  }
  return null;
};

export const getSystemConfig = async () => {
  try {
    const res = await fetch('/api/system/config');
    if (res.ok) {
      const data = await res.json();
      return data.config;
    }
  } catch (e) {
    console.warn('Failed to get system config', e);
  }
  return {
    googleSheetsWebhookUrl: 'https://script.google.com/macros/s/AKfycbzUmPWBm_bEfgzYfttT8wwDIE3K5-z5xXxC03mY-i5LC7pHW9Bn9Qk9sUuxd31O9B9r5A/exec',
    designatedEmail: 'bulukumba17101994@gmail.com',
    autoSyncEnabled: true,
  };
};

export const saveSystemConfig = async (config: {
  googleSheetsWebhookUrl?: string;
  designatedEmail?: string;
  autoSyncEnabled?: boolean;
}) => {
  try {
    const res = await fetch('/api/system/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to save system config', e);
  }
  return null;
};

/**
 * SMART DYNAMIC ALKES PARSER:
 * Mengonversi baris mentah dari Google Spreadsheet, Excel (.xlsx), atau CSV
 * menjadi AlkesItem[] dengan pencocokan nama kolom cerdas.
 */
export const parseRawDataToAlkes = (rawRows: any[][]): AlkesItem[] => {
  if (!rawRows || rawRows.length < 1) return [];

  // 1. Cari baris Header (bisa di baris 0, 1, atau 2)
  let headerIndex = -1;
  let headers: string[] = [];

  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const rowStr = (rawRows[r] || []).map((c) => String(c || '').toLowerCase().trim()).join(' ');
    if (
      rowStr.includes('nama') ||
      rowStr.includes('alat') ||
      rowStr.includes('ruang') ||
      rowStr.includes('merk') ||
      rowStr.includes('alkes')
    ) {
      headerIndex = r;
      headers = (rawRows[r] || []).map((c) => String(c || '').toLowerCase().trim());
      break;
    }
  }

  // Jika tidak ditemukan header kata kunci, gunakan baris pertama sebagai header
  if (headerIndex === -1) {
    headerIndex = 0;
    headers = (rawRows[0] || []).map((c) => String(c || '').toLowerCase().trim());
  }

  // 2. Petakan indeks kolom berdasarkan kata kunci/regex
  const findCol = (regex: RegExp): number => {
    for (let c = 0; c < headers.length; c++) {
      if (regex.test(headers[c])) return c;
    }
    return -1;
  };

  const idCol = findCol(/(id.*alkes|id.*alat|^id$|kode.*alat|^kode$|no.*inv)/i);
  const namaAlatCol = findCol(/(nama.*(alat|alkes|barang)|alat.*kesehatan|jenis.*alat|equipment|nama.*lengkap|^nama$|deskripsi)/i);
  const ruanganCol = findCol(/(ruang|unit|lokasi|instalasi|penempatan|departemen|ward|room)/i);
  const merkCol = findCol(/(merk|brand|merek|manufaktur|pabrik)/i);
  const modelCol = findCol(/(model|type|tipe|tipe.*alat|seri|varian)/i);
  const snCol = findCol(/(serial|sn|no.*seri|nomor.*seri|s\/n|no.*seri.*alat)/i);
  const tahunCol = findCol(/(tahun.*pengadaan|tahun.*perolehan|tahun|thn|tgl.*pengadaan)/i);
  const calibTerakhirCol = findCol(/(kalibrasi.*terakhir|tgl.*kalibrasi|terakhir.*kalibrasi|tgl.*uji)/i);
  const calibBerikutnyaCol = findCol(/(kalibrasi.*berikutnya|jadwal.*kalibrasi|jatuh.*tempo|expir)/i);
  const statusCalibCol = findCol(/(status.*kalibrasi|hasil.*kalibrasi|status.*laik|kelayakan)/i);
  const kondisiCol = findCol(/(kondisi.*alat|kondisi.*fisik|kondisi|status.*fisik|keadaan)/i);
  const ketCol = findCol(/(keterangan|ket|catatan|fungsi|operasional|status.*alat)/i);
  const noInvCol = findCol(/(nomor.*inventaris|no.*inventaris|no.*inv|nomer.*inv|kode.*aset|kode.*bmn)/i);
  const lokasiCol = findCol(/(lokasi.*spesifik|detail.*lokasi|posisi|lantai)/i);

  const alkesList: AlkesItem[] = [];
  const rowsToProcess = rawRows.slice(headerIndex + 1);

  rowsToProcess.forEach((row, idx) => {
    if (!row || row.length === 0) return;

    // Ambil nama alat terlebih dahulu
    let namaAlat = namaAlatCol !== -1 ? String(row[namaAlatCol] || '').trim() : '';
    
    // Fallback nama alat jika tidak terdeteksi kolomnya
    if (!namaAlat) {
      // Cek apakah ada teks yang bukan angka/ID di kolom 1 atau 2
      for (let c = 0; c < Math.min(row.length, 4); c++) {
        const val = String(row[c] || '').trim();
        if (val && val.length > 2 && !/^\d+$/.test(val) && !val.startsWith('ALK-')) {
          namaAlat = val;
          break;
        }
      }
    }

    if (!namaAlat) return; // Lewati baris kosong

    // Ambil ID atau buat ID otomatis jika kosong
    let id = idCol !== -1 ? String(row[idCol] || '').trim() : '';
    if (!id || id === '-' || /^\d+$/.test(id)) {
      const snClean = snCol !== -1 ? String(row[snCol] || '').replace(/[^a-zA-Z0-9]/g, '') : '';
      id = `ALK-${snClean ? snClean.substring(0, 8) : Date.now().toString(36).toUpperCase()}-${idx + 1}`;
    }

    const delMap = getDeletedIdsMap();
    if (delMap[id] || isDemoId(id)) {
      // Lewati alat yang telah dihapus atau data demo
      return;
    }

    // Cari ruangan yang cocok dari DAFTAR_RUANGAN atau gunakan custom room
    const rawRuangan = ruanganCol !== -1 && row[ruanganCol] ? String(row[ruanganCol]).trim() : '';
    let ruangan: RuanganType = 'IGD';
    if (rawRuangan) {
      const match = DAFTAR_RUANGAN.find((r) => r.toLowerCase() === rawRuangan.toLowerCase());
      if (match) {
        ruangan = match;
      } else {
        const partialMatch = DAFTAR_RUANGAN.find((r) => rawRuangan.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(rawRuangan.toLowerCase()));
        if (partialMatch) {
          ruangan = partialMatch;
        } else {
          ruangan = rawRuangan.toUpperCase() as RuanganType;
        }
      }
    }

    const merk = merkCol !== -1 && row[merkCol] ? String(row[merkCol]).trim() : '-';
    const modelType = modelCol !== -1 && row[modelCol] ? String(row[modelCol]).trim() : '-';
    const serialNumber = snCol !== -1 && row[snCol] ? String(row[snCol]).trim() : '-';
    const tahunPengadaan = tahunCol !== -1 && row[tahunCol] ? String(row[tahunCol]).trim() : '-';
    const nomorInventaris = noInvCol !== -1 && row[noInvCol] ? String(row[noInvCol]).trim() : id;
    const lokasiSpesifik = lokasiCol !== -1 && row[lokasiCol] ? String(row[lokasiCol]).trim() : '-';

    // Normalisasi Tanggal Kalibrasi
    let kalibrasiTerakhir = calibTerakhirCol !== -1 ? formatDateString(row[calibTerakhirCol]) : '';
    let kalibrasiBerikutnya = calibBerikutnyaCol !== -1 ? formatDateString(row[calibBerikutnyaCol]) : '';

    if (!kalibrasiBerikutnya && kalibrasiTerakhir) {
      const cal = calculateNextCalibration(kalibrasiTerakhir);
      kalibrasiBerikutnya = cal.nextDate;
    }

    // Normalisasi Kondisi
    const rawKondisi = kondisiCol !== -1 ? String(row[kondisiCol] || '').toLowerCase() : '';
    let kondisi: KondisiAlatType = 'Baik';
    if (rawKondisi.includes('berat') || rawKondisi.includes('afkir') || rawKondisi.includes('mati') || rawKondisi.includes('rusak total')) {
      kondisi = 'Rusak Berat';
    } else if (rawKondisi.includes('sedang')) {
      kondisi = 'Rusak Sedang';
    } else if (rawKondisi.includes('ringan') || rawKondisi.includes('kurang') || rawKondisi.includes('rusak')) {
      kondisi = 'Rusak Ringan';
    }

    // Normalisasi Status Kalibrasi
    const rawStatusCal = statusCalibCol !== -1 ? String(row[statusCalibCol] || '').toLowerCase() : '';
    let statusKalibrasi: StatusKalibrasiType = 'Terkalibrasi';
    if (rawStatusCal.includes('kadaluarsa') || rawStatusCal.includes('expired') || rawStatusCal.includes('lewat')) {
      statusKalibrasi = 'Kadaluarsa';
    } else if (rawStatusCal.includes('perlu') || rawStatusCal.includes('belum') || rawStatusCal.includes('proses')) {
      statusKalibrasi = 'Perlu Kalibrasi';
    } else if (kalibrasiTerakhir) {
      statusKalibrasi = calculateNextCalibration(kalibrasiTerakhir).status;
    }

    // Normalisasi Keterangan
    const rawKet = ketCol !== -1 ? String(row[ketCol] || '').toLowerCase() : '';
    let keterangan: KeteranganAlatType = 'Berfungsi';
    if (rawKet.includes('tarik') || rawKet.includes('bap') || rawKet.includes('penarikan') || kondisi === 'Rusak Berat') {
      keterangan = 'Penarikan Alat';
    } else if (rawKet.includes('sparepart') || rawKet.includes('onderdil') || rawKet.includes('ganti')) {
      keterangan = 'Perlu penggantian sparepart';
    }

    alkesList.push({
      id,
      ruangan,
      namaAlat,
      merk,
      modelType,
      serialNumber,
      tahunPengadaan,
      kalibrasiTerakhir,
      kalibrasiBerikutnya,
      statusKalibrasi,
      kondisi,
      keterangan,
      nomorInventaris,
      lokasiSpesifik,
      updatedAt: new Date().toISOString(),
      lastEditedBy: 'Impor Google Sheets / Excel',
    });
  });

  return alkesList;
};

/** Helper parsing CSV string */
export const parseCsvStringToAlkes = (csvText: string): AlkesItem[] => {
  try {
    const parsed = Papa.parse(csvText, { skipEmptyLines: true });
    if (parsed.data && Array.isArray(parsed.data)) {
      return parseRawDataToAlkes(parsed.data as any[][]);
    }
  } catch (e) {
    console.error('Failed to parse CSV string', e);
  }
  return [];
};

/** Helper parsing Excel (.xlsx, .xls) buffer */
export const parseExcelBufferToAlkes = (arrayBuffer: ArrayBuffer): AlkesItem[] => {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    return parseRawDataToAlkes(rawData);
  } catch (e) {
    console.error('Failed to parse Excel buffer', e);
  }
  return [];
};

function formatDateString(val: any): string {
  return normalizeDateString(val);
}

export const GOOGLE_APPS_SCRIPT_SAMPLE = `/**
 * ====================================================================================
 * SISTEM INFORMASI MANAJEMEN ALAT KESEHATAN (SIM-ALKES)
 * UPTD RSUD LAMADDUKELLENG - KABUPATEN WAJO
 * ====================================================================================
 * FILE: Code.gs (Google Apps Script)
 * VERSI: 3.0 (Multi-Device Real-Time Sync & Anti-Collision Concurrency Lock)
 * 
 * FITUR UTAMA:
 * 1. SIMPAN & UPDATE DATA (doPost): Mendukung simpan 1 item (upsert) maupun batch sync.
 * 2. TARIK DATA REAL-TIME (doGet / doPost action 'GET_ALL'): Mengambil seluruh data
 *    alkes, pemeliharaan PPM, perbaikan SPK, dan BAP untuk disinkronkan ke semua HP/Laptop.
 * 3. ANTI-BENTROK KONKURENSI (LockService): Mencegah data tertimpa atau hilang ketika
 *    banyak teknisi/ruangan menginput data di detik yang sama secara bersamaan.
 * 4. OTOMATISASI SHEET & HEADER: Otomatis membuat 4 tab sheet dengan styling resmi UPTD RSUD LAMADDUKELLENG.
 * 
 * ====================================================================================
 * PETUNJUK PEMASANGAN (HANYA 3 MENIT):
 * 1. Buka Google Spreadsheet baru di Google Drive Anda (atau kunjungi https://sheets.new).
 * 2. Klik menu: Ekstensi (Extensions) > Apps Script.
 * 3. Hapus semua kode bawaan, lalu Salin & Tempel (Paste) seluruh isi file ini.
 * 4. Klik tombol "Simpan" (ikon disket / Ctrl+S).
 * 5. Klik tombol "Terapkan" (Deploy) di kanan atas > "Deployment baru" (New deployment).
 * 6. Pilih jenis: "Aplikasi Web" (Web app).
 * 7. Konfigurasi Deployment:
 *    - Deskripsi       : SIM-ALKES UPTD RSUD LAMADDUKELLENG Real-Time Sync
 *    - Jalankan sebagai: "Saya" (Me / email Anda)
 *    - Yang memiliki akses: "Siapa saja" (Anyone) -> PENTING agar semua device bisa akses
 * 8. Klik "Terapkan" (Deploy) dan berikan izin otorisasi Google jika diminta.
 * 9. Salin "URL Aplikasi Web" (akhiran /exec) dan tempelkan ke aplikasi SIM-ALKES UPTD RSUD LAMADDUKELLENG.
 * ====================================================================================
 */

// Konfigurasi Nama Tab Sheet Resmi
var SHEET_NAMES = {
  INVENTARIS: "INVENTARIS_ALKES",
  PEMELIHARAAN: "PEMELIHARAAN_PPM",
  PERBAIKAN: "PERBAIKAN_SPK",
  BERITA_ACARA: "BERITA_ACARA_PENARIKAN",
  LOGS: "SYNC_LOGS"
};

// Konfigurasi Header Kolom
var HEADERS_CONFIG = {
  INVENTARIS_ALKES: [
    "ID ALKES", "RUANGAN", "NAMA ALAT KESEHATAN", "MERK", "MODEL / TYPE", 
    "SERIAL NUMBER (SN)", "TAHUN PENGADAAN", "KALIBRASI TERAKHIR", "KALIBRASI BERIKUTNYA", 
    "STATUS KALIBRASI", "KONDISI ALAT", "KETERANGAN", "NOMOR INVENTARIS", 
    "LOKASI SPESIFIK", "TERAKHIR DIUBAH", "PETUGAS ELEKTROMEDIS"
  ],
  PEMELIHARAAN_PPM: [
    "ID PPM", "TANGGAL KEGIATAN", "NAMA TEKNISI", "NIP TEKNISI", "RUANGAN", 
    "NAMA ALAT", "MERK", "MODEL / TYPE", "SERIAL NUMBER", 
    "1. PEMERIKSAAN FISIK-FUNGSI", "2. SETTING & PEMANASAN", "3. CLEANING", 
    "KONDISI ALAT", "STATUS KELAYAKAN", "CATATAN TEKNISI", "TIMESTAMP"
  ],
  PERBAIKAN_SPK: [
    "ID SPK", "NOMOR SPK", "TANGGAL LAPORAN", "PELAPOR", "RUANGAN", 
    "NAMA ALAT", "MERK", "MODEL / TYPE", "SERIAL NUMBER", "KELUHAN KERUSAKAN", 
    "ANALISIS TEKNISI", "TINDAKAN PERBAIKAN", "SPAREPART DIGANTI", "ESTIMASI BIAYA (RP)", 
    "TEKNISI PELAKSANA", "STATUS AKHIR", "TIMESTAMP"
  ],
  BERITA_ACARA_PENARIKAN: [
    "ID BAP", "TANGGAL PENARIKAN", "ID ALKES", "NAMA ALAT", "MERK / TYPE", 
    "SERIAL NUMBER", "RUANGAN ASAL", "KONDISI TERAKHIR", "ALASAN PENARIKAN", 
    "ANALISA TEKNIS K3RS", "REKOMENDASI TINDAKAN", "TEKNISI ELEKTROMEDIS (YANG MENERIMA)", 
    "NIP TEKNISI", "KEPALA RUANGAN (YANG MENYERAHKAN)", "KEPALA IPSRS (MENGETAHUI)", 
    "NIP KEPALA IPSRS", "TIMESTAMP"
  ]
};

// Warna Khas Merah Marun UPTD RSUD LAMADDUKELLENG
var THEME_COLOR = {
  HEADER_BG: "#881337",   // Rose 900 / Maroon UPTD RSUD LAMADDUKELLENG
  HEADER_FONT: "#FFFFFF",
  ZEBRA_BG: "#FFF1F2"     // Soft light rose
};

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "GET_ALL";
  
  if (action === "PING" || action === "HEALTH") {
    return createJsonResponse({
      status: "success",
      message: "SIM-ALKES Google Apps Script Service UPTD RSUD LAMADDUKELLENG Aktif & Siap Sinkronisasi.",
      timestamp: new Date().toISOString(),
      version: "3.0"
    });
  }

  return handleGetAllData();
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      return createJsonResponse({
        status: "error",
        error: "Server sedang memproses transaksi input lain. Silakan coba 1 detik lagi.",
        code: "LOCK_TIMEOUT"
      });
    }

    var contents = e.postData ? e.postData.contents : "{}";
    var payload = JSON.parse(contents);
    var action = payload.action || "SYNC_ALL_SHEETS";

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "GET_ALL" || action === "PULL_ALL_DATA") {
      return handleGetAllData();
    }

    if (action === "UPSERT_ITEM") {
      var sheetName = payload.sheetName;
      var rowItem = payload.item;
      var idColIndex = payload.idIndex || 0;

      if (!sheetName || !rowItem) {
        throw new Error("Parameter sheetName dan item wajib disertakan.");
      }

      var sheet = getOrCreateSheet(ss, sheetName);
      var result = upsertRowById(sheet, rowItem, idColIndex);

      logSyncActivity(ss, "UPSERT_ITEM", "Sheet " + sheetName + " | ID: " + rowItem[idColIndex]);

      return createJsonResponse({
        status: "success",
        message: "Data item berhasil disimpan & diperbarui tanpa bentrok.",
        action: "UPSERT_ITEM",
        sheetName: sheetName,
        rowUpdated: result.rowIndex,
        isNew: result.isNew,
        timestamp: new Date().toISOString()
      });
    }

    if (action === "DELETE_ITEM") {
      var sheetName = payload.sheetName;
      var targetId = payload.id;
      var idColIndex = payload.idIndex || 0;

      if (!sheetName || !targetId) {
        throw new Error("Parameter sheetName dan id wajib disertakan.");
      }

      var sheet = ss.getSheetByName(sheetName);
      var deleted = false;
      if (sheet) {
        deleted = deleteRowById(sheet, targetId, idColIndex);
      }

      logSyncActivity(ss, "DELETE_ITEM", "Sheet " + sheetName + " | ID: " + targetId);

      return createJsonResponse({
        status: "success",
        message: deleted ? "Data item berhasil dihapus dari sheet." : "Item tidak ditemukan di sheet.",
        action: "DELETE_ITEM",
        sheetName: sheetName,
        deleted: deleted,
        timestamp: new Date().toISOString()
      });
    }

    var sheetsData = payload.data || {};
    var summary = {};

    for (var sName in sheetsData) {
      var item = sheetsData[sName];
      var targetSheet = getOrCreateSheet(ss, sName);

      if (item.headers && item.headers.length > 0) {
        setupSheetHeader(targetSheet, item.headers);
      }

      if (item.rows) {
        var lastRow = targetSheet.getLastRow();
        if (lastRow > 1) {
          targetSheet.getRange(2, 1, lastRow - 1, targetSheet.getLastColumn()).clearContent();
        }

        if (item.rows.length > 0) {
          var numCols = item.headers ? item.headers.length : item.rows[0].length;
          var dataRange = targetSheet.getRange(2, 1, item.rows.length, numCols);
          dataRange.setValues(item.rows);
          applyZebraFormatting(targetSheet, 2, item.rows.length, numCols);
        }

        summary[sName] = item.rows.length;
      }
    }

    logSyncActivity(ss, "SYNC_ALL_SHEETS", JSON.stringify(summary));

    return createJsonResponse({
      status: "success",
      message: "Data SIM-ALKES UPTD RSUD LAMADDUKELLENG berhasil disinkronkan ke seluruh Google Sheet secara real-time.",
      counts: summary,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      error: err.toString(),
      timestamp: new Date().toISOString()
    });
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

function handleGetAllData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var inventarisSheet = ss.getSheetByName(SHEET_NAMES.INVENTARIS);
    var pemeliharaanSheet = ss.getSheetByName(SHEET_NAMES.PEMELIHARAAN);
    var perbaikanSheet = ss.getSheetByName(SHEET_NAMES.PERBAIKAN);
    var bapSheet = ss.getSheetByName(SHEET_NAMES.BERITA_ACARA);

    var data = {
      inventaris: inventarisSheet ? sheetToObjects(inventarisSheet, "inventaris") : [],
      pemeliharaan: pemeliharaanSheet ? sheetToObjects(pemeliharaanSheet, "pemeliharaan") : [],
      perbaikan: perbaikanSheet ? sheetToObjects(perbaikanSheet, "perbaikan") : [],
      beritaAcara: bapSheet ? sheetToObjects(bapSheet, "beritaAcara") : [],
      serverTime: new Date().toISOString(),
      system: "SIM-ALKES UPTD RSUD LAMADDUKELLENG"
    };

    return createJsonResponse({
      status: "success",
      message: "Data berhasil ditarik dari Google Spreadsheet.",
      data: data,
      counts: {
        inventaris: data.inventaris.length,
        pemeliharaan: data.pemeliharaan.length,
        perbaikan: data.perbaikan.length,
        beritaAcara: data.beritaAcara.length
      }
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      error: "Gagal menarik data dari sheet: " + err.toString()
    });
  }
}

function sheetToObjects(sheet, type) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var results = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[0] || "").trim();
    if (!id) continue;

    if (type === "inventaris") {
      results.push({
        id: id,
        ruangan: String(row[1] || ""),
        namaAlat: String(row[2] || ""),
        merk: String(row[3] || ""),
        modelType: String(row[4] || ""),
        serialNumber: String(row[5] || ""),
        tahunPengadaan: String(row[6] || "-"),
        kalibrasiTerakhir: formatDateValue(row[7]),
        kalibrasiBerikutnya: formatDateValue(row[8]),
        statusKalibrasi: String(row[9] || "Perlu Kalibrasi"),
        kondisi: String(row[10] || "Baik"),
        keterangan: String(row[11] || "Siap Digunakan"),
        nomorInventaris: String(row[12] || "-"),
        lokasiSpesifik: String(row[13] || "-"),
        updatedAt: formatDateValue(row[14]) || new Date().toISOString(),
        lastEditedBy: String(row[15] || "Teknisi Elektromedis")
      });
    } else if (type === "pemeliharaan") {
      results.push({
        id: id,
        tanggal: formatDateValue(row[1]),
        namaTeknisi: String(row[2] || ""),
        nipTeknisi: String(row[3] || ""),
        ruangan: String(row[4] || ""),
        namaAlat: String(row[5] || ""),
        merk: String(row[6] || ""),
        modelType: String(row[7] || ""),
        serialNumber: String(row[8] || ""),
        kegiatanFisik: String(row[9]).toUpperCase().indexOf("YA") >= 0 || row[9] === true,
        kegiatanSetting: String(row[10]).toUpperCase().indexOf("YA") >= 0 || row[10] === true,
        kegiatanCleaning: String(row[11]).toUpperCase().indexOf("YA") >= 0 || row[11] === true,
        kondisi: String(row[12] || "Baik"),
        status: String(row[13] || "Layak Pakai"),
        catatan: String(row[14] || "-")
      });
    } else if (type === "perbaikan") {
      results.push({
        id: id,
        nomorSpk: String(row[1] || ""),
        tanggal: formatDateValue(row[2]),
        pelapor: String(row[3] || ""),
        ruangan: String(row[4] || ""),
        namaAlat: String(row[5] || ""),
        merk: String(row[6] || ""),
        modelType: String(row[7] || ""),
        serialNumber: String(row[8] || ""),
        keluhanKerusakan: String(row[9] || ""),
        analisisTeknisi: String(row[10] || ""),
        tindakanPerbaikan: String(row[11] || ""),
        sparepartDiganti: String(row[12] || "-"),
        biayaEstimasi: Number(row[13]) || 0,
        teknisiPelaksana: String(row[14] || ""),
        statusPerbaikan: String(row[15] || "Selesai")
      });
    } else if (type === "beritaAcara") {
      results.push({
        id: id,
        tanggal: formatDateValue(row[1]),
        alkesId: String(row[2] || ""),
        namaAlat: String(row[3] || ""),
        merk: String(row[4] || ""),
        modelType: "",
        serialNumber: String(row[5] || ""),
        ruangan: String(row[6] || ""),
        kondisiTerakhir: String(row[7] || "Rusak Berat / Afkir"),
        alasanPenarikan: String(row[8] || ""),
        analisaTeknis: String(row[9] || ""),
        rekomendasiTindakan: String(row[10] || ""),
        namaTeknisi: String(row[11] || ""),
        nipTeknisi: String(row[12] || ""),
        namaKepalaRuangan: String(row[13] || ""),
        nipKepalaRuangan: "",
        namaKepalaIpsrs: String(row[14] || "Ramlan, A.Md.TEM"),
        nipKepalaIpsrs: String(row[15] || "198605102010011005")
      });
    }
  }

  return results;
}

function upsertRowById(sheet, rowValues, idColIndex) {
  var targetId = String(rowValues[idColIndex]).trim();
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    var idRange = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idRange.length; i++) {
      if (String(idRange[i][0]).trim() === targetId) {
        var existingRow = i + 2;
        sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
        return { rowIndex: existingRow, isNew: false };
      }
    }
  }

  var newRow = lastRow + 1;
  sheet.getRange(newRow, 1, 1, rowValues.length).setValues([rowValues]);
  return { rowIndex: newRow, isNew: true };
}

function deleteRowById(sheet, targetId, idColIndex) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var idRange = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < idRange.length; i++) {
    if (String(idRange[i][0]).trim() === String(targetId).trim()) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function setupSheetHeader(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(THEME_COLOR.HEADER_BG);
  headerRange.setFontColor(THEME_COLOR.HEADER_FONT);
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
}

function applyZebraFormatting(sheet, startRow, numRows, numCols) {
  if (numRows <= 0 || numCols <= 0) return;
  for (var r = 0; r < numRows; r++) {
    var rowNum = startRow + r;
    var range = sheet.getRange(rowNum, 1, 1, numCols);
    if (r % 2 === 1) {
      range.setBackground(THEME_COLOR.ZEBRA_BG);
    } else {
      range.setBackground("#FFFFFF");
    }
    sheet.setRowHeight(rowNum, 26);
  }
  sheet.autoResizeColumns(1, numCols);
}

function logSyncActivity(ss, action, detail) {
  try {
    var logSheet = ss.getSheetByName(SHEET_NAMES.LOGS);
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_NAMES.LOGS);
      logSheet.getRange(1, 1, 1, 4).setValues([["TIMESTAMP", "ACTION", "DETAIL", "CLIENT_TIME"]]);
      logSheet.getRange(1, 1, 1, 4).setBackground("#374151").setFontColor("#FFFFFF").setFontWeight("bold");
      logSheet.setFrozenRows(1);
    }
    logSheet.appendRow([new Date().toISOString(), action, detail, new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" }) + " WITA"]);
  } catch (e) {
    // Ignore logging errors
  }
}

function formatDateValue(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, "0");
    var d = String(val.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  var str = String(val).trim();
  if (!str || str === "-" || str === "null" || str === "undefined") return "";
  // Check if already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.substring(0, 10);
  }
  // Try parsing Date object from string (such as "Thu Aug 13 2026...")
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
    var py = parsed.getFullYear();
    var pm = String(parsed.getMonth() + 1).padStart(2, "0");
    var pd = String(parsed.getDate()).padStart(2, "0");
    return py + "-" + pm + "-" + pd;
  }
  return str;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export const exportToCsv = (
  type: 'inventaris' | 'pemeliharaan' | 'perbaikan' | 'bap',
  data: any[]
) => {
  let headers: string[] = [];
  let rows: string[][] = [];
  const filename = `SIM_ALKES_UPTD_RSUD_LAMADDUKELLENG_${type.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`;

  if (type === 'inventaris') {
    headers = [
      'ID ALKES',
      'RUANGAN',
      'NAMA ALAT KESEHATAN',
      'MERK',
      'MODEL / TYPE',
      'SERIAL NUMBER (SN)',
      'TAHUN PENGADAAN',
      'KALIBRASI TERAKHIR',
      'KALIBRASI BERIKUTNYA',
      'STATUS KALIBRASI',
      'KONDISI ALAT',
      'KETERANGAN',
      'NOMOR INVENTARIS',
      'TERAKHIR DIUBAH',
    ];
    rows = (data as AlkesItem[]).map((i) => [
      `"${i.id}"`,
      `"${i.ruangan}"`,
      `"${(i.namaAlat || '').replace(/"/g, '""')}"`,
      `"${(i.merk || '').replace(/"/g, '""')}"`,
      `"${(i.modelType || '').replace(/"/g, '""')}"`,
      `"${i.serialNumber}"`,
      `"${i.tahunPengadaan || ''}"`,
      `"${i.kalibrasiTerakhir || ''}"`,
      `"${i.kalibrasiBerikutnya || ''}"`,
      `"${i.statusKalibrasi}"`,
      `"${i.kondisi}"`,
      `"${i.keterangan}"`,
      `"${i.nomorInventaris || ''}"`,
      `"${i.updatedAt || i.createdAt || ''}"`,
    ]);
  } else if (type === 'pemeliharaan') {
    headers = [
      'ID PPM',
      'TANGGAL KEGIATAN',
      'NAMA TEKNISI',
      'NIP TEKNISI',
      'RUANGAN',
      'NAMA ALAT',
      'MERK',
      'MODEL / TYPE',
      'SERIAL NUMBER',
      '1. PEMERIKSAAN FISIK-FUNGSI DAN KELENGKAPAN AKSESORIS',
      '2. SETTING PARAMETER-PERAWATAN MEKANIK DAN KELISTRIKAN SERTA PEMANASAN ALAT',
      '3. CLEANING SELURUH BAGIAN ALAT',
      'KONDISI ALAT',
      'STATUS KELAYAKAN',
      'CATATAN TEKNISI',
    ];
    rows = (data as PemeliharaanItem[]).map((p) => [
      `"${p.id}"`,
      `"${p.tanggal}"`,
      `"${p.namaTeknisi}"`,
      `"${p.nipTeknisi || ''}"`,
      `"${p.ruangan}"`,
      `"${(p.namaAlat || '').replace(/"/g, '""')}"`,
      `"${p.merk}"`,
      `"${p.modelType}"`,
      `"${p.serialNumber}"`,
      `"${p.kegiatanFisik ? 'YA' : 'TIDAK'}"`,
      `"${p.kegiatanSetting ? 'YA' : 'TIDAK'}"`,
      `"${p.kegiatanCleaning ? 'YA' : 'TIDAK'}"`,
      `"${p.kondisi}"`,
      `"${p.status}"`,
      `"${(p.catatan || '').replace(/"/g, '""')}"`,
    ]);
  } else if (type === 'perbaikan') {
    headers = [
      'ID SPK',
      'NOMOR SPK',
      'TANGGAL LAPORAN',
      'PELAPOR',
      'RUANGAN',
      'NAMA ALAT',
      'MERK',
      'MODEL / TYPE',
      'SERIAL NUMBER',
      'KELUHAN KERUSAKAN',
      'ANALISIS TEKNISI',
      'TINDAKAN PERBAIKAN',
      'SPAREPART DIGANTI',
      'ESTIMASI BIAYA',
      'TEKNISI PELAKSANA',
      'STATUS AKHIR',
    ];
    rows = (data as PerbaikanItem[]).map((pr) => [
      `"${pr.id}"`,
      `"${pr.nomorSpk}"`,
      `"${pr.tanggal}"`,
      `"${(pr.pelapor || '').replace(/"/g, '""')}"`,
      `"${pr.ruangan}"`,
      `"${(pr.namaAlat || '').replace(/"/g, '""')}"`,
      `"${pr.merk}"`,
      `"${pr.modelType}"`,
      `"${pr.serialNumber}"`,
      `"${(pr.keluhanKerusakan || '').replace(/"/g, '""')}"`,
      `"${(pr.analisisTeknisi || '').replace(/"/g, '""')}"`,
      `"${(pr.tindakanPerbaikan || '').replace(/"/g, '""')}"`,
      `"${(pr.sparepartDiganti || '').replace(/"/g, '""')}"`,
      `"${pr.biayaEstimasi || 0}"`,
      `"${pr.teknisiPelaksana}"`,
      `"${pr.statusPerbaikan}"`,
    ]);
  } else if (type === 'bap') {
    headers = [
      'ID BAP',
      'TANGGAL PENARIKAN',
      'ID ALKES',
      'NAMA ALAT',
      'MERK',
      'MODEL / TYPE',
      'SERIAL NUMBER',
      'TAHUN PENGADAAN',
      'RUANGAN ASAL',
      'KONDISI TERAKHIR',
      'ALASAN PENARIKAN',
      'ANALISA TEKNIS K3RS',
      'REKOMENDASI TINDAKAN',
      'TEKNISI ELEKTROMEDIS (YANG MENERIMA/MEMERIKSA)',
      'NIP TEKNISI',
      'KEPALA RUANGAN / PETUGAS (YANG MENYERAHKAN)',
      'KEPALA IPSRS (MENGETAHUI)',
    ];
    rows = (data as BeritaAcaraPenarikan[]).map((bap) => [
      `"${bap.id}"`,
      `"${bap.tanggal}"`,
      `"${bap.alkesId || '-'}"`,
      `"${(bap.namaAlat || '').replace(/"/g, '""')}"`,
      `"${bap.merk}"`,
      `"${bap.modelType}"`,
      `"${bap.serialNumber}"`,
      `"${bap.tahunPengadaan || '-'}"`,
      `"${bap.ruangan}"`,
      `"${bap.kondisiTerakhir}"`,
      `"${(bap.alasanPenarikan || '').replace(/"/g, '""')}"`,
      `"${(bap.analisaTeknis || '').replace(/"/g, '""')}"`,
      `"${bap.rekomendasiTindakan}"`,
      `"${bap.namaTeknisi}"`,
      `"${bap.nipTeknisi || ''}"`,
      `"${bap.namaKepalaRuangan}"`,
      `"${bap.namaKepalaIpsrs || bap.namaDirektur || 'Ramlan, A.Md.TEM'}"`,
    ]);
  }

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
