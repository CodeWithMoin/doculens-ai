import { useMemo, useState } from 'react';
import { Clock, FileText } from 'lucide-react';

import type { DocumentEntry } from '../api/types';
import { cn } from '../lib/utils';
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
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Documents</CardTitle>
          <Badge variant="muted" className="text-[11px] uppercase tracking-wide">
            {documents.length}
          </Badge>
        </div>
        <Input
          aria-label="Filter documents"
          placeholder="Filter by name, type, or id"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </CardHeader>
      <CardContent className="flex max-h-[480px] flex-col gap-2 overflow-hidden">
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {filtered.map((doc) => {
            const isSelected = doc.document_id === selectedId;
            const uploadedAt = new Date(doc.uploaded_at);
            return (
              <button
                type="button"
                key={doc.document_id}
                onClick={() => onSelect(doc)}
                className={cn(
                  'w-full rounded-lg border border-border/70 bg-card text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSelected ? 'border-primary/70 bg-primary/5' : '',
                )}
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="rounded-full bg-secondary p-2 text-secondary-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {doc.filename ?? doc.document_id}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {doc.doc_type ?? 'untyped'}
                        </Badge>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {uploadedAt.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{doc.chunk_count ?? 0} chunks</span>
                      <span>{doc.embedded_chunk_count ?? 0} embedded</span>
                      {doc.summary?.doc_type ? <span>Summary: {doc.summary.doc_type}</span> : null}
                    </div>
                    {doc.summary?.summary ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground/90">
                        “{doc.summary.summary}”
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Summary pending</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {!filtered.length ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              No matching documents yet.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
