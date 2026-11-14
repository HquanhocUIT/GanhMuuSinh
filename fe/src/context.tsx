import { createContext, useContext } from 'react';
import type { Catalog, Passport, Quest, Vendor, WardRoute } from './types';

export interface AppState {
  catalog: Catalog;
  passport: Passport;
  passportError: string;
  lang: 'vi' | 'en';
  t: (vi: string, en: string) => string;
  active: Quest | null;
  wardRoute: WardRoute | null;
  saved: string[];
  navigate: (page: string) => void;
  preview: (quest: Quest) => void;
  start: (quest: Quest) => void;
  openWardRoute: (route: WardRoute) => void;
  toggleSave: (id: string) => void;
  story: (vendor: Vendor) => void;
  toast: (text: string) => void;
  refreshPassport: () => Promise<void>;
}
export const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('Missing AppContext');
  return context;
}
