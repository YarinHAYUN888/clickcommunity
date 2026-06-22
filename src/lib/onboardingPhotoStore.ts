/**
 * Durable, short-lived storage for onboarding photo data URLs.
 *
 * Onboarding photos are too large for localStorage, but holding them only in
 * memory means a page refresh / app-switch during the OTP step silently drops
 * them. This IndexedDB helper persists the selected photos so the post-OTP
 * finalize step can still upload them.
 *
 * Safety rules:
 * - A single record is stored under a fixed object key, but it is tagged with
 *   an onboarding `sessionId`, `createdAt`, and `photoCount`. A record is only
 *   restored when its `sessionId` matches the current onboarding session and it
 *   is fresh (within TTL) — this prevents accidentally restoring photos from a
 *   previous, abandoned registration.
 * - All operations are wrapped in try/catch and resolve gracefully when
 *   IndexedDB is unavailable (e.g. private mode / old Safari).
 */

const DB_NAME = 'clicks_onboarding_db';
const DB_VERSION = 1;
const STORE_NAME = 'onboarding_photos';
const RECORD_KEY = 'current';

/** localStorage keys that tag the onboarding photo session (owned together with the IndexedDB record). */
export const ONBOARDING_SESSION_LS_KEY = 'clicks_onboarding_session';
export const ONBOARDING_PHOTO_COUNT_LS_KEY = 'clicks_onboarding_photo_count';

/** Discard restored photos older than this (a stale, abandoned registration). */
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;

export interface OnboardingPhotoRecord {
  sessionId: string;
  createdAt: number;
  photoCount: number;
  photos: string[];
}

type StoredRecord = OnboardingPhotoRecord & { key: typeof RECORD_KEY };

function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!isIndexedDbAvailable()) {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | null,
): Promise<T | null> {
  return new Promise(async (resolve) => {
    const db = await openDb();
    if (!db) {
      resolve(null);
      return;
    }
    try {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = work(store);
      if (!request) {
        tx.oncomplete = () => {
          db.close();
          resolve(null);
        };
        tx.onerror = () => {
          db.close();
          resolve(null);
        };
        return;
      }
      request.onsuccess = () => {
        const result = request.result;
        tx.oncomplete = () => {
          db.close();
          resolve(result ?? null);
        };
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
      tx.onabort = () => {
        db.close();
        resolve(null);
      };
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve(null);
    }
  });
}

/**
 * Persist the current onboarding photo selection. An empty list clears the
 * record so we never keep an out-of-date set of photos.
 */
export async function saveOnboardingPhotos(sessionId: string, photos: string[]): Promise<void> {
  const valid = (Array.isArray(photos) ? photos : []).filter(
    (p) => typeof p === 'string' && p.length > 0,
  );
  if (valid.length === 0) {
    await clearOnboardingPhotos();
    return;
  }
  const record: StoredRecord = {
    key: RECORD_KEY,
    sessionId,
    createdAt: Date.now(),
    photoCount: valid.length,
    photos: valid,
  };
  await runTransaction('readwrite', (store) => store.put(record));
}

/**
 * Load the stored onboarding photos.
 *
 * Returns `null` unless the record is fresh (within TTL) and — when a
 * `sessionId` is supplied — belongs to the current onboarding session. A
 * stale/foreign record is cleared as a side-effect.
 */
export async function loadOnboardingPhotos(
  sessionId?: string,
): Promise<OnboardingPhotoRecord | null> {
  const stored = (await runTransaction<StoredRecord>('readonly', (store) =>
    store.get(RECORD_KEY),
  )) as StoredRecord | null;

  if (!stored || !Array.isArray(stored.photos) || stored.photos.length === 0) {
    return null;
  }

  const isStale = !stored.createdAt || Date.now() - stored.createdAt > RECORD_TTL_MS;
  const isForeignSession =
    typeof sessionId === 'string' && sessionId.length > 0 && stored.sessionId !== sessionId;

  if (isStale || isForeignSession) {
    await clearOnboardingPhotos();
    return null;
  }

  const photos = stored.photos.filter((p) => typeof p === 'string' && p.length > 0);
  if (photos.length === 0) return null;

  return {
    sessionId: stored.sessionId,
    createdAt: stored.createdAt,
    photoCount: photos.length,
    photos,
  };
}

/** Lightweight metadata read (does not return the heavy photo data URLs). */
export async function getOnboardingPhotoMeta(
  sessionId?: string,
): Promise<{ photoCount: number; createdAt: number; sessionId: string } | null> {
  const record = await loadOnboardingPhotos(sessionId);
  if (!record) return null;
  return {
    photoCount: record.photoCount,
    createdAt: record.createdAt,
    sessionId: record.sessionId,
  };
}

/** Remove any stored onboarding photos (success, logout, cancel, restart). */
export async function clearOnboardingPhotos(): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(RECORD_KEY));
}

/**
 * Clear all durable onboarding photo state: the IndexedDB record and the
 * localStorage session/photo-count tags. Use on logout so a different user on
 * the same device can never inherit a previous registration's photos.
 */
export async function clearOnboardingDurableState(): Promise<void> {
  await clearOnboardingPhotos();
  try {
    localStorage.removeItem(ONBOARDING_SESSION_LS_KEY);
    localStorage.removeItem(ONBOARDING_PHOTO_COUNT_LS_KEY);
  } catch {
    /* ignore */
  }
}
