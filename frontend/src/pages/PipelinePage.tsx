import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchDocuments } from '../api/client';
import type { DocumentEntry } from '../api/types';
import { DocumentDetail } from '../components/DocumentDetail';
import { DocumentList } from '../components/DocumentList';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { derivePipelineStages } from '../lib/pipeline';
import { inferStatus } from '../lib/routing';
import { cn } from '../lib/utils';

export function PipelinePage() {
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'active' | 'archived'>('active');

  const loadDocuments = (preferredId?: string, preferredView?: 'active' | 'archived') => {
    setIsLoading(true);
    setError(null);
    fetchDocuments(150)
      .then((items) => {
        setDocuments(items);
        const activeItems = items.filter((doc) => {
          const status = inferStatus(doc).toLowerCase();
          return status !== 'archived' && status !== 'deleted';
        });
        const archivedItems = items.filter((doc) => inferStatus(doc).toLowerCase() === 'archived');
        const targetView = preferredView ?? view;
        const requestedId = preferredId ?? searchParams.get('document') ?? selectedId;
        const currentPool = targetView === 'archived' ? archivedItems : activeItems;
        if (requestedId && currentPool.some((doc) => doc.document_id === requestedId)) {
          setSelectedId(requestedId);
        } else if (currentPool.length) {
          setSelectedId(currentPool[0].document_id);
        } else {
          setSelectedId(undefined);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load documents';
        setError(message);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const activeDocuments = useMemo(
    () =>
      documents.filter((doc) => {
        const status = inferStatus(doc).toLowerCase();
        return status !== 'archived' && status !== 'deleted';
      }),
    [documents],
  );

  const archivedDocuments = useMemo(
    () => documents.filter((doc) => inferStatus(doc).toLowerCase() === 'archived'),
    [documents],
  );

  const visibleDocuments = view === 'archived' ? archivedDocuments : activeDocuments;

  useEffect(() => {
    if (!visibleDocuments.length) {
      setSelectedId(undefined);
      return;
    }
    if (selectedId && visibleDocuments.some((doc) => doc.document_id === selectedId)) {
      return;
    }
    setSelectedId(visibleDocuments[0].document_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, visibleDocuments.map((doc) => doc.document_id).join(',')]);

  const selectedDocument = useMemo(
    () => visibleDocuments.find((doc) => doc.document_id === selectedId) ?? documents.find((doc) => doc.document_id === selectedId),
    [visibleDocuments, documents, selectedId],
  );

  const handleEventQueued = (eventType: string, documentId?: string) => {
    if (eventType === 'document_restored') {
      setView('active');
      loadDocuments(documentId, 'active');
      return;
    }
    loadDocuments(documentId);
  };

  const pipelineSummary = useMemo(() => {
    let needsSummary = 0;
    let needsRouting = 0;
    let completed = 0;

    activeDocuments.forEach((doc) => {
      const stages = derivePipelineStages(doc);
      const summaryStage = stages.find((stage) => stage.id === 'summary');
      const routingStage = stages.find((stage) => stage.id === 'routing');
      if (stages.every((stage) => stage.state === 'complete')) {
        completed += 1;
      }
      if (summaryStage && summaryStage.state !== 'complete') {
        needsSummary += 1;
      }
      if (routingStage && routingStage.state !== 'complete') {
        needsRouting += 1;
      }
    });

    return {
      active: activeDocuments.length,
      archived: archivedDocuments.length,
      completed,
      needsSummary,
      needsRouting,
      inFlight: Math.max(activeDocuments.length - completed, 0),
    };
  }, [activeDocuments, archivedDocuments]);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]">
      <div className="flex flex-col gap-6">
        <Card className="shadow-none">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle className="text-sm font-semibold text-foreground">Pipeline overview</CardTitle>
            <CardDescription>Quick snapshot of throughput and bottlenecks.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <PipelineMetric label="Active in flight" value={pipelineSummary.inFlight} helper="Processing or enrichment underway" />
            <PipelineMetric label="Ready to handoff" value={pipelineSummary.completed} helper="All stages completed" tone="success" />
            <PipelineMetric label="Needs summary" value={pipelineSummary.needsSummary} helper="Awaiting AI summary or QA" tone="warning" />
            <PipelineMetric label="Needs routing" value={pipelineSummary.needsRouting} helper="Assign owner or due date" tone="warning" />
          </CardContent>
          <CardContent className="border-t border-border/60 pt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {pipelineSummary.active.toLocaleString()} active · {pipelineSummary.archived.toLocaleString()} archived
              </span>
              <span>Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle className="text-sm font-semibold text-foreground">Document inventory</CardTitle>
            <CardDescription>Select an item to inspect its pipeline details.</CardDescription>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant={view === 'active' ? 'default' : 'outline'} onClick={() => setView('active')}>
                Active ({activeDocuments.length})
              </Button>
              <Button size="sm" variant={view === 'archived' ? 'default' : 'outline'} onClick={() => setView('archived')}>
                Archived ({archivedDocuments.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading documents…</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : visibleDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents in this view.</p>
            ) : (
              <DocumentList documents={visibleDocuments} selectedId={selectedId} onSelect={(doc) => setSelectedId(doc.document_id)} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {selectedDocument ? (
          <DocumentDetail document={selectedDocument} onEventQueued={handleEventQueued} />
        ) : (
          <Card className="shadow-none border-dashed border-border/70 bg-surface-subtle">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Select a document to inspect its pipeline journey.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PipelineMetric({
  label,
  value,
  helper,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  helper: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const palette: Record<'neutral' | 'success' | 'warning', string> = {
    neutral: 'border-border/60 bg-white',
    success: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
  };

  return (
    <div className={cn('rounded-2xl border px-4 py-3 shadow-[0_8px_20px_rgba(47,102,144,0.08)]', palette[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}
