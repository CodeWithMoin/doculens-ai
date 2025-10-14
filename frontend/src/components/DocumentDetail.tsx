import { useEffect, useMemo, useState } from 'react';
import { Brain, FileText, Layers, MessageSquare } from 'lucide-react';

import { fetchDocumentChunks, postEvent } from '../api/client';
import type { ChunkRecord, DocumentEntry, EventResponse } from '../api/types';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { useSettings } from '../settings/SettingsProvider';
import { useNotificationStore } from '../stores/notificationStore';

interface DocumentDetailProps {
  document?: DocumentEntry;
  onEventQueued?: (eventType: string) => void;
}

export function DocumentDetail({ document, onEventQueued }: DocumentDetailProps) {
  const { settings } = useSettings();
  const [chunks, setChunks] = useState<ChunkRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qaQuestion, setQaQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (!document) {
      setChunks([]);
      setError(null);
      return;
    }
    setBanner(null);
    setIsLoading(true);
    setError(null);
    fetchDocumentChunks(document.document_id, settings.chunkPreviewLimit)
      .then(setChunks)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load chunks';
        setError(message);
        addNotification({ title: 'Chunk retrieval failed', description: message, variant: 'error' });
      })
      .finally(() => setIsLoading(false));
  }, [document?.document_id, settings.chunkPreviewLimit]);

  const summaryItems = useMemo(() => {
    const summary = document?.summary;
    if (!summary) return null;
    return (
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <FileText className="h-5 w-5 text-primary" /> Summary
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Generated {summary.generated_at ? new Date(summary.generated_at).toLocaleString() : 'recently'}
            </span>
          </div>
          <CardDescription>High-level overview produced from the latest ingestion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-foreground/90">
          <p>{summary.summary}</p>
          <div className="grid gap-2 text-xs text-muted-foreground">
            {summary.doc_type ? (
              <span>
                <strong className="font-medium text-foreground">Type:</strong> {summary.doc_type}
              </span>
            ) : null}
            {typeof summary.source_chunk_count === 'number' ? (
              <span>
                <strong className="font-medium text-foreground">Source chunks:</strong> {summary.source_chunk_count}
              </span>
            ) : null}
          </div>
          {summary.bullet_points?.length ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highlights</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {summary.bullet_points.map((line, idx) => (
                  <li key={idx} className="rounded-md bg-muted/30 px-3 py-2">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {summary.next_steps?.length ? (
            <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended next steps</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {summary.next_steps.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }, [document?.summary]);

  const reissueSummary = async () => {
    if (!document) return;
    setBanner(null);
    setIsSubmitting(true);
    try {
      const response: EventResponse = await postEvent({
        event_type: 'document_summary',
        document_id: document.document_id,
        filename: document.filename,
        doc_type: document.doc_type,
        chunks_limit: settings.summaryChunkLimit,
      });
      setBanner({
        type: 'info',
        text: `Summary task queued. Event ${response.event_id}.`,
      });
      addNotification({
        title: 'Summary queued',
        description: `Document ${document.filename ?? document.document_id} is being summarised (event ${response.event_id}).`,
        variant: 'success',
        href: '/',
      });
      onEventQueued?.('document_summary');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to queue summary';
      setBanner({
        type: 'error',
        text: message,
      });
      addNotification({ title: 'Summary failed to queue', description: message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const runQA = async () => {
    if (!qaQuestion.trim()) {
      setBanner({
        type: 'error',
        text: 'Please enter a question before running QA.',
      });
      return;
    }
    setBanner(null);
    setIsSubmitting(true);
    try {
      const response: EventResponse = await postEvent({
        event_type: 'qa_query',
        query: qaQuestion,
        top_k: settings.qaTopK,
        filters: { document_id: document?.document_id },
      });
      setQaQuestion('');
      setBanner({
        type: 'info',
        text: `QA task queued. Event ${response.event_id}.`,
      });
      addNotification({
        title: 'QA task queued',
        description: `Event ${response.event_id} will deliver an answer shortly.`,
        variant: 'success',
        href: '/qa',
      });
      onEventQueued?.('qa_query');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to queue QA query';
      setBanner({
        type: 'error',
        text: message,
      });
      addNotification({ title: 'QA request failed', description: message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!document) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p>Select a document to view intelligence and QA tools.</p>
        </CardContent>
      </Card>
    );
  }

  const title = document.summary?.filename ?? document.filename ?? document.document_id;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {document.doc_type ?? 'untyped'}
              </Badge>
              <span className="text-xs text-muted-foreground">#{document.document_id}</span>
            </div>
            <CardTitle className="text-2xl font-semibold leading-tight text-foreground">{title}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{new Date(document.uploaded_at).toLocaleString()}</span>
              <span>{document.chunk_count ?? 0} chunks</span>
              <span>{document.embedded_chunk_count ?? 0} embedded</span>
            </CardDescription>
          </div>
          <Button onClick={reissueSummary} disabled={isSubmitting} variant="accent" className="gap-2">
            <Brain className={cn('h-4 w-4', isSubmitting ? 'animate-spin' : '')} />
            Summarise again
          </Button>
        </CardHeader>
      </Card>

      {banner ? (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm shadow-subtle',
            banner.type === 'info'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-destructive/40 bg-destructive/10 text-destructive',
          )}
        >
          {banner.text}
        </div>
      ) : null}

      {summaryItems}

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="h-5 w-5 text-primary" /> Ask a question
          </CardTitle>
          <CardDescription>Using top_k = {settings.qaTopK}. Adjust under Settings if needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="What would you like to know about this document?"
            value={qaQuestion}
            onChange={(event) => setQaQuestion(event.target.value)}
            rows={4}
          />
          <div className="flex justify-end">
            <Button onClick={runQA} disabled={isSubmitting} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Run QA
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-primary" /> Chunk previews
            </CardTitle>
            <CardDescription>
              Showing up to {settings.chunkPreviewLimit} chunks used for retrieval.
            </CardDescription>
          </div>
          {isLoading ? <span className="text-sm text-muted-foreground">Loading…</span> : null}
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {chunks.map((chunk) => {
            const meta = (chunk.metadata ?? {}) as Record<string, unknown>;
            const chunkIndex =
              typeof meta.chunk_index === 'number' || typeof meta.chunk_index === 'string'
                ? meta.chunk_index
                : '?';
            const rawTokenCount = meta.token_count;
            const tokenCount =
              typeof rawTokenCount === 'number' ? rawTokenCount : Number(rawTokenCount ?? 0);
            const reference = typeof meta.reference === 'string' ? meta.reference : undefined;
            const sourceDoc = typeof meta.document_id === 'string' ? meta.document_id : undefined;
            const sourceFile = typeof meta.filename === 'string' ? meta.filename : undefined;

            return (
              <div
                key={chunk.id}
                className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm shadow-subtle"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      Chunk {chunkIndex}
                    </Badge>
                    <span>{tokenCount} tokens</span>
                  </div>
                  {reference ? <span className="font-mono text-[11px]">{reference}</span> : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{chunk.contents}</p>
                {(sourceDoc || sourceFile) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {sourceDoc ? <span>Doc: {sourceDoc}</span> : null}
                    {sourceFile ? <span>File: {sourceFile}</span> : null}
                  </div>
                )}
              </div>
            );
          })}
          {!chunks.length && !isLoading ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              No chunks stored for this document yet.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
