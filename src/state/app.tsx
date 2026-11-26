import { useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';

import type { ContentPack } from '@/content/types';
import { ensureContent } from '@/data/content-loader';
import { ContentRepo } from '@/data/content-repo';
import { openExpoDb } from '@/data/expo-db';
import { migrateUserDb } from '@/data/schema';
import { DEFAULT_SETTINGS, UserRepo, type Settings } from '@/data/user-repo';
import { issueDueEditions } from '@/domain/edition-service';
import pack from '@/generated/content-pack.json';
import { dark, light, type Palette } from '@/theme';

interface AppContextValue {
  content: ContentRepo;
  user: UserRepo;
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  /** Increments whenever user data changes, so screens can refresh. */
  rev: number;
  bump: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [value, setValue] = useState<Omit<AppContextValue, 'rev' | 'bump' | 'setSetting'> | null>(null);
  const [rev, setRev] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const bump = useCallback(() => setRev((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const contentDb = await openExpoDb('content.db');
      const userDb = await openExpoDb('user.db');
      await ensureContent(contentDb, pack as unknown as ContentPack);
      await migrateUserDb(userDb);
      const content = new ContentRepo(contentDb);
      const user = new UserRepo(userDb);
      const settings = await user.settings();
      if (settings.onboarded) await issueDueEditions(content, user, settings, new Date());
      if (!cancelled) setValue({ content, user, settings });
    })().catch((e) => setError(e as Error));
    return () => {
      cancelled = true;
    };
  }, []);

  // A new day may have started while the app was in the background.
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      const v = valueRef.current;
      if (state !== 'active' || !v || !v.settings.onboarded) return;
      const created = await issueDueEditions(v.content, v.user, v.settings, new Date());
      if (created.length) bump();
    });
    return () => sub.remove();
  }, [bump]);

  const setSetting = useCallback(
    async <K extends keyof Settings>(key: K, val: Settings[K]) => {
      const v = valueRef.current;
      if (!v) return;
      await v.user.setSetting(key, val);
      const settings = { ...v.settings, [key]: val };
      if (key === 'onboarded' && val) await issueDueEditions(v.content, v.user, settings, new Date());
      const next = { ...v, settings };
      valueRef.current = next;
      setValue(next);
      bump();
    },
    [bump],
  );

  const ctx = useMemo(() => (value ? { ...value, rev, bump, setSetting } : null), [value, rev, bump, setSetting]);
  if (error) throw error;
  if (!ctx) return <>{fallback}</>;
  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}

export function useSettings(): Settings {
  const ctx = useContext(AppContext);
  return ctx?.settings ?? DEFAULT_SETTINGS;
}

export function usePalette(): Palette {
  const system = useColorScheme();
  const settings = useSettings();
  const scheme = settings.theme === 'system' ? system : settings.theme;
  return scheme === 'dark' ? dark : light;
}

/**
 * Runs an async loader and re-runs it when user data changes or the screen
 * regains focus. Keeps the previous data while reloading, so lists never flash.
 */
export function useData<T>(load: (app: AppContextValue) => Promise<T>, deps: unknown[] = []): { data: T | undefined; reload: () => void } {
  const app = useApp();
  const [data, setData] = useState<T>();
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );
  useEffect(() => {
    let live = true;
    loadRef.current(app).then((d) => live && setData(d));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.rev, tick, ...deps]);
  return { data, reload: () => setTick((t) => t + 1) };
}
