import { useMemo, useState } from 'react';
import { Clock, FileText } from 'lucide-react';

import type { DocumentEntry } from '../api/types';
import { cn } from '../lib/utils';
import { inferDueDate, inferRole, inferStatus, formatDateTime } from '../lib/routing';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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
    <Card className="shadow-none">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Documents</CardTitle>
          <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
            {documents.length}
          </Badge>
        </div>
        <Input
          aria-label="Filter documents"
          placeholder="Filter by name, type, or id"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-10 rounded-lg border-platinum-600"
        />
      </CardHeader>
      <CardContent className="flex max-h-[60vh] flex-col gap-2 overflow-hidden">
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
                  'w-full rounded-lg border border-platinum-600 bg-white px-4 py-3 text-left transition-colors hover:border-lapis-500/40 hover:bg-sky-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lapis-500/40',
                  isSelected ? 'border-lapis-500 bg-sky-blue-900 shadow-sm' : '',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-platinum-600 bg-surface-subtle text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
