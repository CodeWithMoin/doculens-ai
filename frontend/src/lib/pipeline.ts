import type { DocumentEntry } from '../api/types';
import { inferRole, inferStatus } from './routing';

export interface PipelineStage {
  id: 'upload' | 'extraction' | 'embedding' | 'summary' | 'routing';
  label: string;
  description: string;
  state: 'pending' | 'active' | 'complete';
}

export function derivePipelineStages(document: DocumentEntry): PipelineStage[] {
  const terminal = ['completed', 'archived'].includes(inferStatus(document).toLowerCase());
  const hasChunks = (document.chunk_count ?? 0) > 0;
  const hasEmbeddings = (document.embedded_chunk_count ?? 0) > 0;
  const hasSummary = Boolean(document.summary?.summary);
  const hasRoute = Boolean(document.assigned_role) || inferRole(document) !== 'Operations';
  const state = (complete: boolean, active: boolean): PipelineStage['state'] =>
    complete ? 'complete' : active ? 'active' : 'pending';

  return [
    { id: 'upload', label: 'Received', description: 'Document accepted and stored.', state: 'complete' },
    {
      id: 'extraction',
      label: 'Extracted',
      description: 'Layout and text converted into chunks.',
      state: state(hasChunks, !hasChunks),
    },
    {
      id: 'embedding',
      label: 'Indexed',
      description: 'Citation-ready chunks embedded for retrieval.',
      state: state(hasEmbeddings, hasChunks),
    },
    {
      id: 'summary',
      label: 'Summarised',
      description: 'Key facts and next actions generated.',
      state: state(hasSummary, hasEmbeddings),
    },
    {
      id: 'routing',
      label: 'Routed',
      description: 'Assigned to an operational work queue.',
      state: state(hasRoute || terminal, hasSummary),
    },
  ];
}
