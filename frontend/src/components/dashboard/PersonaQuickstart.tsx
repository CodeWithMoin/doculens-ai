import { type ComponentType } from 'react';
import { ArrowRight, BarChart3, Briefcase, Compass, Shield } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useSettings, type Persona as SettingsPersona } from '../../settings/SettingsProvider';

interface PersonaConfig {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  actions: Array<{ title: string; description: string; href: string; accent?: string }>;
}

export const PERSONA_CONFIG: Record<SettingsPersona, PersonaConfig> = {
  'operations-manager': {
    label: 'Operations Manager',
    description: 'Monitor throughput, unlock backlogs, and uphold SLAs.',
    icon: Compass,
    actions: [
      {
        title: 'Review ingestion queue',
        description: 'Check for documents pending longer than 4h and trigger follow-up.',
        href: '/',
      },
      {
        title: 'Inspect SLA alerts',
        description: 'Triage documents flagged under “SLA watch” before end of shift.',
        href: '/',
      },
      {
        title: 'Refresh status',
        description: 'Pull latest stats and confirm pipeline health via dashboard refresh.',
        href: '/',
      },
    ],
  },
  analyst: {
    label: 'Compliance Analyst',
    description: 'Upload, validate outputs, and answer high-stakes questions.',
    icon: Shield,
    actions: [
      {
        title: 'Drag & drop new docs',
        description: 'Upload the latest cases and tag with doc type + metadata presets.',
        href: '/',
      },
      {
        title: 'Verify summaries',
        description: 'Re-run summaries for priority docs and note any discrepancies.',
        href: '/',
      },
      {
        title: 'Run corpus QA',
        description: 'Use Workspace to answer management questions with citations.',
        href: '/qa',
      },
    ],
  },
  'business-owner': {
    label: 'Business Owner',
    description: 'Track ROI, compliance trends, and executive-ready insights.',
    icon: BarChart3,
    actions: [
      {
        title: 'Review savings snapshot',
        description: 'Share updated automation savings with leadership.',
        href: '/',
      },
      {
        title: 'Download compliance trend',
        description: 'Export throughput and compliance charts for quarterly report.',
        href: '/',
      },
      {
        title: 'Spot SLA risks',
        description: 'Confirm high-risk docs are being resolved within targets.',
        href: '/',
      },
    ],
  },
  integrator: {
    label: 'Systems Integrator',
    description: 'Keep connectors, keys, and job monitors healthy.',
    icon: Briefcase,
    actions: [
      {
        title: 'Sync API credentials',
        description: 'Confirm API key headers in Settings match environment config.',
        href: '/settings',
      },
      {
        title: 'Monitor job feed',
        description: 'Review QA/search results for anomalies or retriable failures.',
        href: '/qa',
      },
      {
        title: 'Document webhook status',
        description: 'Note any pending integrations needing attention.',
        href: '/settings',
      },
    ],
  },
};

export function PersonaQuickstart() {
  const { settings, setPersona } = useSettings();
  const persona = settings.persona;
  const config = PERSONA_CONFIG[persona];

  return (
    <Card className="border-border/70 bg-card/80 shadow-subtle">
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <config.icon className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Quickstart for your role</CardTitle>
              <p className="text-xs text-muted-foreground">Choose a focus persona to see suggested actions.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PERSONA_CONFIG) as SettingsPersona[]).map((key) => (
              <Button
                key={key}
                variant={key === persona ? 'accent' : 'ghost'}
                size="sm"
                onClick={() => setPersona(key)}
              >
                {PERSONA_CONFIG[key].label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {config.actions.map((action) => (
          <QuickstartActionCard key={action.title} title={action.title} description={action.description} href={action.href} />
        ))}
      </CardContent>
    </Card>
  );
}

interface QuickstartActionCardProps {
  title: string;
  description: string;
  href: string;
}

function QuickstartActionCard({ title, description, href }: QuickstartActionCardProps) {
  return (
    <div className="flex h-full flex-col justify-between rounded-lg border border-border/60 bg-muted/30 p-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button asChild variant="ghost" className="mt-3 h-auto justify-start p-0 text-sm text-primary">
        <a href={href} className="inline-flex items-center gap-1">
          Open
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}
