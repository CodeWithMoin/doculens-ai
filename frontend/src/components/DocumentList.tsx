import { useMemo, useState } from 'react';
import { Clock, FileText, Search } from 'lucide-react';

import type { DocumentEntry } from '../api/types';
import { cn } from '../lib/utils';
import { inferDueDate, inferRole, inferStatus, formatDateTime } from '../lib/routing';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

export interface DocumentListProps {
  documents: DocumentEntry[];
  onSelect: (document: DocumentEntry) => void;
  selectedId?: string;
}

export function DocumentList({ documents, onSelect, selectedId }: DocumentListProps) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const trimmed = filter.trim().toLowerCase();
    if (!trimmed) return documents;
    return documents.filter((doc) => {
      return (
        (doc.filename ?? '').toLowerCase().includes(trimmed) ||
        (doc.doc_type ?? '').toLowerCase().includes(trimmed) ||
        doc.document_id.toLowerCase().includes(trimmed)
      );
    });
  }, [documents, filter]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Filter documents"
          placeholder="Search by name or type…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-10 rounded-xl border-border/70 bg-surface-subtle pl-9"
        />
        <Badge variant="outline" className="absolute right-3 top-1/2 -translate-y-1/2 bg-background text-[10px] tabular-nums text-muted-foreground">
          {filtered.length}
        </Badge>
      </div>
      <div className="flex max-h-[56vh] min-h-0 flex-col overflow-hidden">
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {filtered.map((doc) => {
            const isSelected = doc.document_id === selectedId;
            const uploadedAt = formatDateTime(doc.uploaded_at);
            const assignedRole = inferRole(doc);
            const status = inferStatus(doc);
            const dueAt = formatDateTime(inferDueDate(doc));
            return (
              <button
                type="button"
                key={doc.document_id}
                onClick={() => onSelect(doc)}
                className={cn(
                  'w-full rounded-xl border border-border/70 bg-background px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  isSelected ? 'border-primary/40 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15' : '',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-subtle text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {doc.filename ?? doc.document_id}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {doc.doc_type ?? 'untyped'}
                        </Badge>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {uploadedAt}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Role: {assignedRole}</span>
                      <span>Status: {status}</span>
                      <span>Due: {dueAt}</span>
                    </div>
                    {doc.summary?.summary ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground/90">“{doc.summary.summary}”</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Summary pending</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {!filtered.length ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-surface-subtle px-4 py-6 text-center text-sm text-muted-foreground">
              No matching documents yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
