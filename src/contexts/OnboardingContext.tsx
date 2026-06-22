import { createContext, useContext, useState, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import {
  clearOnboardingPhotos,
  loadOnboardingPhotos,
  saveOnboardingPhotos,
  ONBOARDING_SESSION_LS_KEY,
  ONBOARDING_PHOTO_COUNT_LS_KEY,
} from '@/lib/onboardingPhotoStore';

/** In-memory only — holds recorded voice blob until post-auth upload (never persisted to localStorage). */
export type VoiceIntroDraft = {
  blob: Blob;
  durationSec: number;
  mimeType: string;
} | null;

export interface OnboardingData {
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  referralCode: string;
  dateOfBirth: { day: number; month: number; year: number } | null;
  gender: 'male' | 'female' | 'other' | '';
  region: string;
  regionOther: string;
  photos: string[];
  occupation: string;
  /** Persona key — same as profiles.life_niche */
  life_niche: string;
  bio: string;
  instagram: string;
  tiktok: string;
  interests: string[];
  verificationMethod: 'phone' | 'email' | '';
  /** שאלון היכרות — מפתח = id של השאלה */
  questionnaireResponses: Record<string, string>;
}

const defaultData: OnboardingData = {
  phone: '',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  referralCode: '',
  dateOfBirth: null,
  gender: '',
  region: '',
  regionOther: '',
  photos: [],
  occupation: '',
  life_niche: '',
  bio: '',
  instagram: '',
  tiktok: '',
  interests: [],
  verificationMethod: '',
  questionnaireResponses: {},
};

const STORAGE_KEY = 'clicks_onboarding';
const REF_STORE_KEY = 'clicks_ref_code';
const SESSION_KEY = ONBOARDING_SESSION_LS_KEY;
const PHOTO_COUNT_KEY = ONBOARDING_PHOTO_COUNT_LS_KEY;

/** Stable per-registration id used to tag durable photo storage (prevents restoring old photos). */
function readOrCreateOnboardingSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
  } catch {
    /* ignore */
  }
  const next =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ob_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    localStorage.setItem(SESSION_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  clearData: () => void;
  /** Password kept in memory only until OTP completes — never sessionStorage. */
  getPassword: () => string;
  voiceIntroDraftRef: MutableRefObject<VoiceIntroDraft>;
  /** In-memory only — data URLs are too large for localStorage (mirrored to IndexedDB). */
  photosDraftRef: MutableRefObject<string[]>;
  /** Stable id for the current onboarding session (tags durable photo storage). */
  getOnboardingSessionId: () => string;
  /** How many photos the user selected (survives refresh even if IndexedDB is purged). */
  getExpectedPhotoCount: () => number;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const voiceIntroDraftRef = useRef<VoiceIntroDraft>(null);
  const photosDraftRef = useRef<string[]>([]);
  const passwordRef = useRef('');
  const sessionIdRef = useRef<string>(readOrCreateOnboardingSessionId());

  const [data, setData] = useState<OnboardingData>(() => {
    let refFromStore = '';
    try {
      refFromStore = localStorage.getItem(REF_STORE_KEY) || '';
    } catch {
      /* ignore */
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const { photos: _storedPhotos, password: _pwd, ...parsedWithoutPhotos } = parsed as OnboardingData & {
          photos?: unknown;
        };
        return {
          ...defaultData,
          ...parsedWithoutPhotos,
          photos: [],
          referralCode: (parsed.referralCode as string) || refFromStore,
          password: '',
          questionnaireResponses: {
            ...defaultData.questionnaireResponses,
            ...(typeof parsed.questionnaireResponses === 'object' && parsed.questionnaireResponses
              ? parsed.questionnaireResponses
              : {}),
          },
        };
      }
      return { ...defaultData, referralCode: refFromStore };
    } catch {
      /* ignore */
    }
    return { ...defaultData, referralCode: refFromStore };
  });

  useEffect(() => {
    try {
      const { password, photos, ...safe } = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {
      /* ignore localStorage */
    }
  }, [data]);

  // Hydrate photos from durable storage on mount (refresh / app-switch recovery).
  // Newer in-memory selections always win: only restore when nothing is in memory yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const record = await loadOnboardingPhotos(sessionIdRef.current);
      if (cancelled || !record || record.photos.length === 0) return;
      if (photosDraftRef.current.length > 0) return; // fresh user selection wins
      photosDraftRef.current = record.photos;
      setData((prev) => (prev.photos.length > 0 ? prev : { ...prev, photos: record.photos }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateData = (partial: Partial<OnboardingData>) => {
    if (partial.password !== undefined) {
      passwordRef.current = partial.password;
    }
    if (partial.photos !== undefined) {
      const cleaned = partial.photos.filter((u) => typeof u === 'string' && u.length > 0);
      photosDraftRef.current = cleaned;
      try {
        localStorage.setItem(PHOTO_COUNT_KEY, String(cleaned.length));
      } catch {
        /* ignore */
      }
      // Persist durably so a refresh/app-switch during OTP does not lose photos.
      void saveOnboardingPhotos(sessionIdRef.current, cleaned);
    }
    setData((prev) => ({ ...prev, ...partial, password: partial.password ?? prev.password }));
  };

  const clearData = () => {
    voiceIntroDraftRef.current = null;
    photosDraftRef.current = [];
    passwordRef.current = '';
    setData(defaultData);
    localStorage.removeItem(STORAGE_KEY);
    void clearOnboardingPhotos();
    try {
      localStorage.removeItem(PHOTO_COUNT_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    // Rotate the session id so a new registration cannot inherit old photos.
    sessionIdRef.current = readOrCreateOnboardingSessionId();
    try {
      sessionStorage.removeItem('clicks_onboarding_phone_backup');
      sessionStorage.removeItem('clicks_pwd');
    } catch {
      /* ignore sessionStorage */
    }
  };

  const getPassword = () => passwordRef.current || data.password;

  const getOnboardingSessionId = () => sessionIdRef.current;

  const getExpectedPhotoCount = () => {
    if (photosDraftRef.current.length > 0) return photosDraftRef.current.length;
    try {
      return Number(localStorage.getItem(PHOTO_COUNT_KEY) || '0') || 0;
    } catch {
      return 0;
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        data,
        updateData,
        clearData,
        getPassword,
        voiceIntroDraftRef,
        photosDraftRef,
        getOnboardingSessionId,
        getExpectedPhotoCount,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
