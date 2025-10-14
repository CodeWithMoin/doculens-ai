import { type ComponentType, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Clock, DollarSign, FileCheck, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';

import { fetchDashboardInsights, fetchDocuments } from '../api/client';
import type { DashboardInsights, DocumentEntry } from '../api/types';
import { DocumentDetail } from '../components/DocumentDetail';
import { DocumentList } from '../components/DocumentList';
import { DocumentUploadForm } from '../components/DocumentUploadForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { PersonaQuickstart } from '../components/dashboard/PersonaQuickstart';
import { StatisticCard } from '../components/dashboard/StatisticCard';
import { TimeSeriesCard } from '../components/dashboard/TimeSeriesCard';
import { ActivityFeed } from '../components/notifications/ActivityFeed';
import { useSettings } from '../settings/SettingsProvider';
import { cn } from '../lib/utils';

export function DocumentsPage() {
  const { serverConfig, error: settingsError } = useSettings();
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [selected, setSelected] = useState<DocumentEntry | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadDocuments = () => {
    setIsLoading(true);
    setError(null);
    fetchDocuments(50)
      .then((items) => {
        setDocuments(items);
        if (items.length && (!selected || !items.find((doc) => doc.document_id === selected.document_id))) {
          setSelected(items[0]);
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
  }, []); // load once

  const {
    data: insights,
    isFetching: isFetchingInsights,
    refetch: refetchInsights,
    error: insightsError,
  } = useQuery({
    queryKey: ['dashboard-insights'],
    queryFn: fetchDashboardInsights,
  });

  const metrics: DashboardInsights = (insights ?? {
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
  }) as DashboardInsights;

  const handleFullRefresh = () => {
    loadDocuments();
    void refetchInsights();
  };

  return (
    <div className="flex flex-col gap-6">
      <PersonaQuickstart />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={FileCheck}
          label="Documents processed"
          value={metrics.total_documents}
          helper={`Showing latest ${Math.min(documents.length, 50)} items`}
          delta={metrics.delta_processed}
          tone={metrics.delta_processed_tone}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Summaries generated"
          value={metrics.summarised_documents}
          helper={`${metrics.summarised_documents} of ${metrics.total_documents} have completed summaries`}
          delta={metrics.delta_summaries}
          tone={metrics.delta_summaries_tone}
        />
        <MetricCard
          icon={Clock}
          label="Queue latency"
          value={metrics.queue_latency}
          helper="Median time from upload to summary task"
        />
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="gap-1">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Sync status</CardTitle>
            <CardDescription className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Pipeline healthy
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              {insightsError ? (
                <span className="text-destructive">Unable to load dashboard insights.</span>
              ) : error ? (
                <span className="text-destructive">{error}</span>
              ) : isLoading ? (
                <span>Refreshing document feed…</span>
              ) : isFetchingInsights ? (
                <span>Updating insights…</span>
              ) : (
                <span>Last synced just now.</span>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleFullRefresh}
              disabled={isLoading || isFetchingInsights}
              className="gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading ? 'animate-spin' : '')} />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </section>

      {insightsError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Unable to refresh dashboard insights. Showing approximate values.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
        <div className="flex flex-col gap-6">
          <DocumentUploadForm onUploaded={handleFullRefresh} />
          <DocumentList documents={documents} selectedId={selected?.document_id} onSelect={setSelected} />
          {serverConfig?.auth_required ? (
            <Card className="border-dashed border-border/70 bg-muted/40">
              <CardContent className="flex items-center justify-between gap-4 py-4 text-sm text-muted-foreground">
                <span>
                  API key required via <Badge variant="outline">{serverConfig.api_key_header}</Badge> header.
                </span>
              </CardContent>
            </Card>
          ) : null}
          {settingsError ? (
            <p className="text-sm text-destructive">{settingsError}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-6">
          <DocumentDetail document={selected} onEventQueued={() => handleFullRefresh()} />
          <div className="grid gap-6 md:grid-cols-2">
            <StatisticCard title="Operational savings" icon={DollarSign}>
              <p>
                Automation has saved <strong>${metrics.estimated_savings.toLocaleString()}</strong> over the last 30 days,
                reducing manual review hours by <strong>{metrics.hours_saved.toLocaleString()}</strong>.
              </p>
              <p>
                Based on average analyst cost of <strong>${metrics.analyst_rate}/hr</strong> and ingestion volume.
              </p>
            </StatisticCard>
            <StatisticCard title="SLA watch" icon={AlertTriangle}>
              <p>
                <strong>{metrics.sla_risk_count}</strong> documents exceeded SLA thresholds in the last 24h.
              </p>
              <p>{metrics.sla_risk_message}</p>
            </StatisticCard>
          </div>
          <TimeSeriesCard
            title="Throughput last 14 days"
            icon={Activity}
            data={metrics.throughput_series}
            color="#2563eb"
            helper="Daily completed ingestion events comparing to baseline."
          />
          <TimeSeriesCard
            title="Compliance health"
            icon={TrendingUp}
            data={metrics.compliance_series}
            color="#10b981"
            helper="Rate of documents passing compliance checks."
          />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  helper?: string;
  delta?: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

function MetricCard({ icon: Icon, label, value, helper, delta, tone = 'neutral' }: MetricCardProps) {
  const toneClasses: Record<NonNullable<MetricCardProps['tone']>, string> = {
    positive: 'text-emerald-500',
    negative: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-foreground">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
        {delta ? <p className={cn('mt-1 text-xs font-medium', toneClasses[tone])}>{delta}</p> : null}
      </CardContent>
    </Card>
  );
}
