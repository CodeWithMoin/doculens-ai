import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, FileText, Loader2, RefreshCw, Search, Send, Sparkles, User } from 'lucide-react';

import { fetchDocuments, fetchQaHistory, postEvent } from '../api/client';
import type { DocumentEntry, QAHistoryEntry } from '../api/types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../lib/utils';
import { formatDateTime, inferRole, inferStatus } from '../lib/routing';
import { useSettings } from '../settings/useSettings';
import { useNotificationStore } from '../stores/notificationStore';

const HISTORY_LIMIT = 50;

interface PendingQuestion {
  eventId: string;
  documentId: string;
  query: string;
  createdAt: string;
}

export function QaPage() {
  const { settings } = useSettings();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [searchParams, setSearchParams] = useSearchParams();

  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentFilter, setDocumentFilter] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('All');

  const [qaEntries, setQaEntries] = useState<QAHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [composerText, setComposerText] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerStatus, setComposerStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsLoadingDocuments(true);
    setDocumentsError(null);
    fetchDocuments(150)
      .then((items) => {
        const filtered = items.filter((doc) => inferStatus(doc).toLowerCase() !== 'deleted');
        setDocuments(filtered);
        if (!filtered.length) {
          setSelectedDocumentId(null);
          return;
        }
        const paramDoc = searchParams.get('document');
        if (paramDoc && filtered.some((doc) => doc.document_id === paramDoc)) {
          setSelectedDocumentId(paramDoc);
        } else {
          setSelectedDocumentId((prev) => prev ?? filtered[0].document_id);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load documents';
        setDocumentsError(message);
        addNotification({ title: 'Document load failed', description: message, variant: 'error' });
      })
      .finally(() => setIsLoadingDocuments(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const paramDoc = searchParams.get('document');
    if (paramDoc && documents.some((doc) => doc.document_id === paramDoc)) {
      setSelectedDocumentId(paramDoc);
    }
  }, [searchParams, documents]);

  const loadQaHistory = useCallback(() => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    fetchQaHistory(HISTORY_LIMIT)
      .then((entries) => {
        setQaEntries(entries);
        setPendingQuestions((previous) =>
          previous.filter((pending) => !entries.some((entry) => entry.event_id === pending.eventId && entry.answer)),
        );
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load QA history';
        setHistoryError(message);
        addNotification({ title: 'QA history error', description: message, variant: 'error' });
      })
      .finally(() => setIsLoadingHistory(false));
  }, [addNotification]);

  useEffect(() => {
    loadQaHistory();
  }, [loadQaHistory]);

  const domainOptions = useMemo(() => {
    const roles = new Set<string>();
    documents.forEach((doc) => roles.add(inferRole(doc)));
    return ['All', ...Array.from(roles)];
  }, [documents]);

  useEffect(() => {
    if (selectedDomain !== 'All' && !domainOptions.includes(selectedDomain)) {
      setSelectedDomain('All');
    }
  }, [domainOptions, selectedDomain]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.document_id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const handleSelectDocument = (documentId: string) => {
    setSelectedDocumentId(documentId);
    const params = new URLSearchParams(searchParams);
    params.set('document', documentId);
    setSearchParams(params, { replace: true });
  };

  const filteredDocuments = useMemo(() => {
    const trimmed = documentFilter.trim().toLowerCase();
    return documents.filter((doc) => {
      if (selectedDomain !== 'All' && inferRole(doc) !== selectedDomain) {
        return false;
      }
      if (!trimmed) return true;
      const haystack = [doc.filename, doc.doc_type, doc.document_id].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [documents, documentFilter, selectedDomain]);

  const documentHistory = useMemo(() => {
    if (!selectedDocument) return [] as QAHistoryEntry[];
    return qaEntries
      .filter((entry) =>
        entry.chunk_references?.some((ref) => {
          if (ref.document_id && ref.document_id === selectedDocument.document_id) return true;
          if (ref.filename && selectedDocument.filename) {
            return ref.filename === selectedDocument.filename;
          }
          return false;
        }),
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [qaEntries, selectedDocument]);

  const chatMessages = useMemo(() => {
    if (!selectedDocument) return [] as ChatMessage[];
    const docId = selectedDocument.document_id;

    const historyMessages: ChatMessage[] = [];
    documentHistory.forEach((entry) => {
      historyMessages.push({
        id: `${entry.event_id}-user`,
        role: 'user',
        content: entry.query,
        timestamp: entry.created_at,
      });
      historyMessages.push({
        id: `${entry.event_id}-assistant`,
        role: 'assistant',
        content: entry.answer ?? '',
        timestamp: entry.created_at,
        pending: !entry.answer,
        confidence: entry.confidence ?? undefined,
        citations: entry.citations,
        reasoning: entry.reasoning ?? undefined,
      });
    });

    const relevantPending = pendingQuestions.filter((pending) => pending.documentId === docId);
    const knownHistoryIds = new Set(qaEntries.map((entry) => entry.event_id));

    const pendingMessages: ChatMessage[] = relevantPending
      .filter((pending) => !knownHistoryIds.has(pending.eventId))
      .map((pending) => ({
        id: `${pending.eventId}-pending-user`,
        role: 'user',
        content: pending.query,
        timestamp: pending.createdAt,
        pending: true,
      }));

    const pendingAssistant: ChatMessage[] = relevantPending
      .filter((pending) => !knownHistoryIds.has(pending.eventId))
      .map((pending) => ({
        id: `${pending.eventId}-pending-assistant`,
        role: 'assistant',
        content: '',
        timestamp: new Date(new Date(pending.createdAt).getTime() + 1).toISOString(),
        pending: true,
      }));

    return [...historyMessages, ...pendingMessages, ...pendingAssistant].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [documentHistory, pendingQuestions, qaEntries, selectedDocument]);

  const hasUnresolvedHistory = useMemo(() => qaEntries.some((entry) => !entry.answer), [qaEntries]);

  useEffect(() => {
    if (!pendingQuestions.length && !hasUnresolvedHistory) {
      return;
    }
    const interval = window.setInterval(() => {
      loadQaHistory();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [hasUnresolvedHistory, loadQaHistory, pendingQuestions.length]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [chatMessages.length, selectedDocument?.document_id]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDocument) {
      setComposerError('Select a document before asking a question.');
      return;
    }
    const trimmed = composerText.trim();
    if (!trimmed) {
      setComposerError('Enter a question before sending.');
      return;
    }

    setComposerError(null);
    setIsSubmitting(true);
    setComposerStatus(null);
    try {
      const response = await postEvent({
        event_type: 'qa_query',
        query: trimmed,
        filters: { document_id: selectedDocument.document_id },
        top_k: settings.qaTopK,
      });
      setPendingQuestions((previous) => [
        ...previous,
        {
          eventId: response.event_id,
          documentId: selectedDocument.document_id,
          query: trimmed,
          createdAt: new Date().toISOString(),
        },
      ]);
      setComposerText('');
      const statusMessage = `Question queued. Event ${response.event_id}.`;
      setComposerStatus(statusMessage);
      addNotification({
        title: 'QA task queued',
        description: `${selectedDocument.filename ?? selectedDocument.document_id} · ${statusMessage}`,
        variant: 'success',
        href: `/qa?document=${selectedDocument.document_id}`,
      });
      loadQaHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'QA request failed.';
      setComposerError(message);
      addNotification({ title: 'QA request failed', description: message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid flex-1 min-h-0 gap-6 md:grid-cols-[260px,minmax(0,1fr),280px] md:grid-rows-[1fr] lg:grid-cols-[280px,minmax(0,1fr),300px] xl:grid-cols-[300px,minmax(0,1fr),320px]">
      <Card className="flex flex-col overflow-hidden border border-border/60 bg-white/95 shadow-sm md:h-full">
        <CardHeader className="gap-5 border-b border-border/60 bg-white/70 p-5">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg font-semibold text-foreground">Documents</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Pick a source file to anchor the conversation.
            </CardDescription>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Domain</span>
              <select
                value={selectedDomain}
                onChange={(event) => setSelectedDomain(event.target.value)}
                className="h-10 w-full rounded-lg border border-border/60 bg-muted/40 px-3 text-sm font-medium text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {domainOptions.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={documentFilter}
                onChange={(event) => setDocumentFilter(event.target.value)}
                placeholder="Search documents…"
                aria-label="Search documents"
                className="h-11 rounded-lg border border-border/60 bg-muted/40 pl-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
          {isLoadingDocuments ? (
            <div className="flex h-full items-center justify-center gap-2 px-6 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
            </div>
          ) : documentsError ? (
            <div className="m-5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
              {documentsError}
            </div>
          ) : !filteredDocuments.length ? (
            <div className="m-5 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-sm text-muted-foreground">
              No documents match your filter.
            </div>
          ) : (
            <div className="flex h-full flex-col px-5 pb-5 pt-4">
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {filteredDocuments.map((doc) => {
                    const isActive = doc.document_id === selectedDocumentId;
                    const role = inferRole(doc);
                    const status = inferStatus(doc);
                    const uploadedLabel = doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—';
                    return (
                      <button
                        key={doc.document_id}
                        type="button"
                        onClick={() => handleSelectDocument(doc.document_id)}
                        className={cn(
                          'w-full rounded-2xl border px-3 py-3 text-left transition-colors',
                          isActive
                            ? 'border-primary/40 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30'
                            : 'border-transparent bg-muted/30 text-foreground hover:border-border/50 hover:bg-muted/50',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-sm font-semibold leading-tight text-fade-right pr-4">
                              {doc.filename ?? doc.document_id}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {doc.doc_type ?? `Role ${role}`} · {status}
                            </span>
                            <span className="text-xs text-muted-foreground">Uploaded {uploadedLabel}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="flex flex-col overflow-hidden border border-border/60 bg-white/95 shadow-lg shadow-primary/5 md:h-full">
        <CardHeader className="flex flex-col gap-4 border-b border-border/60 bg-white/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Sparkles className="h-5 w-5 text-primary" /> QA Studio
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Conversational RAG grounded in {selectedDocument ? selectedDocument.filename ?? selectedDocument.document_id : 'your documents'}.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadQaHistory}
              disabled={isLoadingHistory}
              className="gap-2 rounded-full border-border/60 bg-white/80"
            >
              {isLoadingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
          {selectedDocument ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Document:</span>
              <span>{selectedDocument.filename ?? selectedDocument.document_id}</span>
              <span>{inferRole(selectedDocument)}</span>
              <span>{inferStatus(selectedDocument)}</span>
              <span>Uploaded {formatDateTime(selectedDocument.uploaded_at)}</span>
            </div>
          ) : null}
          {historyError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{historyError}</div>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4 overflow-hidden p-0">
          <div ref={messagesContainerRef} className="h-[700px] space-y-4 overflow-y-auto px-6 py-4">
            {!selectedDocument ? (
              <EmptyState message="Select a document from the left to start a conversation." />
            ) : !chatMessages.length ? (
              <EmptyState message="Ask your first question about this document." />
            ) : (
              chatMessages.map((message) => <ChatMessageBubble key={message.id} {...message} />)
            )}
          </div>
          <form onSubmit={handleSend} className="border-t border-border/60 bg-background/90 px-6 py-4 backdrop-blur">
            <div className="space-y-3">
              <Textarea
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                placeholder={
                  selectedDocument ? `Ask something about ${selectedDocument.filename ?? selectedDocument.document_id}…` : 'Select a document first'
                }
                rows={3}
                disabled={!selectedDocument || isSubmitting}
                className="resize-none rounded-2xl border-border/60 bg-background/60"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Bot className="h-4 w-4" />
                  <span>Answers use retrieval grounded in the selected document.</span>
                </div>
                <div className="flex items-center gap-3">
                  {composerStatus ? <span className="text-muted-foreground">{composerStatus}</span> : null}
                  {composerError ? <span className="text-destructive">{composerError}</span> : null}
                  <Button type="submit" disabled={!selectedDocument || isSubmitting} className="gap-2 rounded-full px-5">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isSubmitting ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="flex flex-col overflow-hidden border border-border/60 bg-white/95 shadow-sm md:h-full">
        <CardHeader className="gap-4 border-b border-border/60 bg-white/70 p-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">History</CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {documentHistory.length} / {qaEntries.length}
            </Badge>
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Previously answered questions for this document.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
          {!selectedDocument ? (
            <div className="m-5 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-sm text-muted-foreground">
              Pick a document to view its history.
            </div>
          ) : !documentHistory.length ? (
            <div className="m-5 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-sm text-muted-foreground">
              No answers recorded yet for this document.
            </div>
          ) : (
            <div className="flex h-full flex-col px-5 pb-5 pt-4">
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {documentHistory
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <button
                        key={entry.event_id}
                        type="button"
                        onClick={() => setComposerText(`Follow up on event ${entry.event_id}: ${entry.query}`)}
                        className="w-full rounded-2xl border border-transparent bg-muted/30 px-3 py-3 text-left transition-colors hover:border-border/50 hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>{formatDateTime(entry.created_at)}</span>
                          {typeof entry.confidence === 'number' ? <span>Confidence {Math.round(entry.confidence * 100)}%</span> : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">{entry.query}</p>
                        {entry.answer ? (
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{entry.answer}</p>
                        ) : (
                          <p className="mt-2 text-xs text-amber-600">Answer pending…</p>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  pending?: boolean;
  confidence?: number;
  citations?: string[];
  reasoning?: string;
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm">
        <FileText className="h-7 w-7" />
      </span>
      <p className="max-w-[220px] leading-relaxed">{message}</p>
    </div>
  );
}

function ChatMessageBubble({ role, content, timestamp, pending, confidence, citations, reasoning }: ChatMessage) {
  const isUser = role === 'user';
  const timeLabel = formatDateTime(timestamp);
  const statusLabel = pending ? (isUser ? 'Asked' : 'Answering') : isUser ? 'Asked' : 'Answered';

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? (
        <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </span>
      ) : null}
      <div
        className={cn(
          'max-w-[580px] rounded-2xl px-4 py-3 shadow-sm transition',
          isUser ? 'bg-primary text-primary-foreground' : 'border border-border/70 bg-white',
        )}
      >
        {pending && !isUser && !content ? <TypingIndicator /> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>}
        <div className={cn('mt-3 flex flex-wrap items-center gap-3 text-[11px]', isUser ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          <span>{statusLabel} {timeLabel}</span>
          {pending ? (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                isUser ? 'text-amber-300' : 'text-primary',
              )}
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              {isUser ? 'Queued for processing…' : 'Generating answer…'}
            </span>
          ) : null}
          {!isUser && typeof confidence === 'number' ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <Sparkles className="h-3 w-3" /> Confidence {Math.round(confidence * 100)}%
            </span>
          ) : null}
        </div>
        {!isUser && !pending && reasoning ? (
          <p className="mt-2 text-xs text-muted-foreground">{reasoning}</p>
        ) : null}
        {!isUser && !pending && citations && citations.length ? (
          <div className="mt-3 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Citations</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {citations.map((citation, index) => (
                <li key={`${citation}-${index}`} className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-1.5">
                  {citation}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {isUser ? (
        <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2.5 w-2.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-muted-foreground/80"
          style={{ animationDelay: `${index * 0.2}s` }}
        />
      ))}
    </div>
  );
}
