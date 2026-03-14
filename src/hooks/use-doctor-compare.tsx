"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface CompareDoctor {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  consultationFeeCents: number;
  videoFeeCents: number | null;
  currency: string;
  city: string | null;
  consultationTypes: string[];
  yearsExperience: number | null;
}

interface DoctorCompareContextType {
  compareList: CompareDoctor[];
  addToCompare: (doctor: CompareDoctor) => void;
  removeFromCompare: (doctorId: string) => void;
  isInCompare: (doctorId: string) => boolean;
  clearCompare: () => void;
  isCompareOpen: boolean;
  setCompareOpen: (open: boolean) => void;
}

const DoctorCompareContext = createContext<DoctorCompareContextType | null>(
  null
);

const MAX_COMPARE = 3;

export function DoctorCompareProvider({ children }: { children: ReactNode }) {
  const [compareList, setCompareList] = useState<CompareDoctor[]>([]);
  const [isCompareOpen, setCompareOpen] = useState(false);

  const addToCompare = useCallback((doctor: CompareDoctor) => {
    setCompareList((prev) => {
      if (prev.length >= MAX_COMPARE) return prev;
      if (prev.some((d) => d.id === doctor.id)) return prev;
      return [...prev, doctor];
    });
  }, []);

  const removeFromCompare = useCallback((doctorId: string) => {
    setCompareList((prev) => prev.filter((d) => d.id !== doctorId));
  }, []);

  const isInCompare = useCallback(
    (doctorId: string) => compareList.some((d) => d.id === doctorId),
    [compareList]
  );

  const clearCompare = useCallback(() => {
    setCompareList([]);
    setCompareOpen(false);
  }, []);

  return (
    <DoctorCompareContext.Provider
      value={{
        compareList,
        addToCompare,
        removeFromCompare,
        isInCompare,
        clearCompare,
        isCompareOpen,
        setCompareOpen,
      }}
    >
      {children}
    </DoctorCompareContext.Provider>
  );
}

export function useDoctorCompare() {
  const ctx = useContext(DoctorCompareContext);
  if (!ctx) {
    throw new Error(
      "useDoctorCompare must be used within a DoctorCompareProvider"
    );
  }
  return ctx;
}

/**
 * Optional version that returns null when no provider is present.
 * Useful for components that may or may not be inside a CompareProvider.
 */
export function useDoctorCompareOptional() {
  return useContext(DoctorCompareContext);
}
