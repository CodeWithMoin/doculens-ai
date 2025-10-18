import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleDashed, Loader2 } from 'lucide-react';

import { fetchDocuments } from '../api/client';
import type { DocumentEntry } from '../api/types';
import { DocumentDetail } from '../components/DocumentDetail';
import { DocumentList } from '../components/DocumentList';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { derivePipelineStages, type PipelineStage } from '../lib/pipeline';
import { inferStatus } from '../lib/routing';

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

  const timeline = useMemo<PipelineStage[]>(() => (selectedDocument ? derivePipelineStages(selectedDocument) : []), [selectedDocument]);

  const handleEventQueued = (eventType: string, documentId?: string) => {
    if (eventType === 'document_restored') {
      setView('active');
      loadDocuments(documentId, 'active');
      return;
    }
    loadDocuments(documentId);
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]">
      <div className="flex flex-col gap-6">
        <Card className="shadow-none">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle className="text-sm font-semibold text-foreground">Pipeline tracker</CardTitle>
            <CardDescription>Visualise each stage of the digitisation workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Select a document to see its progress through the pipeline.</p>
            ) : (
              timeline.map((stage) => <PipelineStep key={stage.id} stage={stage} />)
            )}
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

function PipelineStep({ stage }: { stage: PipelineStage }) {
  const icon =
    stage.state === 'complete' ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : stage.state === 'active' ? (
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
    ) : (
      <CircleDashed className="h-4 w-4 text-muted-foreground" />
    );

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-white px-4 py-3 text-sm">
      {icon}
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{stage.label}</span>
        <span className="text-xs text-muted-foreground">{stage.description}</span>
      </div>
    </div>
  );
}
