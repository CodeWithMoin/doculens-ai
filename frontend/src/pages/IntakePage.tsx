import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { fetchDashboardInsights, fetchDocuments } from '../api/client';
import type { DashboardInsights, DocumentEntry } from '../api/types';
import { ActivityFeed } from '../components/notifications/ActivityFeed';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { formatDateTime, inferDueDate, inferRole, inferStatus } from '../lib/routing';

const FALLBACK_METRICS: DashboardInsights = {
  total_documents: 0,
  summarised_documents: 0,
  chunk_count: 0,
  embedded_count: 0,
  queue_latency: '—',
  estimated_savings: 0,
  hours_saved: 0,
  analyst_rate: 65,
  sla_risk_count: 0,
  sla_risk_message: 'Everything is on track.',
  throughput_series: [],
  compliance_series: [],
  delta_processed: '—',
  delta_processed_tone: 'neutral',
  delta_summaries: '—',
  delta_summaries_tone: 'neutral',
  today_total: 0,
  today_summaries: 0,
  yesterday_total: 0,
  yesterday_summaries: 0,
};

export function IntakePage() {
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const currentTime = useMemo(() => Date.now(), []);

  const {
    data: insights,
    isFetching: isFetchingInsights,
    refetch: refetchInsights,
    error: insightsError,
  } = useQuery({ queryKey: ['dashboard-insights'], queryFn: fetchDashboardInsights });

  const metrics = insights ?? {
    ...FALLBACK_METRICS,
    total_documents: documents.length,
    summarised_documents: documents.filter((document) => Boolean(document.summary)).length,
    chunk_count: documents.reduce((total, document) => total + (document.chunk_count ?? 0), 0),
    embedded_count: documents.reduce((total, document) => total + (document.embedded_chunk_count ?? 0), 0),
  };

  const loadDocuments = () => {
    setIsLoadingDocuments(true);
    setDocumentsError(null);
    fetchDocuments(100)
      .then((items) =>
        setDocuments(
          items.filter((document) => !['archived', 'deleted'].includes(inferStatus(document).toLowerCase())),
        ),
      )
      .catch((error: unknown) =>
        setDocumentsError(error instanceof Error ? error.message : 'Unable to load workspace documents.'),
      )
      .finally(() => setIsLoadingDocuments(false));
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const recentDocuments = useMemo(
    () =>
      documents
        .slice()
        .sort((first, second) => Date.parse(second.uploaded_at) - Date.parse(first.uploaded_at))
        .slice(0, 5),
    [documents],
  );

  const attentionDocuments = useMemo(() => {
    const windowEnd = currentTime + 48 * 60 * 60 * 1000;
    return documents
      .filter((document) => {
        const dueAt = inferDueDate(document);
        if (!dueAt || ['ready', 'completed', 'archived'].includes(inferStatus(document).toLowerCase())) return false;
        const dueTime = Date.parse(dueAt);
        return !Number.isNaN(dueTime) && dueTime <= windowEnd;
      })
      .sort((first, second) => Date.parse(inferDueDate(first) ?? '') - Date.parse(inferDueDate(second) ?? ''))
      .slice(0, 3);
  }, [currentTime, documents]);

  const summaryCoverage = percentage(metrics.summarised_documents, metrics.total_documents);
  const embeddingCoverage = percentage(metrics.embedded_count, metrics.chunk_count);
  const isRefreshing = isLoadingDocuments || isFetchingInsights;

  const handleRefresh = () => {
    loadDocuments();
    void refetchInsights();
  };

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[28px] bg-[#111721] text-white shadow-[0_24px_70px_-34px_rgba(10,18,35,0.55)] dark:bg-[#182131]">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[48px] border-primary/20" />
        <div className="relative grid gap-10 px-6 py-8 sm:px-9 sm:py-10 xl:grid-cols-[1.25fr,0.75fr] xl:items-end">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Workspace pulse
            </div>
            <h2 className="mt-5 max-w-3xl text-balance text-3xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-4xl xl:text-[46px]">
              {metrics.total_documents.toLocaleString()} documents are searchable.
              <span className="block text-white/55">
                {metrics.sla_risk_count > 0 ? `${metrics.sla_risk_count} need a decision.` : 'Nothing is blocking your team.'}
              </span>
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/60">
              Ask a question, continue a review, or inspect the evidence behind any answer.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-white px-5 text-[#111721] hover:bg-white/90 dark:bg-white dark:text-[#111721] dark:hover:bg-white/90">
                <Link to="/app/qa"><Sparkles className="mr-2 h-4 w-4 text-primary" />Ask DocuLens</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/20 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white">
                <Link to="/app/work-queues">Review active work <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Since yesterday</p>
            <div className="mt-4 divide-y divide-white/10">
              <PulseRow label="Documents added" value={metrics.today_total} detail={metrics.delta_processed} />
              <PulseRow label="Summaries completed" value={metrics.today_summaries} detail={metrics.delta_summaries} />
              <PulseRow label="Median processing" value={metrics.queue_latency} detail="upload to searchable" />
            </div>
          </div>
        </div>

        <div className="relative grid border-t border-white/10 sm:grid-cols-3">
          <HeroStat label="Summary coverage" value={`${summaryCoverage}%`} helper={`${metrics.summarised_documents.toLocaleString()} ready`} />
          <HeroStat label="Search coverage" value={`${embeddingCoverage}%`} helper={`${metrics.embedded_count.toLocaleString()} chunks embedded`} />
          <HeroStat label="Workspace status" value={isRefreshing ? 'Syncing' : 'Healthy'} helper={isRefreshing ? 'Refreshing workspace data' : 'All services responding'} />
        </div>
      </section>

      {(documentsError || insightsError) ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{documentsError ?? 'Workspace insights are temporarily unavailable.'}</span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>Retry</Button>
        </div>
      ) : null}

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1.45fr),minmax(320px,0.72fr)]">
        <div className="space-y-7">
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_12px_40px_-32px_rgba(10,18,35,0.32)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
            <div>
              <h3 className="text-sm font-semibold">Continue working</h3>
              <p className="mt-1 text-xs text-muted-foreground">Recently added and processed documents.</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing} aria-label="Refresh workspace">
                <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              </Button>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                <Link to="/app/pipeline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </div>

          {isLoadingDocuments && !recentDocuments.length ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading documents…</div>
          ) : !recentDocuments.length ? (
            <div className="px-6 py-16 text-center"><FileText className="mx-auto h-7 w-7 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">Your workspace is ready.</p><p className="mt-1 text-xs text-muted-foreground">Upload a document to begin building searchable knowledge.</p></div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentDocuments.map((document) => <DocumentRow key={document.document_id} document={document} />)}
            </div>
          )}
          </section>
          <CoveragePanel summaryCoverage={summaryCoverage} embeddingCoverage={embeddingCoverage} metrics={metrics} />
        </div>

        <div className="space-y-7">
          <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.045]">
            <div className="p-5 sm:p-6">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><MessageSquareText className="h-4 w-4" /></span>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em]">Ask your workspace</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Get an answer grounded in the documents your team has already reviewed.</p>
              <Link to="/app/qa" className="mt-5 flex items-center gap-3 rounded-xl border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm transition hover:border-primary/35">
                <Search className="h-4 w-4" /><span className="flex-1">Ask a question…</span><ArrowRight className="h-4 w-4 text-primary" />
              </Link>
            </div>
            <div className="border-t border-primary/15 px-5 py-4 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Try asking</p>
              <div className="mt-3 space-y-2">
                {['Which contracts renew this quarter?', 'Summarize the open compliance risks'].map((prompt) => (
                  <Link key={prompt} to="/app/qa" className="group flex items-center justify-between gap-3 text-xs font-medium text-foreground">
                    <span>{prompt}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <AttentionPanel documents={attentionDocuments} riskCount={metrics.sla_risk_count} />
          <ActivityFeed limit={3} />
        </div>
      </div>
    </div>
  );
}

function PulseRow({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-xs text-white/55">{label}</span>
      <span className="text-right"><strong className="text-sm font-semibold text-white">{value}</strong><span className="ml-2 text-[10px] text-white/40">{detail}</span></span>
    </div>
  );
}

function HeroStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="border-white/10 px-6 py-5 sm:border-r sm:last:border-r-0 sm:px-9">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{label}</p>
      <div className="mt-2 flex items-baseline gap-2"><span className="text-2xl font-semibold tracking-tight">{value}</span><span className="text-[10px] text-white/45">{helper}</span></div>
    </div>
  );
}

function DocumentRow({ document }: { document: DocumentEntry }) {
  const status = inferStatus(document);
  const role = inferRole(document);
  const isReady = status.toLowerCase() === 'ready';
  return (
    <Link to={`/app/pipeline?document=${document.document_id}`} className="group grid gap-3 px-5 py-4 transition hover:bg-surface-subtle/70 sm:grid-cols-[minmax(0,1fr),auto] sm:items-center sm:px-6">
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-subtle text-muted-foreground group-hover:text-primary"><FileText className="h-[18px] w-[18px]" /></span>
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{document.filename ?? document.document_id}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{document.doc_type ?? 'Unclassified'} · Added {formatDateTime(document.uploaded_at)}</span></span>
      </div>
      <div className="flex items-center gap-3 pl-[54px] sm:pl-0">
        <Badge variant="outline" className="text-[9px] uppercase tracking-[0.12em]">{role}</Badge>
        <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', isReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>
        <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </Link>
  );
}

function AttentionPanel({ documents, riskCount }: { documents: DocumentEntry[]; riskCount: number }) {
  return (
    <section className="rounded-2xl border border-amber-300/45 bg-amber-50/60 p-5 dark:border-amber-700/30 dark:bg-amber-950/15 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">Needs attention</p><h3 className="mt-2 text-base font-semibold">{riskCount > 0 ? `${riskCount} ${riskCount === 1 ? 'review is' : 'reviews are'} approaching SLA` : 'No urgent reviews'}</h3></div><Clock3 className="h-5 w-5 text-amber-600" /></div>
      <div className="mt-4 space-y-2">
        {documents.length ? documents.map((document) => (
          <Link key={document.document_id} to={`/app/work-queues?document=${document.document_id}`} className="flex items-center justify-between gap-3 rounded-xl bg-background/75 px-3 py-2.5 text-xs shadow-sm ring-1 ring-amber-200/60 dark:ring-amber-800/30">
            <span className="min-w-0"><span className="block truncate font-semibold">{document.filename ?? document.document_id}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Due {formatDateTime(inferDueDate(document))}</span></span><ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        )) : <p className="text-xs leading-5 text-muted-foreground">The queue is clear. New SLA risks will appear here.</p>}
      </div>
      <Button asChild variant="ghost" size="sm" className="mt-3 -ml-3 gap-1 text-xs"><Link to="/app/work-queues">Open work queues <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
    </section>
  );
}

function CoveragePanel({ summaryCoverage, embeddingCoverage, metrics }: { summaryCoverage: number; embeddingCoverage: number; metrics: DashboardInsights }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Knowledge readiness</h3><p className="mt-1 text-xs text-muted-foreground">How much of your workspace can answer questions today.</p></div><ShieldCheck className="h-5 w-5 text-emerald-600" /></div>
      <div className="mt-6 space-y-5">
        <CoverageRow label="Documents summarized" value={summaryCoverage} helper={`${metrics.summarised_documents.toLocaleString()} of ${metrics.total_documents.toLocaleString()}`} />
        <CoverageRow label="Chunks searchable" value={embeddingCoverage} helper={`${metrics.embedded_count.toLocaleString()} of ${metrics.chunk_count.toLocaleString()}`} />
      </div>
      <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Citations and page provenance enabled for indexed sources.</div>
    </section>
  );
}

function CoverageRow({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div><div className="flex items-center justify-between gap-4 text-xs"><span className="font-medium">{label}</span><span className="text-muted-foreground">{helper} · <strong className="font-semibold text-foreground">{value}%</strong></span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.min(value, 100)}%` }} /></div></div>
  );
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
