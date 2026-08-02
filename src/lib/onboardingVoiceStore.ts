/**
 * Durable storage for onboarding voice intro blobs (IndexedDB).
 * Mirrors onboardingPhotoStore — survives refresh during OTP step.
 */

const DB_NAME = 'clicks_onboarding_voice_db';
const DB_VERSION = 1;
const STORE_NAME = 'onboarding_voice';
const RECORD_KEY = 'current';

const RECORD_TTL_MS = 24 * 60 * 60 * 1000;

export interface OnboardingVoiceRecord {
  sessionId: string;
  createdAt: number;
  durationSec: number;
  mimeType: string;
  blob: Blob;
}

type StoredRecord = OnboardingVoiceRecord & { key: typeof RECORD_KEY };

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
      const req = work(store);
      if (!req) {
        resolve(null);
        return;
      }
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function saveOnboardingVoice(
  sessionId: string,
  blob: Blob,
  durationSec: number,
  mimeType: string,
): Promise<void> {
  if (!blob || blob.size < 1) return;
  const record: StoredRecord = {
    key: RECORD_KEY,
    sessionId,
    createdAt: Date.now(),
    durationSec,
    mimeType,
    blob,
  };
  await runTransaction('readwrite', (store) => store.put(record));
}

export async function loadOnboardingVoice(sessionId: string): Promise<OnboardingVoiceRecord | null> {
  const raw = await runTransaction<StoredRecord | undefined>('readonly', (store) =>
    store.get(RECORD_KEY),
  );
  if (!raw || raw.sessionId !== sessionId) return null;
  if (Date.now() - raw.createdAt > RECORD_TTL_MS) {
    await clearOnboardingVoice();
    return null;
  }
  if (!raw.blob || raw.blob.size < 1) return null;
  return {
    sessionId: raw.sessionId,
    createdAt: raw.createdAt,
    durationSec: raw.durationSec,
    mimeType: raw.mimeType,
    blob: raw.blob,
  };
}

export async function clearOnboardingVoice(): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(RECORD_KEY));
}
