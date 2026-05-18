import { createContext, useContext, useState, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';

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
const PWD_SESSION_KEY = 'clicks_pwd';
const REF_STORE_KEY = 'clicks_ref_code';

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  clearData: () => void;
  voiceIntroDraftRef: MutableRefObject<VoiceIntroDraft>;
  /** In-memory only — data URLs are too large for localStorage. */
  photosDraftRef: MutableRefObject<string[]>;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const voiceIntroDraftRef = useRef<VoiceIntroDraft>(null);
  const photosDraftRef = useRef<string[]>([]);

  const [data, setData] = useState<OnboardingData>(() => {
    let refFromStore = '';
    try {
      refFromStore = localStorage.getItem(REF_STORE_KEY) || '';
    } catch {
      /* ignore */
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedPwd = sessionStorage.getItem(PWD_SESSION_KEY) || '';
      if (saved) {
        const parsed = JSON.parse(saved);
        const { photos: _storedPhotos, ...parsedWithoutPhotos } = parsed as OnboardingData & { photos?: unknown };
        return {
          ...defaultData,
          ...parsedWithoutPhotos,
          photos: [],
          referralCode: (parsed.referralCode as string) || refFromStore,
          password: savedPwd,
          questionnaireResponses: {
            ...defaultData.questionnaireResponses,
            ...(typeof parsed.questionnaireResponses === 'object' && parsed.questionnaireResponses
              ? parsed.questionnaireResponses
              : {}),
          },
        };
      }
      return {
        ...defaultData,
        referralCode: refFromStore,
        password: savedPwd,
      };
    } catch {
      /* ignore */
    }
    return { ...defaultData, referralCode: refFromStore };
  });

  useEffect(() => {
    try {
      // Don't persist password or photos (data URLs exceed localStorage quota)
      const { password, photos, ...safe } = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {
      /* ignore localStorage */
    }
  }, [data]);

  const updateData = (partial: Partial<OnboardingData>) => {
    if (partial.password !== undefined) {
      try {
        sessionStorage.setItem(PWD_SESSION_KEY, partial.password);
      } catch {
        /* ignore sessionStorage */
      }
    }
    if (partial.photos !== undefined) {
      photosDraftRef.current = partial.photos.filter((u) => typeof u === 'string' && u.length > 0);
    }
    setData(prev => ({ ...prev, ...partial }));
  };

  const clearData = () => {
    voiceIntroDraftRef.current = null;
    photosDraftRef.current = [];
    setData(defaultData);
    localStorage.removeItem(STORAGE_KEY);
    try {
      sessionStorage.removeItem(PWD_SESSION_KEY);
      sessionStorage.removeItem('clicks_onboarding_phone_backup');
    } catch {
      /* ignore sessionStorage */
    }
  };

  return (
    <OnboardingContext.Provider value={{ data, updateData, clearData, voiceIntroDraftRef, photosDraftRef }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
