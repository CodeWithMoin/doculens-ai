import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, FileText, Files, History, Loader2, RefreshCw, Search, Send, Sparkles, User, X } from 'lucide-react';

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
  const { settings, serverConfig } = useSettings();
  const isShowcaseReadOnly = Boolean(serverConfig?.showcase_read_only);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [searchParams, setSearchParams] = useSearchParams();

  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentFilter, setDocumentFilter] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);

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
        const message = err instanceof Error ? err.message : 'Failed to load answer history';
        setHistoryError(message);
        addNotification({ title: 'Answer history unavailable', description: message, variant: 'error' });
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
    setIsDocumentPanelOpen(false);
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
    if (isShowcaseReadOnly) return;
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
        title: 'Question queued',
        description: `${selectedDocument.filename ?? selectedDocument.document_id} · ${statusMessage}`,
        variant: 'success',
        href: `/app/qa?document=${selectedDocument.document_id}`,
      });
      loadQaHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to ask this question.';
      setComposerError(message);
      addNotification({ title: 'Question failed', description: message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('grid min-h-0 gap-4', isDocumentPanelOpen && 'lg:grid-cols-[290px,minmax(0,1fr)]', isHistoryPanelOpen && 'lg:grid-cols-[minmax(0,1fr),290px]')}>
      {isDocumentPanelOpen ? (
        <Card className="flex min-h-[560px] flex-col overflow-hidden border border-border/60 bg-card shadow-sm lg:h-[calc(100dvh-12.25rem)] lg:max-h-[620px]">
          <CardHeader className="gap-4 border-b border-border/60 bg-surface-subtle/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><CardTitle className="text-base">Sources</CardTitle><CardDescription className="mt-1 text-xs">Choose what grounds the answer.</CardDescription></div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsDocumentPanelOpen(false)} aria-label="Close sources"><X className="h-4 w-4" /></Button>
            </div>
            <select value={selectedDomain} onChange={(event) => setSelectedDomain(event.target.value)} aria-label="Filter sources by domain" className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs font-medium text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
              {domainOptions.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
            </select>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={documentFilter} onChange={(event) => setDocumentFilter(event.target.value)} placeholder="Search sources…" aria-label="Search sources" className="h-9 rounded-lg bg-background pl-8 text-xs" /></div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-3">
            {isLoadingDocuments ? <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading sources…</div> : documentsError ? <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{documentsError}</div> : !filteredDocuments.length ? <div className="rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">No sources match your filter.</div> : (
              <div className="space-y-1.5">{filteredDocuments.map((doc) => {
                const isActive = doc.document_id === selectedDocumentId;
                return <button key={doc.document_id} type="button" onClick={() => handleSelectDocument(doc.document_id)} className={cn('flex w-full items-center gap-3 rounded-xl border px-2.5 py-2.5 text-left transition', isActive ? 'border-primary/35 bg-primary/10 ring-1 ring-primary/20' : 'border-transparent hover:border-border/60 hover:bg-muted/50')}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background text-primary shadow-sm"><FileText className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{doc.filename ?? doc.document_id}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{doc.doc_type ?? inferRole(doc)} · {inferStatus(doc)}</span></span>
                </button>;
              })}</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="flex min-h-[560px] flex-col overflow-hidden border border-border/60 bg-card shadow-lg shadow-primary/5 lg:h-[calc(100dvh-12.25rem)] lg:max-h-[620px]">
        <CardHeader className="gap-3 border-b border-border/60 bg-surface-subtle/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => { setIsDocumentPanelOpen(!isDocumentPanelOpen); setIsHistoryPanelOpen(false); }} aria-expanded={isDocumentPanelOpen} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2 text-left transition hover:border-primary/35">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Active source</span><span className="block max-w-[420px] truncate text-xs font-semibold">{selectedDocument ? selectedDocument.filename ?? selectedDocument.document_id : 'Select a document'}</span></span>
              {selectedDocument ? <Badge variant="outline" className="hidden shrink-0 text-[9px] sm:inline-flex">{inferRole(selectedDocument)}</Badge> : null}
            </button>
            <div className="flex items-center gap-1.5">
              <Button variant={isDocumentPanelOpen ? 'secondary' : 'ghost'} size="sm" className="gap-2" onClick={() => { setIsDocumentPanelOpen(!isDocumentPanelOpen); setIsHistoryPanelOpen(false); }}><Files className="h-4 w-4" />Sources <span className="text-[10px] text-muted-foreground">{documents.length}</span></Button>
              <Button variant={isHistoryPanelOpen ? 'secondary' : 'ghost'} size="sm" className="gap-2" onClick={() => { setIsHistoryPanelOpen(!isHistoryPanelOpen); setIsDocumentPanelOpen(false); }}><History className="h-4 w-4" />History <span className="text-[10px] text-muted-foreground">{documentHistory.length}</span></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={loadQaHistory} disabled={isLoadingHistory} aria-label="Refresh answers" title="Refresh answers">{isLoadingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
            </div>
          </div>
          {historyError ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{historyError}</div> : null}
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:px-8">
            <div className="mx-auto w-full max-w-[820px] space-y-5">
              {!selectedDocument ? <EmptyState message="Choose a source to explore its grounded answer." /> : !chatMessages.length ? <EmptyState message={isShowcaseReadOnly ? 'This source has no curated showcase answer yet.' : 'Ask your first question about this document.'} /> : chatMessages.map((message) => <ChatMessageBubble key={message.id} {...message} />)}
            </div>
          </div>
          <form onSubmit={handleSend} className="shrink-0 border-t border-border/60 bg-background/90 p-3 backdrop-blur lg:px-6 lg:py-4">
            <div className="mx-auto w-full max-w-[860px] rounded-2xl border border-border/70 bg-card p-2 shadow-sm transition focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
              <Textarea value={composerText} onChange={(event) => setComposerText(event.target.value)} placeholder={isShowcaseReadOnly ? 'Live questions are disabled in the public showcase.' : selectedDocument ? `Ask about ${selectedDocument.filename ?? selectedDocument.document_id}…` : 'Choose a source first'} rows={2} disabled={isShowcaseReadOnly || !selectedDocument || isSubmitting} className="min-h-[58px] resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              <div className="flex items-end justify-between gap-3 px-1 pb-1 text-[11px]">
                <div className="min-w-0 text-muted-foreground">{isShowcaseReadOnly ? <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-primary" />Curated answer · citations enabled</span> : composerError ? <span className="text-destructive">{composerError}</span> : composerStatus ? <span>{composerStatus}</span> : <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-primary" />Grounded answers with citations</span>}</div>
                {!isShowcaseReadOnly ? <Button type="submit" disabled={!selectedDocument || isSubmitting} size="sm" className="shrink-0 gap-2 rounded-xl px-4">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{isSubmitting ? 'Sending…' : 'Ask'}</Button> : <Badge variant="outline" className="shrink-0 rounded-full text-[9px] uppercase tracking-[0.12em]">Read only</Badge>}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {isHistoryPanelOpen ? (
        <Card className="flex min-h-[560px] flex-col overflow-hidden border border-border/60 bg-card shadow-sm lg:h-[calc(100dvh-12.25rem)] lg:max-h-[620px]">
          <CardHeader className="gap-2 border-b border-border/60 bg-surface-subtle/60 p-4">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CardTitle className="text-base">History</CardTitle><Badge variant="outline" className="text-[9px]">{documentHistory.length}</Badge></div><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsHistoryPanelOpen(false)} aria-label="Close history"><X className="h-4 w-4" /></Button></div>
            <CardDescription className="text-xs">Reuse a previous question as a follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-3">
            {!selectedDocument ? <div className="rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">Choose a source to view its history.</div> : !documentHistory.length ? <div className="rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">No answers recorded for this source yet.</div> : <div className="space-y-2">{documentHistory.slice().reverse().map((entry) => <button key={entry.event_id} type="button" onClick={() => { setComposerText(`Follow up on: ${entry.query}`); setIsHistoryPanelOpen(false); }} className="w-full rounded-xl border border-transparent bg-muted/30 p-3 text-left transition hover:border-border/60 hover:bg-muted/50"><div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{formatDateTime(entry.created_at)}</span>{typeof entry.confidence === 'number' ? <span>{Math.round(entry.confidence * 100)}%</span> : null}</div><p className="mt-2 line-clamp-3 text-xs font-semibold leading-5">{entry.query}</p>{entry.answer ? <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{entry.answer}</p> : <p className="mt-1.5 text-[11px] text-amber-600">Answer pending…</p>}</button>)}</div>}
          </CardContent>
        </Card>
      ) : null}
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
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
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
          isUser ? 'bg-primary text-primary-foreground' : 'border border-border/70 bg-surface-subtle',
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
