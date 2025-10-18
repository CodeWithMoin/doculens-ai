import type { RuntimeConfig } from '../api/types';

export type Persona = 'analyst' | 'manager' | 'reviewer' | 'developer' | 'executive';

export const DEFAULT_PERSONAS: Persona[] = ['analyst', 'manager', 'reviewer', 'developer', 'executive'];

export interface AppSettings {
  apiBaseUrl: string;
  apiKey: string;
  chunkPreviewLimit: number;
  summaryChunkLimit: number;
  qaTopK: number;
  searchResultLimit: number;
  persona: Persona;
}

export interface SettingsContextValue {
  settings: AppSettings;
  serverConfig?: RuntimeConfig;
  isLoaded: boolean;
  error?: string;
  personaOptions: Persona[];
  roleDefinitions?: RuntimeConfig['role_definitions'];
  updateSettings: (update: Partial<AppSettings>) => void;
  resetSettings: () => void;
  setPersona: (persona: Persona) => void;
}
