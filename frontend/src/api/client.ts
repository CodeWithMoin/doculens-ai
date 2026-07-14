import type {
  ApiError,
  AuthResponse,
  ChunkRecord,
  DashboardInsights,
  ClassificationHistoryEntry,
  ClassificationOverrideRequest,
  DocumentLifecycleResponse,
  DocumentClassificationRequest,
  DocumentClassificationResponse,
  DocumentEntry,
  EventResponse,
  EventEntry,
  QAHistoryEntry,
  LabelRequestPayload,
  LabelResponse,
  LabelsResponse,
  RuntimeConfig,
  SearchHistoryEntry,
  UploadResponse,
  UserProfile,
} from './types';
import {
  IS_STATIC_SHOWCASE,
  STATIC_AUTH_RESPONSE,
  STATIC_CHUNKS,
  STATIC_CLASSIFICATION_HISTORY,
  STATIC_DASHBOARD_INSIGHTS,
  STATIC_DOCUMENTS,
  STATIC_EVENTS,
  STATIC_LABELS,
  STATIC_QA_HISTORY,
  STATIC_RUNTIME_CONFIG,
  STATIC_SEARCH_HISTORY,
  STATIC_USER,
} from '../demo/staticShowcase';

type QueryParams = Record<string, string | number | boolean | undefined>;

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  apiKeyHeader: string;
  accessToken?: string;
}

const defaultBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin);
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

export function setAuthToken(token?: string | null) {
  apiConfig = { ...apiConfig, accessToken: token ?? undefined };
}

export function clearAuthToken() {
  apiConfig = { ...apiConfig, accessToken: undefined };
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

  if (apiConfig.accessToken) {
    headers.set('Authorization', `Bearer ${apiConfig.accessToken}`);
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

function rejectStaticShowcaseMutation(): never {
  const error: ApiError = new Error('This action is disabled in the read-only showcase.');
  error.status = 403;
  error.payload = { detail: error.message };
  throw error;
}

export async function fetchDocuments(limit = 20): Promise<DocumentEntry[]> {
  if (IS_STATIC_SHOWCASE) return STATIC_DOCUMENTS.slice(0, limit);
  const response = await fetch(resolveUrl('/events/documents', { limit }), {
    headers: buildHeaders(),
  });
  return handleResponse<DocumentEntry[]>(response);
}

export async function fetchEvents(limit = 20): Promise<EventEntry[]> {
  if (IS_STATIC_SHOWCASE) return STATIC_EVENTS.slice(0, limit);
  const response = await fetch(resolveUrl('/events', { limit }), {
    headers: buildHeaders(),
  });
  return handleResponse<EventEntry[]>(response);
}

export async function archiveDocument(documentId: string, reason?: string): Promise<DocumentLifecycleResponse> {
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
  const response = await fetch(resolveUrl(`/events/documents/${documentId}/archive`), {
    method: 'POST',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(reason ? { reason } : {}),
  });
  return handleResponse<DocumentLifecycleResponse>(response);
}

export async function deleteDocument(
  documentId: string,
  options?: { reason?: string; purgeVectors?: boolean },
): Promise<DocumentLifecycleResponse> {
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
  const response = await fetch(
    resolveUrl(`/events/documents/${documentId}`, {
      reason: options?.reason,
      purge_vectors: options?.purgeVectors ?? true,
    }),
    {
      method: 'DELETE',
      headers: buildHeaders(),
    },
  );
  return handleResponse<DocumentLifecycleResponse>(response);
}

export async function restoreDocument(documentId: string, reason?: string): Promise<DocumentLifecycleResponse> {
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
  const response = await fetch(resolveUrl(`/events/documents/${documentId}/restore`), {
    method: 'POST',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(reason ? { reason } : {}),
  });
  return handleResponse<DocumentLifecycleResponse>(response);
}

export async function fetchDocumentChunks(
  documentId: string,
  limit: number,
): Promise<ChunkRecord[]> {
  if (IS_STATIC_SHOWCASE) return (STATIC_CHUNKS[documentId] ?? []).slice(0, limit);
  const response = await fetch(
    resolveUrl(`/events/documents/${documentId}/chunks`, { limit }),
    {
      headers: buildHeaders(),
    },
  );
  return handleResponse<ChunkRecord[]>(response);
}

export async function fetchQaHistory(limit = 20): Promise<QAHistoryEntry[]> {
  if (IS_STATIC_SHOWCASE) return STATIC_QA_HISTORY.slice(0, limit);
  const response = await fetch(resolveUrl('/events/qa/history', { limit }), {
    headers: buildHeaders(),
  });
  return handleResponse<QAHistoryEntry[]>(response);
}

export async function fetchSearchHistory(limit = 20): Promise<SearchHistoryEntry[]> {
  if (IS_STATIC_SHOWCASE) return STATIC_SEARCH_HISTORY.slice(0, limit);
  const response = await fetch(resolveUrl('/events/search/history', { limit }), {
    headers: buildHeaders(),
  });
  return handleResponse<SearchHistoryEntry[]>(response);
}

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  if (IS_STATIC_SHOWCASE) return STATIC_RUNTIME_CONFIG;
  const response = await fetch(resolveUrl('/events/config'), {
    headers: buildHeaders(),
  });
  return handleResponse<RuntimeConfig>(response);
}

export async function fetchDashboardInsights(): Promise<DashboardInsights> {
  if (IS_STATIC_SHOWCASE) return STATIC_DASHBOARD_INSIGHTS;
  const response = await fetch(resolveUrl('/events/insights/dashboard'), {
    headers: buildHeaders(),
  });
  return handleResponse<DashboardInsights>(response);
}

export async function postEvent(payload: Record<string, unknown>): Promise<EventResponse> {
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
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
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
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

export async function login(credentials: { email: string; password: string }): Promise<AuthResponse> {
  if (IS_STATIC_SHOWCASE) return STATIC_AUTH_RESPONSE;
  const response = await fetch(resolveUrl('/auth/login'), {
    method: 'POST',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(credentials),
  });
  return handleResponse<AuthResponse>(response);
}

export async function fetchProfile(): Promise<UserProfile> {
  if (IS_STATIC_SHOWCASE) return STATIC_USER;
  const response = await fetch(resolveUrl('/auth/me'), {
    headers: buildHeaders(),
  });
  return handleResponse<UserProfile>(response);
}

export async function classifyDocument(
  documentId: string,
  payload: DocumentClassificationRequest = {},
): Promise<DocumentClassificationResponse> {
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
  const response = await fetch(resolveUrl(`/events/documents/${documentId}/classify`), {
    method: 'POST',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(payload),
  });
  return handleResponse<DocumentClassificationResponse>(response);
}

export async function fetchLabels(): Promise<LabelsResponse> {
  if (IS_STATIC_SHOWCASE) return STATIC_LABELS;
  const response = await fetch(resolveUrl('/events/labels'), {
    headers: buildHeaders(),
  });
  return handleResponse<LabelsResponse>(response);
}

export async function createLabel(payload: LabelRequestPayload): Promise<LabelResponse> {
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
  const response = await fetch(resolveUrl('/events/labels'), {
    method: 'POST',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(payload),
  });
  return handleResponse<LabelResponse>(response);
}

export async function updateLabel(labelId: string, payload: Partial<LabelRequestPayload>): Promise<LabelResponse> {
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
  const response = await fetch(resolveUrl(`/events/labels/${labelId}`), {
    method: 'PATCH',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(payload),
  });
  return handleResponse<LabelResponse>(response);
}

export async function deleteLabel(labelId: string, force = false): Promise<void> {
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
  const response = await fetch(resolveUrl(`/events/labels/${labelId}`, { force }), {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  await handleResponse<void>(response);
}

export async function fetchClassificationHistory(documentId: string): Promise<ClassificationHistoryEntry[]> {
  if (IS_STATIC_SHOWCASE) return STATIC_CLASSIFICATION_HISTORY[documentId] ?? [];
  const response = await fetch(resolveUrl(`/events/documents/${documentId}/classification-history`), {
    headers: buildHeaders(),
  });
  return handleResponse<ClassificationHistoryEntry[]>(response);
}

export async function overrideClassification(
  documentId: string,
  payload: ClassificationOverrideRequest,
): Promise<ClassificationHistoryEntry> {
  if (IS_STATIC_SHOWCASE) rejectStaticShowcaseMutation();
  const response = await fetch(resolveUrl(`/events/documents/${documentId}/classification-history`), {
    method: 'POST',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(payload),
  });
  return handleResponse<ClassificationHistoryEntry>(response);
}
