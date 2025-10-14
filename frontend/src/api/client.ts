import type {
  ApiError,
  ChunkRecord,
  DocumentEntry,
  EventResponse,
  DashboardInsights,
  QAHistoryEntry,
  RuntimeConfig,
  SearchHistoryEntry,
  UploadResponse,
} from './types';

type QueryParams = Record<string, string | number | boolean | undefined>;

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  apiKeyHeader: string;
}

const defaultBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const defaultApiKeyHeader = 'X-API-Key';

let apiConfig: ApiConfig = {
  baseUrl: defaultBaseUrl,
  apiKeyHeader: defaultApiKeyHeader,
};

export function getApiConfig(): ApiConfig {
  return { ...apiConfig };
}

export function setApiConfig(update: Partial<ApiConfig>) {
  apiConfig = { ...apiConfig, ...update };
}

function resolveUrl(path: string, params?: QueryParams): string {
  const url = new URL(path, apiConfig.baseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

function buildHeaders(extra?: HeadersInit, includeContentType = false): Headers {
  const headers = new Headers(extra ?? {});

  if (includeContentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (apiConfig.apiKey) {
    headers.set(apiConfig.apiKeyHeader, apiConfig.apiKey);
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    try {
      error.payload = await response.json();
    } catch {
      // ignore JSON parse failures for non-JSON responses
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchDocuments(limit = 20): Promise<DocumentEntry[]> {
  const response = await fetch(resolveUrl('/events/documents', { limit }), {
    headers: buildHeaders(),
  });
  return handleResponse<DocumentEntry[]>(response);
}

export async function fetchDocumentChunks(
  documentId: string,
  limit: number,
): Promise<ChunkRecord[]> {
  const response = await fetch(
    resolveUrl(`/events/documents/${documentId}/chunks`, { limit }),
    {
      headers: buildHeaders(),
    },
  );
  return handleResponse<ChunkRecord[]>(response);
}

export async function fetchQaHistory(limit = 20): Promise<QAHistoryEntry[]> {
  const response = await fetch(resolveUrl('/events/qa/history', { limit }), {
    headers: buildHeaders(),
  });
  return handleResponse<QAHistoryEntry[]>(response);
}

export async function fetchSearchHistory(limit = 20): Promise<SearchHistoryEntry[]> {
  const response = await fetch(resolveUrl('/events/search/history', { limit }), {
    headers: buildHeaders(),
  });
  return handleResponse<SearchHistoryEntry[]>(response);
}

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch(resolveUrl('/events/config'), {
    headers: buildHeaders(),
  });
  return handleResponse<RuntimeConfig>(response);
}

export async function fetchDashboardInsights(): Promise<DashboardInsights> {
  const response = await fetch(resolveUrl('/events/insights/dashboard'), {
    headers: buildHeaders(),
  });
  return handleResponse<DashboardInsights>(response);
}

export async function postEvent(payload: Record<string, unknown>): Promise<EventResponse> {
  const response = await fetch(resolveUrl('/events'), {
    method: 'POST',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(payload),
  });
  return handleResponse<EventResponse>(response);
}

export async function uploadDocument(options: {
  file: File;
  docType?: string;
  metadata?: Record<string, unknown>;
}): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', options.file);
  if (options.docType) {
    form.append('doc_type', options.docType);
  }
  if (options.metadata && Object.keys(options.metadata).length > 0) {
    form.append('metadata', JSON.stringify(options.metadata));
  }

  const response = await fetch(resolveUrl('/events/documents/upload'), {
    method: 'POST',
    headers: buildHeaders(undefined, false),
    body: form,
  });
  return handleResponse<UploadResponse>(response);
}
