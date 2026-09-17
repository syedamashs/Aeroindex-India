import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Filters } from '@/data/types';

interface ToastMsg {
  message: string;
  type: 'success' | 'info' | 'warning';
}

interface AppContextValue {
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  resetFilters: () => void;
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  lastUpdate: number;
  triggerUpdate: (count?: number) => void;
  toast: ToastMsg | null;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

const DEFAULT_FILTERS: Filters = {
  origin: 'all',
  destination: 'all',
  airline: 'all',
  travelClass: 'all',
  bookingWindow: 'all',
  preset: 'all',
  customStart: '2026-01-01',
  customEnd: '2026-12-31',
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [demoMode, setDemoMode] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const setFilters = useCallback((f: Partial<Filters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  const resetFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), []);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const triggerUpdate = useCallback(
    (count = 200) => {
      setLastUpdate(Date.now());
      showToast('Dashboard refreshed from the current SQLite database.', 'success');
    },
    [showToast],
  );

  return (
    <AppContext.Provider
      value={{
        filters,
        setFilters,
        resetFilters,
        demoMode,
        setDemoMode,
        lastUpdate,
        triggerUpdate,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
