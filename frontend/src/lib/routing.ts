import type { DocumentEntry } from '../api/types';

export const ROLE_ORDER = ['Finance', 'Compliance', 'Operations', 'Legal', 'HR', 'Integrator'] as const;
export type RoleKey = (typeof ROLE_ORDER)[number];

function metadataValue(document: DocumentEntry, key: string): unknown {
  const metadata = document.metadata;
  return metadata && typeof metadata === 'object' ? metadata[key] : undefined;
}

export function inferRole(document: DocumentEntry): RoleKey {
  const candidate = document.assigned_role ?? metadataValue(document, 'assigned_role') ?? metadataValue(document, 'role');
  if (typeof candidate === 'string') {
    const match = ROLE_ORDER.find((role) => role.toLowerCase() === candidate.toLowerCase());
    if (match) return match;
  }

  const type = (document.doc_type ?? '').toLowerCase();
  if (/resume|cv|offer|employee|training/.test(type)) return 'HR';
  if (/contract|agreement|legal/.test(type)) return 'Legal';
  if (/policy|audit|compliance|tax/.test(type)) return 'Compliance';
  if (/invoice|receipt|expense|financial/.test(type)) return 'Finance';
  return 'Operations';
}

export function inferStatus(document: DocumentEntry): string {
  if (document.deleted_at) return 'Deleted';
  if (document.archived_at) return 'Archived';
  const explicit = document.status ?? metadataValue(document, 'status');
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  if (document.summary && (document.embedded_chunk_count ?? 0) > 0) return 'Completed';
  if ((document.embedded_chunk_count ?? 0) > 0) return 'Enriching';
  if ((document.chunk_count ?? 0) > 0) return 'Embedding';
  return 'Processing';
}

export function inferDueDate(document: DocumentEntry): string | null {
  const candidate = document.due_at ?? metadataValue(document, 'due_at') ?? metadataValue(document, 'due_date');
  return typeof candidate === 'string' && candidate ? candidate : null;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}
