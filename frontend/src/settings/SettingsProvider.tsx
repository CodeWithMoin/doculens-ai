import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { fetchRuntimeConfig, setApiConfig } from '../api/client';
import type { RuntimeConfig } from '../api/types';

const STORAGE_KEY = 'doculens.settings';

export type Persona = 'operations-manager' | 'analyst' | 'business-owner' | 'integrator';

export interface AppSettings {
  apiBaseUrl: string;
  apiKey: string;
  chunkPreviewLimit: number;
  summaryChunkLimit: number;
  qaTopK: number;
  searchResultLimit: number;
  persona: Persona;
}

interface SettingsContextValue {
  settings: AppSettings;
  serverConfig?: RuntimeConfig;
  isLoaded: boolean;
  error?: string;
  updateSettings: (update: Partial<AppSettings>) => void;
  resetSettings: () => void;
  setPersona: (persona: Persona) => void;
}

const defaultSettings: AppSettings = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  apiKey: '',
  chunkPreviewLimit: 25,
  summaryChunkLimit: 12,
  qaTopK: 5,
  searchResultLimit: 10,
  persona: 'analyst',
};

function parseStoredSettings():
  | { settings: AppSettings; hasStored: boolean }
  | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      hasStored: true,
      settings: {
        ...defaultSettings,
        ...parsed,
      },
    };
  } catch {
    return undefined;
  }
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const stored = useMemo(() => parseStoredSettings(), []);
  const hasStoredRef = useRef<boolean>(Boolean(stored?.hasStored));
  const [settings, setSettings] = useState<AppSettings>(stored?.settings ?? defaultSettings);
  const [serverConfig, setServerConfig] = useState<RuntimeConfig | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setApiConfig({
      baseUrl: settings.apiBaseUrl,
      apiKey: settings.apiKey || undefined,
    });
  }, [settings.apiBaseUrl, settings.apiKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    setError(undefined);

    fetchRuntimeConfig()
      .then((config) => {
        if (cancelled) return;
        setServerConfig(config);
        setApiConfig({ apiKeyHeader: config.api_key_header });

        if (!hasStoredRef.current) {
          setSettings((current) => ({
            ...current,
            chunkPreviewLimit: config.chunk_preview_limit,
            summaryChunkLimit: config.summary_chunk_limit,
            qaTopK: config.qa_top_k,
            searchResultLimit: config.search_result_limit,
          }));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load server configuration.';
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.apiBaseUrl, settings.apiKey]);

  const updateSettings = (update: Partial<AppSettings>) => {
    hasStoredRef.current = true;
    setSettings((current) => ({
      ...current,
      ...update,
    }));
  };

  const resetSettings = () => {
    hasStoredRef.current = true;
    setSettings((current) => ({
      ...current,
      apiKey: '',
      chunkPreviewLimit: serverConfig?.chunk_preview_limit ?? defaultSettings.chunkPreviewLimit,
      summaryChunkLimit: serverConfig?.summary_chunk_limit ?? defaultSettings.summaryChunkLimit,
      qaTopK: serverConfig?.qa_top_k ?? defaultSettings.qaTopK,
      searchResultLimit: serverConfig?.search_result_limit ?? defaultSettings.searchResultLimit,
    }));
  };

  const setPersona = (persona: Persona) => {
    hasStoredRef.current = true;
    setSettings((current) => ({ ...current, persona }));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        serverConfig,
        isLoaded,
        error,
        updateSettings,
        resetSettings,
        setPersona,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider.');
  }
  return context;
}
