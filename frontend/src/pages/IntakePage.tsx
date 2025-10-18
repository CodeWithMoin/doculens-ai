import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Clock,
  FileSpreadsheet,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { fetchDashboardInsights, fetchDocuments } from '../api/client';
import type { DashboardInsights, DocumentEntry } from '../api/types';
import { ActivityFeed } from '../components/notifications/ActivityFeed';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { ROLE_ORDER, inferDueDate, inferRole, inferStatus, formatDateTime } from '../lib/routing';

type RoleSummary = Record<string, { count: number; overdue: number }>;

export function IntakePage() {
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attentionView, setAttentionView] = useState<'overdue' | 'upcoming'>('overdue');

  const {
    data: insights,
    isFetching: isFetchingInsights,
    refetch: refetchInsights,
    error: insightsError,
  } = useQuery({
    queryKey: ['dashboard-insights'],
    queryFn: fetchDashboardInsights,
  });

  const metrics: DashboardInsights =
    insights ?? {
      total_documents: documents.length,
      summarised_documents: documents.filter((doc) => Boolean(doc.summary)).length,
      chunk_count: documents.reduce((acc, doc) => acc + (doc.chunk_count ?? 0), 0),
      embedded_count: documents.reduce((acc, doc) => acc + (doc.embedded_chunk_count ?? 0), 0),
      queue_latency: '—',
      estimated_savings: 0,
      hours_saved: 0,
      analyst_rate: 65,
      sla_risk_count: 0,
      sla_risk_message: 'All documents are within SLA thresholds.',
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

  const loadDocuments = () => {
    setIsLoading(true);
    setError(null);
    fetchDocuments(100)
      .then((items) =>
        setDocuments(
          items.filter((doc) => {
            const status = inferStatus(doc).toLowerCase();
            return status !== 'archived' && status !== 'deleted';
          }),
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load documents';
        setError(message);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const roleSummary = useMemo<RoleSummary>(() => {
    const summary: RoleSummary = Object.fromEntries(ROLE_ORDER.map((role) => [role, { count: 0, overdue: 0 }]));
    const now = Date.now();
    for (const doc of documents) {
      const role = inferRole(doc);
      const dueAt = inferDueDate(doc);
      const status = inferStatus(doc).toLowerCase();
      summary[role].count += 1;
      if (dueAt) {
        const dueTime = Date.parse(dueAt);
        if (!Number.isNaN(dueTime) && dueTime < now && status !== 'completed') {
          summary[role].overdue += 1;
        }
      }
    }
    return summary;
  }, [documents]);

  const totalQueued = useMemo(
    () => ROLE_ORDER.reduce((acc, role) => acc + (roleSummary[role]?.count ?? 0), 0),
    [roleSummary],
  );

  const recentUploads = useMemo(() => documents.slice(0, 6), [documents]);

  const now = Date.now();
  const twoDays = 48 * 60 * 60 * 1000;
  const overdueDocs = useMemo(
    () =>
      documents.filter((doc) => {
        const due = inferDueDate(doc);
        if (!due) return false;
        const dueTime = Date.parse(due);
        return !Number.isNaN(dueTime) && dueTime < now;
      }),
    [documents, now],
  );
  const dueSoonDocs = useMemo(
    () =>
      documents.filter((doc) => {
        const due = inferDueDate(doc);
        if (!due) return false;
        const dueTime = Date.parse(due);
        return !Number.isNaN(dueTime) && dueTime >= now && dueTime <= now + twoDays;
      }),
    [documents, now, twoDays],
  );

  const attentionDocs = attentionView === 'overdue' ? overdueDocs : dueSoonDocs;

  const handleRefresh = () => {
    loadDocuments();
    void refetchInsights();
  };

  return (
    <div className="bg-surface-subtle px-2 pb-0 pt-2 sm:px-4 lg:px-6 xl:px-4">
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Operations centre</p>
          <div className="flex flex-col gap-2 text-foreground sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Intake performance</h1>
            <span className="text-sm text-muted-foreground">
              Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr),minmax(0,0.9fr)]">
          <div className="flex flex-col gap-6">
            <HeroTile label="Documents processed" value={metrics.total_documents.toLocaleString()} delta={metrics.delta_processed} />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HeadlineMetric
              icon={FileSpreadsheet}
              label="Captured this month"
              value={metrics.total_documents.toLocaleString()}
              helper="Digitised paperwork"
              variant="lapis"
            />
            <HeadlineMetric
              icon={Users}
              label="Ready for review"
              value={metrics.summarised_documents.toLocaleString()}
              helper="Awaiting approval"
              variant="cerulean"
            />
            <HeadlineMetric
              icon={Clock}
              label="Median processing"
              value={metrics.queue_latency}
              helper="Upload → summary"
              variant="platinum"
            />
            <HeadlineMetric
              icon={AlertTriangle}
              label="At risk"
              value={metrics.sla_risk_count.toString()}
              helper={metrics.sla_risk_message}
              variant="sky"
            />
          </div>

          <SummaryProgressCard completed={metrics.summarised_documents} total={metrics.total_documents} />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <AttentionCard
                documents={attentionDocs}
                overdueTotal={overdueDocs.length}
                dueSoonTotal={dueSoonDocs.length}
                view={attentionView}
                onChangeView={setAttentionView}
              />
              <OpsInsightsCard
                total={metrics.total_documents}
                completed={metrics.summarised_documents}
                overdue={overdueDocs.length}
                dueSoon={dueSoonDocs.length}
              />
              <QueueHealthCard totalQueued={totalQueued} overdue={overdueDocs.length} dueSoon={dueSoonDocs.length} />
            </div>
            <div className="flex flex-col gap-4">
              <WorkflowOverviewCard summary={roleSummary} />
              <EmbeddingCoverageCard chunkCount={metrics.chunk_count} embeddedCount={metrics.embedded_count} />
            </div>
          </div>

        </div>

        <div className="space-y-6">
          <HighlightCard
            title="Documents cleared"
            value={metrics.summarised_documents.toLocaleString()}
            helper="completed reviews this month"
          />

          <Card className="shadow-none">
            <CardHeader className="flex flex-col gap-1">
              <CardTitle className="text-sm font-semibold text-foreground">Sync status</CardTitle>
              <CardDescription>Pipeline heartbeat and manual refresh.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {insightsError ? (
                  <span className="text-destructive">Unable to refresh dashboard insights.</span>
                ) : error ? (
                  <span className="text-destructive">{error}</span>
                ) : isLoading || isFetchingInsights ? (
                  <span>Refreshing data…</span>
                ) : (
                  <span>Everything looks healthy.</span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || isFetchingInsights}>
                Refresh
              </Button>
            </CardContent>
          </Card>

          <TrendCard title="Processing trend" series={metrics.throughput_series} />

          <Card className="shadow-none">
            <CardHeader className="flex flex-col gap-1">
              <CardTitle className="text-sm font-semibold text-foreground">Recent uploads</CardTitle>
              <CardDescription>Documents awaiting processing or routing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {recentUploads.length === 0 ? (
                <p>No documents ingested yet.</p>
              ) : (
                recentUploads.map((doc) => (
                  <div key={doc.document_id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 text-sm shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{doc.filename ?? doc.document_id}</p>
                        {doc.doc_type ? (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {doc.doc_type}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {formatDateTime(doc.uploaded_at)} · Status {inferStatus(doc)}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/pipeline?document=${doc.document_id}`} className="inline-flex items-center gap-1 text-xs font-semibold">
                        Open
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <ActivityFeed limit={2} />

        </div>
      </section>
    </div>
  </div>
);
}

type MetricVariant = 'lapis' | 'cerulean' | 'platinum' | 'sky';

function HeadlineMetric({
  icon: Icon,
  label,
  value,
  helper,
  variant,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  helper?: string;
  variant: MetricVariant;
}) {
  const palette: Record<MetricVariant, { bg: string; accent: string }> = {
    lapis: {
      bg: 'from-[#edf3f8] to-white',
      accent: 'bg-[#2f6690] text-white',
    },
    cerulean: {
      bg: 'from-[#e9f4fb] to-white',
      accent: 'bg-[#3a7ca5] text-white',
    },
    platinum: {
      bg: 'from-[#f5f6f4] to-white',
      accent: 'bg-[#b7c0b7] text-[#1f2d32]',
    },
    sky: {
      bg: 'from-[#e8f2f8] to-white',
      accent: 'bg-[#5189b3] text-white',
    },
  };

  return (
    <Card className={cn('border-border/60 bg-gradient-to-b shadow-sm', palette[variant].bg)}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm', palette[variant].accent)}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        </div>
        <span className="text-2xl font-semibold text-foreground">{value}</span>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

function HeroTile({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <Card className="border-none bg-gradient-to-br from-[#1f4e79] via-[#2f6690] to-[#3a7ca5] text-white shadow-xl">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{label}</p>
          <p className="text-4xl font-semibold sm:text-5xl">{value}</p>
        </div>
        <div className="space-y-3 text-sm sm:text-right">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
            <BarChart3 className="h-3.5 w-3.5" />
            Velocity
          </div>
          {delta && delta !== '—' ? (
            <p className="text-sm text-white/80">Change vs last period: {delta}</p>
          ) : (
            <p className="text-sm text-white/80">No change recorded</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <Card className="border-none bg-gradient-to-br from-[#3a7ca5] via-[#5189b3] to-[#16425b] text-white shadow-lg">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">{title}</p>
            <p className="text-3xl font-semibold">{value}</p>
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
        <p className="text-sm text-white/80">{helper}</p>
      </CardContent>
    </Card>
  );
}

function AttentionCard({
  documents,
  overdueTotal,
  dueSoonTotal,
  view,
  onChangeView,
}: {
  documents: DocumentEntry[];
  overdueTotal: number;
  dueSoonTotal: number;
  view: 'overdue' | 'upcoming';
  onChangeView: (view: 'overdue' | 'upcoming') => void;
}) {
  return (
    <Card className="shadow-none self-start">
      <CardHeader className="flex flex-col gap-4 pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Documents needing attention</CardTitle>
            <CardDescription>Route or follow up before SLAs slip.</CardDescription>
          </div>
          <div className="inline-flex rounded-full border border-border/70 bg-muted/40 p-1 text-xs">
            <Button
              type="button"
              size="sm"
              variant={view === 'overdue' ? 'default' : 'ghost'}
              className="h-7 rounded-full px-3"
              onClick={() => onChangeView('overdue')}
            >
              Overdue ({overdueTotal})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'upcoming' ? 'default' : 'ghost'}
              className="h-7 rounded-full px-3"
              onClick={() => onChangeView('upcoming')}
            >
              Due soon ({dueSoonTotal})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-white px-4 py-6 text-center text-sm text-muted-foreground">
            {view === 'overdue' ? 'No overdue documents right now.' : 'No documents due in the next 48 hours.'}
          </div>
        ) : (
          documents.slice(0, 6).map((doc) => {
            const role = inferRole(doc);
            const status = inferStatus(doc);
            const dueAt = formatDateTime(inferDueDate(doc));
            return (
              <div
                key={doc.document_id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{doc.filename ?? doc.document_id}</p>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Status: {status}</p>
                  <p className="text-xs text-muted-foreground">Due: {dueAt}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/work-queues?document=${doc.document_id}`}>Open</Link>
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function SummaryProgressCard({ completed, total }: { completed: number; total: number }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="text-sm font-semibold text-foreground">Summary coverage</CardTitle>
        <CardDescription>
          {total > 0
            ? `${completed.toLocaleString()} of ${total.toLocaleString()} documents have summaries ready.`
            : 'No documents ingested yet.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-[#2f6690] to-[#81c3d7]"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-foreground">{percentage}%</span>
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
          <span className="font-semibold text-foreground">{completed.toLocaleString()} ready</span>
          <span>{Math.max(total - completed, 0).toLocaleString()} pending review</span>
          <span>{total.toLocaleString()} total uploaded</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmbeddingCoverageCard({ chunkCount, embeddedCount }: { chunkCount: number; embeddedCount: number }) {
  const coverage = chunkCount > 0 ? Math.round((embeddedCount / chunkCount) * 100) : 0;
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-col gap-1 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground">Embedding coverage</CardTitle>
          <span className="rounded-full bg-[#2f6690]/10 px-2 py-0.5 text-xs font-semibold text-[#2f6690]">{coverage}%</span>
        </div>
        <CardDescription className="text-xs">Share of chunks with embeddings for search.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-[#16425b] to-[#3a7ca5]"
              style={{ width: `${Math.min(coverage, 100)}%` }}
            />
          </div>
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <span className="font-semibold text-foreground">{embeddedCount.toLocaleString()} embedded chunks</span>
          <span>{chunkCount.toLocaleString()} total processed</span>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueHealthCard({ totalQueued, overdue, dueSoon }: { totalQueued: number; overdue: number; dueSoon: number }) {
  const onTrack = Math.max(totalQueued - overdue - dueSoon, 0);
  const totalBar = Math.max(totalQueued, 1);
  const segments = [
    { label: 'Overdue', value: overdue, color: '#d97706' },
    { label: 'Due soon', value: dueSoon, color: '#3a7ca5' },
    { label: 'On track', value: onTrack, color: '#2f6690' },
  ];

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-col gap-1 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">Queue status</CardTitle>
        <CardDescription className="text-xs">Breakdown of items awaiting action.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {totalQueued === 0 ? (
          <div className="rounded-lg border border-border/70 bg-white px-3 py-6 text-center text-sm text-muted-foreground">
            All caught up—no queue today.
          </div>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {segments
                .filter(({ value }) => value > 0)
                .map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="h-full"
                    style={{ width: `${Math.min((value / totalBar) * 100, 100)}%`, backgroundColor: color }}
                  />
                ))}
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-3">
              {segments.map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-white/70 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-semibold text-foreground">{label}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {value.toLocaleString()} ({Math.round((value / totalBar) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TrendCard({ title, series }: { title: string; series: Array<{ label: string; value: number }> }) {
  const values = series.length ? series.map((item) => item.value) : [10, 18, 12, 20, 17, 24, 19];
  const max = Math.max(...values, 1);
  const chartPoints = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - (value / max) * 80 - 10;
      return `${x},${y}`;
    })
    .join(' ');

  const labels = series.length ? series.map((item) => item.label) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        <CardDescription>Volume of documents processed over time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <svg viewBox="0 0 100 100" className="h-32 w-full overflow-visible">
          <defs>
            <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(63, 155, 208, 0.35)" />
              <stop offset="100%" stopColor="rgba(63, 155, 208, 0)" />
            </linearGradient>
          </defs>
          <polyline
            fill="none"
            stroke="rgba(47,102,144,0.9)"
            strokeWidth="2"
            strokeLinecap="round"
            points={chartPoints}
          />
          <polygon
            fill="url(#trendGradient)"
            points={`0,100 ${chartPoints} 100,100`}
            opacity={0.55}
          />
        </svg>
        <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {labels.slice(-4).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowOverviewCard({ summary }: { summary: RoleSummary }) {
  const total = ROLE_ORDER.reduce((acc, role) => acc + (summary[role]?.count ?? 0), 0);
  const palette = ['#2f6690', '#3a7ca5', '#16425b', '#81c3d7', '#1b4965', '#0d1f2d'];
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  const segments = ROLE_ORDER.map((role, index) => {
    const value = summary[role]?.count ?? 0;
    const dash = total > 0 ? (value / total) * circumference : 0;
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    const segment = {
      role,
      value,
      dash,
      offset: cumulative,
      color: palette[index % palette.length],
      percentage,
    };
    cumulative += dash;
    return segment;
  });

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="text-sm font-semibold text-foreground">Workflow by role</CardTitle>
        <CardDescription>Current queue mix and ownership across teams.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0 lg:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)] lg:items-start">
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLE_ORDER.map((role) => (
            <div key={role} className="rounded-xl border border-platinum-600 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">{role}</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>{summary[role].count.toLocaleString()} in queue</p>
                <p>{summary[role].overdue.toLocaleString()} overdue</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3">
          {total === 0 ? (
            <div className="w-full rounded-xl border border-border/70 bg-white px-4 py-6 text-center text-sm text-muted-foreground">
              No active queue items.
            </div>
          ) : (
            <>
              <svg viewBox="0 0 36 36" className="h-36 w-36">
                <circle cx="18" cy="18" r={radius} fill="transparent" stroke="#d9dcd6" strokeWidth="5" />
                <g transform="rotate(-90 18 18)">
                  {segments.map(({ role, dash, offset, color }) =>
                    dash > 0 ? (
                      <circle
                        key={role}
                        cx="18"
                        cy="18"
                        r={radius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth="5"
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={-offset}
                        strokeLinecap="round"
                      />
                    ) : null,
                  )}
                </g>
              </svg>
              <div className="flex w-full flex-col gap-2 text-xs">
                {segments.map(({ role, value, color, percentage }) => (
                  <div key={role} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-white/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-medium text-foreground">{role}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {value.toLocaleString()} ({percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OpsInsightsCard({
  total,
  completed,
  overdue,
  dueSoon,
}: {
  total: number;
  completed: number;
  overdue: number;
  dueSoon: number;
}) {
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(total - completed, 0);
  const automationRate = total > 0 ? Math.round((completed / Math.max(total, 1)) * 100) : 0;
  const tiles = [
    {
      label: 'Summary completion',
      value: `${completionRate}%`,
      detail: `${completed.toLocaleString()} ready · ${remaining.toLocaleString()} pending`,
    },
    {
      label: 'Routing backlog',
      value: overdue > 0 ? `${overdue}` : 'On track',
      detail:
        overdue > 0
          ? dueSoon > 0
            ? `${dueSoon} due within 48h`
            : 'Escalate overdue items'
          : dueSoon > 0
            ? `${dueSoon} due within 48h`
            : 'Nothing queued',
    },
    {
      label: 'Automation coverage',
      value: `${automationRate}%`,
      detail: total > 0 ? 'Completed via AI summarisation' : 'Awaiting uploads',
    },
  ];

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-col gap-1 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">Operations insights</CardTitle>
        <CardDescription className="text-xs">Quick health check on throughput and backlog.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 pt-0">
        {tiles.map(({ label, value, detail }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-white px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{detail}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
