import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  bio: string;
  instagram: string;
  tiktok: string;
  interests: string[];
  verificationMethod: 'phone' | 'email' | '';
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
  bio: '',
  instagram: '',
  tiktok: '',
  interests: [],
  verificationMethod: '',
};

const STORAGE_KEY = 'clicks_onboarding';
const PWD_SESSION_KEY = 'clicks_pwd';
const REF_STORE_KEY = 'clicks_ref_code';

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  clearData: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
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
        return {
          ...defaultData,
          ...parsed,
          referralCode: (parsed.referralCode as string) || refFromStore,
          password: savedPwd,
        };
      }
      return { ...defaultData, referralCode: refFromStore, password: savedPwd };
    } catch {
      /* ignore */
    }
    return { ...defaultData, referralCode: refFromStore };
  });

  useEffect(() => {
    try {
      // Don't persist password to localStorage
      const { password, ...safe } = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {}
  }, [data]);

  const updateData = (partial: Partial<OnboardingData>) => {
    if (partial.password !== undefined) {
      try { sessionStorage.setItem(PWD_SESSION_KEY, partial.password); } catch {}
    }
    setData(prev => ({ ...prev, ...partial }));
  };

  const clearData = () => {
    setData(defaultData);
    localStorage.removeItem(STORAGE_KEY);
    try { sessionStorage.removeItem(PWD_SESSION_KEY); } catch {}
  };

  return (
    <OnboardingContext.Provider value={{ data, updateData, clearData }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
