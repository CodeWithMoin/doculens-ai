import { type ComponentType, type FormEvent, useEffect, useState } from 'react';
import { AlertCircle, BookOpen, CornerDownRight, History, Loader2, RefreshCw, Search as SearchIcon, Sparkles } from 'lucide-react';

import { fetchQaHistory, fetchSearchHistory, postEvent } from '../api/client';
import type { QAHistoryEntry, SearchHistoryEntry } from '../api/types';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useSettings } from '../settings/SettingsProvider';
import { useNotificationStore } from '../stores/notificationStore';

const HISTORY_LIMIT = 50;

export function QaPage() {
  const { settings } = useSettings();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [qaEntries, setQaEntries] = useState<QAHistoryEntry[]>([]);
  const [searchEntries, setSearchEntries] = useState<SearchHistoryEntry[]>([]);

  const [qaError, setQaError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [qaSubmissionError, setQaSubmissionError] = useState<string | null>(null);

  const [isLoadingQa, setIsLoadingQa] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isSubmittingSearch, setIsSubmittingSearch] = useState(false);
  const [isSubmittingQa, setIsSubmittingQa] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState('');
  const [searchLimit, setSearchLimit] = useState(settings.searchResultLimit);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [qaSubmissionStatus, setQaSubmissionStatus] = useState<string | null>(null);
  const [globalQaQuestion, setGlobalQaQuestion] = useState('');
  const [globalQaFilters, setGlobalQaFilters] = useState('');

  useEffect(() => {
    setSearchLimit(settings.searchResultLimit);
  }, [settings.searchResultLimit]);

  const parseFiltersInput = (
    raw: string,
    setErrorFn: (message: string | null) => void,
  ): Record<string, unknown> | undefined | null => {
    if (!raw.trim()) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Filters must be a JSON object.');
      }
      setErrorFn(null);
      return parsed as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Filters must be valid JSON.';
      setErrorFn(message);
      return null;
    }
  };

  const loadQaHistory = () => {
    setIsLoadingQa(true);
    setQaError(null);
    fetchQaHistory(HISTORY_LIMIT)
      .then(setQaEntries)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load QA history';
        setQaError(message);
        addNotification({ title: 'QA history error', description: message, variant: 'error' });
      })
      .finally(() => setIsLoadingQa(false));
  };

  const loadSearchHistory = () => {
    setIsLoadingSearch(true);
    setSearchError(null);
    fetchSearchHistory(HISTORY_LIMIT)
      .then(setSearchEntries)
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Failed to load search history';
        setSearchError(message);
        addNotification({ title: 'Search history error', description: message, variant: 'error' });
      })
      .finally(() => setIsLoadingSearch(false));
  };

  useEffect(() => {
    loadQaHistory();
    loadSearchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSuggestion = (suggestion: string) => {
    setGlobalQaQuestion(suggestion);
  };

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      setSearchError('Enter a query before running semantic search.');
      return;
    }

    setSearchError(null);
    const filters = parseFiltersInput(searchFilters, setSearchError);
    if (filters === null) {
      return;
    }

    setIsSubmittingSearch(true);
    setSearchError(null);
    setSearchStatus(null);
    try {
      const response = await postEvent({
        event_type: 'search_query',
        query: searchQuery,
        filters,
        limit: searchLimit,
      });
      setSearchStatus(`Search queued. Event ${response.event_id}.`);
      addNotification({
        title: 'Search queued',
        description: `Event ${response.event_id} will populate the workspace shortly.`,
        variant: 'success',
        href: '/qa',
      });
      loadSearchHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search request failed.';
      setSearchError(message);
      addNotification({ title: 'Search request failed', description: message, variant: 'error' });
    } finally {
      setIsSubmittingSearch(false);
    }
  };

  const handleQaSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!globalQaQuestion.trim()) {
      setQaSubmissionError('Enter a question before running QA.');
      return;
    }

    setQaSubmissionError(null);
    const filters = parseFiltersInput(globalQaFilters, setQaSubmissionError);
    if (filters === null) {
      return;
    }

    setIsSubmittingQa(true);
    setQaSubmissionError(null);
    setQaSubmissionStatus(null);
    try {
      const response = await postEvent({
        event_type: 'qa_query',
        query: globalQaQuestion,
        filters,
        top_k: settings.qaTopK,
      });
      setQaSubmissionStatus(`QA task queued. Event ${response.event_id}.`);
      setGlobalQaQuestion('');
      addNotification({
        title: 'QA task queued',
        description: `Event ${response.event_id} added to history.`,
        variant: 'success',
        href: '/qa',
      });
      loadQaHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'QA request failed.';
      setQaSubmissionError(message);
      addNotification({ title: 'QA request failed', description: message, variant: 'error' });
    } finally {
      setIsSubmittingQa(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr),minmax(0,0.85fr)]">
        <div className="flex flex-col gap-6">
          <QueryCard
            title="Semantic search"
            description="Run semantic retrieval with optional metadata filters."
            icon={SearchIcon}
            isLoading={isSubmittingSearch}
            onRefresh={loadSearchHistory}
            refreshDisabled={isSubmittingSearch || isLoadingSearch}
          >
            <form className="space-y-4" onSubmit={handleSearchSubmit}>
              <div className="space-y-2">
                <Label htmlFor="semantic-query">Query</Label>
                <Input
                  id="semantic-query"
                  placeholder="What does the GST certificate say about address?"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="semantic-filters">Filters (JSON)</Label>
                  <Textarea
                    id="semantic-filters"
                    placeholder='{"document_id":"..."}'
                    value={searchFilters}
                    onChange={(event) => setSearchFilters(event.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="semantic-limit">Result limit</Label>
                  <Input
                    id="semantic-limit"
                    type="number"
                    min={1}
                    value={searchLimit}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSearchLimit(Number.isFinite(value) && value > 0 ? value : settings.searchResultLimit);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Default: {settings.searchResultLimit}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                {searchStatus ? <span className="text-xs text-muted-foreground">{searchStatus}</span> : null}
                <Button type="submit" disabled={isSubmittingSearch} className="gap-2">
                  {isSubmittingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
                  {isSubmittingSearch ? 'Running…' : 'Run search'}
                </Button>
              </div>
              {searchError ? <p className="text-sm text-destructive">{searchError}</p> : null}
            </form>
          </QueryCard>

          <QueryCard
            title="Corpus QA"
            description="Ask questions across all indexed documents."
            icon={Sparkles}
            isLoading={isSubmittingQa}
            onRefresh={loadQaHistory}
            refreshDisabled={isSubmittingQa || isLoadingQa}
          >
            <form className="space-y-4" onSubmit={handleQaSubmit}>
              <div className="space-y-2">
                <Label htmlFor="qa-question">Question</Label>
                <Textarea
                  id="qa-question"
                  placeholder="What does the collection say about payment terms?"
                  value={globalQaQuestion}
                  onChange={(event) => setGlobalQaQuestion(event.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="qa-filters">Filters (JSON)</Label>
                  <Textarea
                    id="qa-filters"
                    placeholder='{"doc_type":"policy"}'
                    value={globalQaFilters}
                    onChange={(event) => setGlobalQaFilters(event.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>QA top_k</Label>
                  <Input type="number" value={settings.qaTopK} readOnly />
                  <p className="text-xs text-muted-foreground">Configured via Settings.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Quick suggestions:</span>
                  {SUGGESTED_QUESTIONS.map((suggestion) => (
                    <Badge
                      key={suggestion}
                      variant="outline"
                      className="cursor-pointer border-dashed"
                      onClick={() => handleSuggestion(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
                <Button type="submit" disabled={isSubmittingQa} className="gap-2">
                  {isSubmittingQa ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isSubmittingQa ? 'Submitting…' : 'Run QA'}
                </Button>
              </div>
              {qaSubmissionStatus ? <p className="text-xs text-muted-foreground">{qaSubmissionStatus}</p> : null}
              {qaSubmissionError ? <p className="text-sm text-destructive">{qaSubmissionError}</p> : null}
            </form>
          </QueryCard>
        </div>

        <Card className="border-border/70 bg-card/80">
          <CardHeader className="gap-1">
            <CardTitle className="text-lg font-semibold">Workspace status</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Monitor queue activity and search throughput.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusRow
              icon={History}
              label="Recent searches"
              value={`${searchEntries.length} stored`}
              helper={isLoadingSearch ? 'Refreshing…' : 'Showing latest 50 events'}
            />
            <StatusRow
              icon={BookOpen}
              label="QA responses"
              value={`${qaEntries.length} tracked`}
              helper={isLoadingQa ? 'Refreshing…' : 'Confidence scores available'}
            />
            {qaError ? <Alert message={qaError} /> : null}
            {searchError ? <Alert message={searchError} /> : null}
          </CardContent>
        </Card>
      </div>

      <HistorySection
        title="Search history"
        description="Explore semantics lookups, filters, and preview results."
        isLoading={isLoadingSearch}
        emptyState="No search history yet."
        entries={searchEntries}
        renderEntry={(entry) => <SearchHistoryCard key={entry.event_id} entry={entry} />}
        onRefresh={loadSearchHistory}
      />

      <HistorySection
        title="QA history"
        description="Completed answers with reasoning, citations, and references."
        isLoading={isLoadingQa}
        emptyState="No QA history yet."
        entries={qaEntries}
        renderEntry={(entry) => <QaHistoryCard key={entry.event_id} entry={entry} onAskFollowUp={setGlobalQaQuestion} />}
        onRefresh={loadQaHistory}
      />
    </div>
  );
}

interface QueryCardProps {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  isLoading?: boolean;
  onRefresh: () => void;
  refreshDisabled?: boolean;
}

function QueryCard({ title, description, icon: Icon, children, isLoading, onRefresh, refreshDisabled }: QueryCardProps) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-subtle">
      <CardHeader className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Icon className={cn('h-5 w-5 text-primary', isLoading ? 'animate-spin' : '')} />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshDisabled} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', refreshDisabled ? '' : 'hover:rotate-180 transition-transform')} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

interface StatusRowProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper?: string;
}

function StatusRow({ icon: Icon, label, value, helper }: StatusRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between text-sm font-medium text-foreground">
          <span>{label}</span>
          <span className="text-muted-foreground">{value}</span>
        </div>
        {helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
      </div>
    </div>
  );
}

interface HistorySectionProps<T> {
  title: string;
  description: string;
  entries: T[];
  isLoading: boolean;
  emptyState: string;
  renderEntry: (entry: T) => React.ReactNode;
  onRefresh: () => void;
}

function HistorySection<T>({ title, description, entries, isLoading, emptyState, renderEntry, onRefresh }: HistorySectionProps<T>) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>
      <div className="space-y-3">
        {entries.map(renderEntry)}
        {!entries.length && !isLoading ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            {emptyState}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SearchHistoryCard({ entry }: { entry: SearchHistoryEntry }) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground">{entry.query}</CardTitle>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            limit {entry.limit}
          </Badge>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{new Date(entry.created_at).toLocaleString()}</span>
          <span>{entry.result_count} results</span>
          {entry.results_truncated ? <span>Preview truncated</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entry.filters && Object.keys(entry.filters).length ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">Filters:</strong> {JSON.stringify(entry.filters)}
          </div>
        ) : null}
        <div className="space-y-2">
          {entry.results.map((result, idx) => (
            <div
              key={`${entry.event_id}-${result.id}-${idx}`}
              className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm shadow-subtle"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Result {idx + 1}</span>
                {typeof result.distance === 'number' ? (
                  <span className="font-mono text-[11px]">distance {result.distance.toFixed(4)}</span>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{result.contents}</p>
              {result.metadata && Object.keys(result.metadata).length ? (
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  {Object.entries(result.metadata).map(([key, value]) => (
                    <span key={key}>
                      <strong className="font-medium text-foreground">{key}:</strong>{' '}
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {!entry.results.length ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
              No preview results stored yet.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

interface QaHistoryCardProps {
  entry: QAHistoryEntry;
  onAskFollowUp: (question: string) => void;
}

function QaHistoryCard({ entry, onAskFollowUp }: QaHistoryCardProps) {
  const followUp = entry.reasoning ? `Follow up on ${entry.query}: ${entry.reasoning.slice(0, 60)}…` : `Clarify ${entry.query}`;
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground">{entry.query}</CardTitle>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            QA
          </Badge>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{new Date(entry.created_at).toLocaleString()}</span>
          {entry.confidence != null ? <span>Confidence {entry.confidence.toFixed(2)}</span> : null}
          <span>{entry.citations.length} citations</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entry.answer ? (
          <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm text-foreground">{entry.answer}</p>
        ) : (
          <p className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            No answer recorded yet.
          </p>
        )}
        {entry.reasoning ? (
          <details className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Reasoning</summary>
            <p className="mt-2 text-sm text-muted-foreground">{entry.reasoning}</p>
          </details>
        ) : null}
        {entry.chunk_references.length ? (
          <details className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Chunk references</summary>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {entry.chunk_references.map((reference) => (
                <li key={reference.reference} className="flex flex-wrap gap-2">
                  <code className="rounded bg-muted px-2 py-0.5">{reference.reference}</code>
                  {reference.filename ? <span>{reference.filename}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => onAskFollowUp(followUp)}>
            <CornerDownRight className="h-4 w-4" />
            Ask follow-up
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Alert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

const SUGGESTED_QUESTIONS = [
  'Summarise the latest compliance updates',
  'What risks are mentioned across policy documents?',
  'List outstanding customer requests with deadlines',
];
