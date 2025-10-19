import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, Brain, CheckCircle2, CircleDashed, FileText, Loader2, MessageSquare, Trash2 } from 'lucide-react';

import {
  archiveDocument as archiveDocumentRequest,
  classifyDocument as classifyDocumentRequest,
  deleteDocument as deleteDocumentRequest,
  fetchClassificationHistory,
  fetchLabels,
  overrideClassification,
  postEvent,
  restoreDocument as restoreDocumentRequest,
} from '../api/client';
import type {
  ClassificationHistoryEntry,
  ClassificationScore,
  DocumentClassificationResponse,
  DocumentEntry,
  EventResponse,
  LabelTreeNode,
  LabelsResponse,
} from '../api/types';
import { cn } from '../lib/utils';
import { inferRole, inferStatus, inferDueDate, formatDateTime } from '../lib/routing';
import { derivePipelineStages } from '../lib/pipeline';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { useSettings } from '../settings/useSettings';
import { useNotificationStore } from '../stores/notificationStore';

interface DocumentDetailProps {
  document?: DocumentEntry;
  onEventQueued?: (eventType: string, documentId?: string) => void;
}

export function DocumentDetail({ document, onEventQueued }: DocumentDetailProps) {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [classification, setClassification] = useState<DocumentClassificationResponse | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [overrideLabel, setOverrideLabel] = useState('');
  const [overrideConfidence, setOverrideConfidence] = useState(1);
  const [overrideNotes, setOverrideNotes] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'archive' | 'delete' } | null>(null);
  const queryClient = useQueryClient();
  const { data: labelsData } = useQuery<LabelsResponse>({
    queryKey: ['labels'],
    queryFn: fetchLabels,
    staleTime: 5 * 60 * 1000,
  });
  const {
    data: historyData,
    isLoading: isHistoryLoading,
  } = useQuery<ClassificationHistoryEntry[]>({
    queryKey: ['classification-history', document?.document_id],
    queryFn: () => fetchClassificationHistory(document!.document_id),
    enabled: Boolean(document?.document_id),
  });
  const candidateLabels = useMemo(() => (labelsData?.candidate_labels ? [...labelsData.candidate_labels] : []), [labelsData]);
  const candidateLabelsKey = useMemo(() => candidateLabels.join('|'), [candidateLabels]);
  const labelDomainMap = useMemo(() => {
    if (!labelsData?.tree) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    const traverse = (node: LabelTreeNode, domainName?: string) => {
      const nextDomain = node.type === 'domain' ? node.name : domainName;
      if (node.type === 'label' && nextDomain) {
        map[node.name] = nextDomain;
      }
      node.children?.forEach((child) => traverse(child, nextDomain));
    };
    labelsData.tree.forEach((node) => traverse(node, node.type === 'domain' ? node.name : undefined));
    return map;
  }, [labelsData]);
  const latestHistory = historyData && historyData.length > 0 ? historyData[0] : undefined;
  const historyScores = useMemo<ClassificationScore[]>(() => {
    const raw = latestHistory?.metadata?.scores;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const label = String(record.label ?? record.name ?? '');
          const score = Number(record.score ?? 0);
          return { label, score } as ClassificationScore;
        }
        return null;
      })
      .filter((value): value is ClassificationScore => Boolean(value));
  }, [latestHistory]);
  const displayLabel = classification?.predicted_label ?? latestHistory?.label_name ?? '';
  const displayConfidence = classification?.confidence ?? latestHistory?.confidence ?? null;
  const displayScores = classification?.scores ?? historyScores;
  const displayDomain = displayLabel ? labelDomainMap[displayLabel] : undefined;
  const displaySource = classification ? 'AI inference' : latestHistory?.source ?? '';
  const displayReason = classification?.reasoning ??
    (typeof latestHistory?.metadata?.reasoning === 'string' ? latestHistory.metadata.reasoning : undefined);
  const usedTextPreview = classification?.used_text_preview ??
    (typeof latestHistory?.metadata?.preview === 'string' ? String(latestHistory.metadata.preview) : '');
  const addNotification = useNotificationStore((state) => state.addNotification);

  const pipelineStages = useMemo(() => (document ? derivePipelineStages(document) : []), [document]);
  const formatScore = (value: number) => `${Math.round(value * 100)}%`;
  const documentStatus = document ? inferStatus(document).toLowerCase() : '';
  const isArchived = documentStatus === 'archived';
  const isDeleted = documentStatus === 'deleted';

  useEffect(() => {
    setClassification(null);
    setClassificationError(null);
    setIsClassifying(false);
  }, [document?.document_id]);

  useEffect(() => {
    if (displayLabel) {
      setOverrideLabel(displayLabel);
    } else if (!overrideLabel && candidateLabels.length) {
      setOverrideLabel(candidateLabels[0]);
    }
  }, [displayLabel, candidateLabels, candidateLabelsKey, document?.document_id, overrideLabel]);

  useEffect(() => {
    if (typeof displayConfidence === 'number') {
      setOverrideConfidence(displayConfidence);
    }
  }, [displayConfidence, document?.document_id]);

  useEffect(() => {
    setOverrideNotes('');
  }, [document?.document_id]);

  useEffect(() => {
    setPendingAction(null);
  }, [document?.document_id]);

  const summaryItems = useMemo(() => {
    const summary = document?.summary;
    if (!summary) return null;
    return (
      <Card className="shadow-none">
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
          {summary.doc_type ? (
            <div className="grid gap-2 text-xs text-muted-foreground">
              <span>
                <strong className="font-medium text-foreground">Type:</strong> {summary.doc_type}
              </span>
            </div>
          ) : null}
          {summary.bullet_points?.length ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highlights</h4>
              <ul className="grid gap-2 text-sm text-muted-foreground">
                {summary.bullet_points.map((line, idx) => (
                  <li key={idx} className="rounded-lg border border-border/70 bg-surface-subtle px-3 py-2">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {summary.next_steps?.length ? (
            <div className="rounded-lg border border-border/70 bg-surface-subtle px-3 py-3">
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
      onEventQueued?.('document_summary', document.document_id);
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

  const runClassification = async () => {
    if (!document) return;
    setIsClassifying(true);
    setClassificationError(null);
    try {
      const response = await classifyDocumentRequest(document.document_id);
      setClassification(response);
      setOverrideLabel(response.predicted_label);
      setOverrideConfidence(response.confidence);
      setOverrideNotes('');
      await queryClient.invalidateQueries({ queryKey: ['classification-history', document.document_id] });
      onEventQueued?.('document_classification', document.document_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to classify document.';
      setClassificationError(message);
      setClassification(null);
    } finally {
      setIsClassifying(false);
    }
  };

  const performArchive = async () => {
    if (!document || isArchiving) return false;
    const name = document.filename ?? document.document_id;
    setIsArchiving(true);
    let success = false;
    try {
      await archiveDocumentRequest(document.document_id);
      setClassification(null);
      addNotification({
        title: 'Document archived',
        description: `${name} moved to the archive.`,
        variant: 'success',
      });
      onEventQueued?.('document_archived', document.document_id);
      success = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to archive document.';
      addNotification({ title: 'Archive failed', description: message, variant: 'error' });
    } finally {
      setIsArchiving(false);
    }
    return success;
  };

  const performDelete = async () => {
    if (!document || isDeleting) return false;
    const name = document.filename ?? document.document_id;
    setIsDeleting(true);
    let success = false;
    try {
      await deleteDocumentRequest(document.document_id);
      setClassification(null);
      addNotification({
        title: 'Document deleted',
        description: `${name} removed from the workspace.`,
        variant: 'success',
      });
      onEventQueued?.('document_deleted', document.document_id);
      success = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete document.';
      addNotification({ title: 'Delete failed', description: message, variant: 'error' });
    } finally {
      setIsDeleting(false);
    }
    return success;
  };

  const handleArchiveClick = () => {
    if (!document || isArchiving || isDeleted) return;
    setPendingAction({ type: 'archive' });
  };

  const handleDeleteClick = () => {
    if (!document || isDeleting || isDeleted) return;
    setPendingAction({ type: 'delete' });
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) {
      return;
    }
    let success = false;
    if (pendingAction.type === 'archive') {
      success = await performArchive();
    } else {
      success = await performDelete();
    }
    if (success) {
      setPendingAction(null);
    }
  };

  const handleCancelAction = () => {
    if (!pendingAction) {
      return;
    }
    const busy = pendingAction.type === 'archive' ? isArchiving : isDeleting;
    if (busy) {
      return;
    }
    setPendingAction(null);
  };

  const handleRestore = async () => {
    if (!document || isRestoring) return;
    const name = document.filename ?? document.document_id;
    setIsRestoring(true);
    try {
      await restoreDocumentRequest(document.document_id);
      setClassification(null);
      addNotification({
        title: 'Document restored',
        description: `${name} moved back to processing.`,
        variant: 'success',
      });
      onEventQueued?.('document_restored', document.document_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restore document.';
      addNotification({ title: 'Restore failed', description: message, variant: 'error' });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleOverride = async () => {
    if (!document || !overrideLabel) return;
    setIsOverriding(true);
    try {
      const entry = await overrideClassification(document.document_id, {
        label_name: overrideLabel,
        confidence: overrideConfidence,
        notes: overrideNotes || undefined,
      });
      const metadataReason =
        typeof (entry.metadata as { reasoning?: unknown })?.reasoning === 'string'
          ? ((entry.metadata as { reasoning?: string }).reasoning as string)
          : undefined;
      setClassification({
        document_id: document.document_id,
        predicted_label: entry.label_name,
        confidence: entry.confidence ?? overrideConfidence,
        scores: [
          {
            label: entry.label_name,
            score: entry.confidence ?? overrideConfidence,
          },
        ],
        candidate_labels: candidateLabels.length ? candidateLabels : [entry.label_name],
        used_text_preview: classification?.used_text_preview ?? '',
        reasoning: metadataReason ?? classification?.reasoning,
      });
      setOverrideNotes('');
      await queryClient.invalidateQueries({ queryKey: ['classification-history', document.document_id] });
      onEventQueued?.('document_classification_override', document.document_id);
      addNotification({
        title: 'Classification updated',
        description: `${entry.label_name} saved for ${document.filename ?? document.document_id}.`,
        variant: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save classification override.';
      addNotification({ title: 'Override failed', description: message, variant: 'error' });
    } finally {
      setIsOverriding(false);
    }
  };

  if (!document) {
    return (
      <Card className="shadow-none border-dashed border-border/70 bg-surface-subtle">
        <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p>Select a document to view intelligence and QA tools.</p>
        </CardContent>
      </Card>
    );
  }

  const documentTitle = document.summary?.filename ?? document.filename ?? document.document_id;
  const assignedRole = inferRole(document);
  const status = inferStatus(document);
  const dueAt = formatDateTime(inferDueDate(document));
  const uploadedAt = formatDateTime(document.uploaded_at);
  const confirmConfig = pendingAction
    ? pendingAction.type === 'archive'
      ? {
          title: 'Archive document',
          description: `Archive "${documentTitle}"? This hides the document from active queues, but you can restore it later.`,
          confirmLabel: 'Archive',
        }
      : {
          title: 'Delete document',
          description: `Delete "${documentTitle}"? This removes the document from Doculens for everyone and cannot be undone.`,
          confirmLabel: 'Delete',
        }
    : null;
  const isConfirmBusy = pendingAction
    ? pendingAction.type === 'archive'
      ? isArchiving
      : isDeleting
    : false;

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {document.doc_type ?? 'untyped'}
            </Badge>
            <span>Document #{document.document_id}</span>
            <span>Uploaded {uploadedAt}</span>
          </div>
          <div className="space-y-3">
            <CardTitle className="text-2xl font-semibold leading-tight text-foreground">{documentTitle}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Role: {assignedRole}</span>
              <span>Status: {status}</span>
              <span>Due: {dueAt}</span>
            </CardDescription>
            {document.summary?.doc_type ? (
              <dl className="flex flex-wrap gap-4 text-xs text-muted-foreground/90">
                <div>
                  <dt className="font-medium text-foreground/80">Summary tag</dt>
                  <dd>{document.summary.doc_type}</dd>
                </div>
              </dl>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 sm:justify-start">
              <Button
                onClick={reissueSummary}
                disabled={isSubmitting || isArchived || isDeleted}
                variant="accent"
                className="gap-2"
              >
                <Brain className={cn('h-4 w-4', isSubmitting ? 'animate-spin' : '')} />
                Summarise again
              </Button>
              <Button
                onClick={() => document && navigate(`/qa?document=${document.document_id}`)}
                variant="outline"
                className="gap-2 text-sm"
              >
                <MessageSquare className="h-4 w-4" />
                Open in QA Studio
              </Button>
              <Button
                onClick={runClassification}
                variant="outline"
                className="text-sm"
                disabled={isClassifying || (labelsData && candidateLabels.length === 0) || isArchived || isDeleted}
              >
                {isClassifying ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Classifying…
                  </span>
                ) : (
                  'Classify document'
                )}
              </Button>
              {isArchived ? (
                <Button
                  onClick={handleRestore}
                  variant="outline"
                  className="text-sm"
                  disabled={isRestoring}
                >
                  {isRestoring ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Restoring…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Archive className="h-4 w-4" />
                      Restore
                    </span>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleArchiveClick}
                  variant="outline"
                  className="text-sm"
                  disabled={isArchiving || isDeleted}
                >
                  {isArchiving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Archiving…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Archive className="h-4 w-4" />
                      Archive
                    </span>
                  )}
                </Button>
              )}
              <Button
                onClick={handleDeleteClick}
                variant="destructive"
                className="text-sm"
                disabled={isDeleting || isDeleted}
              >
                {isDeleting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {pendingAction && confirmConfig ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-5 w-5 text-amber-500" />
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">{confirmConfig.title}</h3>
                <p className="text-sm text-muted-foreground">{confirmConfig.description}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelAction} disabled={isConfirmBusy}>
                Cancel
              </Button>
              <Button
                variant={pendingAction.type === 'delete' ? 'destructive' : 'accent'}
                onClick={handleConfirmAction}
                disabled={isConfirmBusy}
              >
                {isConfirmBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {pendingAction.type === 'delete' ? 'Deleting…' : 'Archiving…'}
                  </span>
                ) : (
                  confirmConfig.confirmLabel
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isArchived ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-100/40 px-4 py-3 text-sm text-amber-800">
          <Archive className="h-4 w-4" />
          <span>This document is archived. Restore it to resume processing.</span>
        </div>
      ) : null}

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

      {classificationError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{classificationError}</span>
        </div>
      ) : null}

      {isClassifying ? (
        <Card className="border-dashed border-border/60 bg-muted/20">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle className="text-sm font-semibold text-foreground">Classifying document</CardTitle>
            <CardDescription>Evaluating the document against the configured label set.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Generating label suggestion…
          </CardContent>
        </Card>
      ) : null}

      {displayLabel ? (
        <Card className="shadow-none">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle className="text-sm font-semibold text-foreground">Document classification</CardTitle>
            <CardDescription>
              {displaySource ? `Latest label generated by ${displaySource}.` : 'Predicted label for this document.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="accent" className="text-xs uppercase tracking-wide">
                {displayLabel}
              </Badge>
              {displayDomain ? (
                <Badge variant="outline" className="text-xs uppercase tracking-wide text-muted-foreground">
                  {displayDomain}
                </Badge>
              ) : null}
              {displayConfidence !== null ? (
                <span className="text-xs text-muted-foreground">Confidence {formatScore(displayConfidence)}</span>
              ) : null}
            </div>
            {displayReason ? (
              <p className="text-xs text-muted-foreground">{displayReason}</p>
            ) : null}

            {displayScores.length ? (
              <div className="space-y-2 text-xs text-muted-foreground">
                {displayScores.slice(0, 5).map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/10 px-3 py-2">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span>{formatScore(item.score)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {usedTextPreview ? (
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Preview of analysed text</p>
                <p className="rounded-md border border-border/60 bg-muted/10 p-3 text-left">
                  {usedTextPreview}
                </p>
              </div>
            ) : null}

            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Override classification</p>
              {candidateLabels.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Label</span>
                    <select
                      className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                      value={overrideLabel}
                      onChange={(event) => setOverrideLabel(event.target.value)}
                    >
                      {candidateLabels.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Confidence</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={overrideConfidence}
                      onChange={(event) => setOverrideConfidence(Number(event.target.value))}
                      className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                    />
                  </label>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No available labels. Add labels in Settings to enable overrides.</p>
              )}
              <div className="space-y-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Notes (optional)</span>
                <Textarea
                  rows={2}
                  value={overrideNotes}
                  onChange={(event) => setOverrideNotes(event.target.value)}
                  placeholder="Add context for this override…"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="accent"
                  size="sm"
                  className="gap-2"
                  onClick={handleOverride}
                  disabled={!overrideLabel || isOverriding || candidateLabels.length === 0}
                >
                  {isOverriding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isOverriding ? 'Saving…' : 'Save override'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Classification history</p>
              {isHistoryLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading history…
                </div>
              ) : historyData && historyData.length ? (
                <div className="space-y-2 text-xs text-muted-foreground">
                  {historyData.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/5 px-3 py-2">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground">{entry.label_name}</span>
                        {labelDomainMap[entry.label_name] ? (
                          <span className="block text-[11px] uppercase tracking-wide text-muted-foreground/80">
                            {labelDomainMap[entry.label_name]}
                          </span>
                        ) : null}
                        <span className="block text-[11px] text-muted-foreground/70">Source: {entry.source}</span>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground">
                        {typeof entry.confidence === 'number' ? <span className="block font-semibold text-foreground">{formatScore(entry.confidence)}</span> : null}
                        <span>{formatDateTime(entry.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No historical classifications yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summaryItems ? (
        <>
          {summaryItems}
          <ProcessingTimeline stages={pipelineStages} />
        </>
      ) : (
        <>
          <ProcessingTimeline stages={pipelineStages} />
          <Card className="border-dashed border-primary/40 bg-primary/5 shadow-none">
            <CardHeader className="flex flex-col gap-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-primary">
                <FileText className="h-5 w-5" />
                No summary yet
              </CardTitle>
              <CardDescription className="text-sm text-primary/80">
                Generate a summary to see key highlights and recommended next steps right here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Summaries help reviewers get context before diving into stage progress.</span>
              <Button onClick={reissueSummary} disabled={isSubmitting || isArchived || isDeleted} className="gap-2">
                <Brain className={cn('h-4 w-4', isSubmitting ? 'animate-spin' : '')} />
                Generate summary
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ProcessingTimeline({ stages }: { stages: ReturnType<typeof derivePipelineStages> }) {
  if (!stages.length) return null;
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="text-sm font-semibold text-foreground">Processing status</CardTitle>
        <CardDescription>Where this document is in the digitisation journey.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.id} className="flex items-center gap-3 rounded-lg border border-platinum-600 bg-white px-3 py-2 text-sm">
            {stage.state === 'complete' ? (
              <CheckCircle2 className="h-4 w-4 text-sky-blue-500" />
            ) : stage.state === 'active' ? (
              <Loader2 className="h-4 w-4 animate-spin text-lapis-500" />
            ) : (
              <CircleDashed className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{stage.label}</span>
              <span className="text-xs text-muted-foreground">{stage.description}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
