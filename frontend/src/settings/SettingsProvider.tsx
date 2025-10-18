import { useEffect, useMemo, useRef, useState } from 'react';

import { fetchRuntimeConfig, setApiConfig } from '../api/client';
import type { RuntimeConfig } from '../api/types';
import type { AppSettings, Persona } from './types';
import { DEFAULT_PERSONAS } from './types';
import { SettingsContext } from './context';

const STORAGE_KEY = 'doculens.settings';

const defaultSettings: AppSettings = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  apiKey: '',
  chunkPreviewLimit: 25,
  summaryChunkLimit: 12,
  qaTopK: 5,
  searchResultLimit: 10,
  persona: 'analyst',
};

function isPersona(value: string): value is Persona {
  return DEFAULT_PERSONAS.includes(value as Persona);
}

function normalisePersona(value: string | undefined, options: Persona[]): Persona {
  const candidate = typeof value === 'string' ? value.toLowerCase() : undefined;
  if (candidate && options.includes(candidate as Persona)) {
    return candidate as Persona;
  }
  return options[0];
}

function derivePersonaOptions(config?: RuntimeConfig): Persona[] {
  const incoming = config?.persona_options ?? [];
  const filtered = incoming
    .map((option) => option.toLowerCase())
    .filter(isPersona) as Persona[];
  return filtered.length ? filtered : DEFAULT_PERSONAS;
}

function parseStoredSettings():
  | { settings: AppSettings; hasStored: boolean }
  | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const merged = {
      ...defaultSettings,
      ...parsed,
    };
    return {
      hasStored: true,
      settings: {
        ...merged,
        persona: normalisePersona(merged.persona, DEFAULT_PERSONAS),
      },
    };
  } catch {
    return undefined;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const stored = useMemo(() => parseStoredSettings(), []);
  const hasStoredRef = useRef<boolean>(Boolean(stored?.hasStored));
  const [settings, setSettings] = useState<AppSettings>(stored?.settings ?? defaultSettings);
  const [serverConfig, setServerConfig] = useState<RuntimeConfig | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [personaOptions, setPersonaOptions] = useState<Persona[]>(DEFAULT_PERSONAS);
  const [roleDefinitions, setRoleDefinitions] = useState<RuntimeConfig['role_definitions']>();

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
        setPersonaOptions(derivePersonaOptions(config));
        setRoleDefinitions(config.role_definitions);

        if (!hasStoredRef.current) {
          setSettings((current) => ({
            ...current,
            chunkPreviewLimit: config.chunk_preview_limit,
            summaryChunkLimit: config.summary_chunk_limit,
            qaTopK: config.qa_top_k,
            searchResultLimit: config.search_result_limit,
            persona: normalisePersona(current.persona, derivePersonaOptions(config)),
          }));
        } else {
          setSettings((current) => ({
            ...current,
            persona: normalisePersona(current.persona, derivePersonaOptions(config)),
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
      persona: update.persona ? normalisePersona(update.persona, personaOptions) : current.persona,
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
      persona: normalisePersona(
        serverConfig?.persona_options?.[0] ?? defaultSettings.persona,
        personaOptions,
      ),
    }));
  };

  const setPersona = (persona: Persona) => {
    hasStoredRef.current = true;
    setSettings((current) => ({ ...current, persona: normalisePersona(persona, personaOptions) }));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        serverConfig,
        isLoaded,
        error,
        personaOptions,
        roleDefinitions,
        updateSettings,
        resetSettings,
        setPersona,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
