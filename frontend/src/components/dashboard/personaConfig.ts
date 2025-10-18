import { type ComponentType } from 'react';
import { BarChart3, Briefcase, CheckCircle2, Code2, Shield } from 'lucide-react';

import type { Persona as SettingsPersona } from '../../settings/types';

interface PersonaConfig {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  actions: Array<{ title: string; description: string; href: string; accent?: string }>;
}

export const PERSONA_CONFIG: Record<SettingsPersona, PersonaConfig> = {
  analyst: {
    label: 'Analyst',
    description: 'Upload, validate outputs, and answer high-stakes questions.',
    icon: Shield,
    actions: [
      {
        title: 'Upload new evidence',
        description: 'Drag & drop case files, tag document types, and kick off summaries.',
        href: '/',
      },
      {
        title: 'QA the latest batch',
        description: 'Run targeted QA across priority documents with citations.',
        href: '/qa',
      },
      {
        title: 'Approve summaries',
        description: 'Review AI summaries, leave annotations, and push to downstream systems.',
        href: '/',
      },
    ],
  },
  manager: {
    label: 'Manager',
    description: 'Watch throughput, SLA risk, and team workload.',
    icon: Briefcase,
    actions: [
      {
        title: 'Scan today’s KPIs',
        description: 'Check dashboards for SLA risks and backlog growth.',
        href: '/work-queues',
      },
      {
        title: 'Coach reviewers',
        description: 'Spot coaching opportunities by filtering documents awaiting approval.',
        href: '/pipeline',
      },
      {
        title: 'Broadcast status',
        description: 'Share quality and savings snapshots upstream.',
        href: '/settings',
      },
    ],
  },
  reviewer: {
    label: 'Reviewer',
    description: 'Audit AI outputs, leave commentary, and approve or reject results.',
    icon: CheckCircle2,
    actions: [
      {
        title: 'Triage review queue',
        description: 'Filter for documents awaiting human approval and add feedback.',
        href: '/work-queues',
      },
      {
        title: 'Escalate edge cases',
        description: 'Raise blockers to managers with contextual commentary.',
        href: '/',
      },
      {
        title: 'Sign off summaries',
        description: 'Approve or reject AI outputs with auditable notes.',
        href: '/',
      },
    ],
  },
  developer: {
    label: 'Developer',
    description: 'Maintain integrations, monitor pipelines, and tune embeddings.',
    icon: Code2,
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
        title: 'Inspect embedding health',
        description: 'Check pipeline diagnostics for drift or processing gaps.',
        href: '/settings',
      },
    ],
  },
  executive: {
    label: 'Executive',
    description: 'Track ROI, compliance posture, and overall automation performance.',
    icon: BarChart3,
    actions: [
      {
        title: 'Review savings dashboard',
        description: 'Share automation impact metrics with leadership.',
        href: '/',
      },
      {
        title: 'Assess compliance trend',
        description: 'Download KPI summaries for board reporting.',
        href: '/',
      },
      {
        title: 'Align roadmap',
        description: 'Spot gaps in coverage and align teams on next investments.',
        href: '/settings',
      },
    ],
  },
};

export type { PersonaConfig };
