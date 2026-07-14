import type {
  AuthResponse,
  ChunkRecord,
  ClassificationHistoryEntry,
  DashboardInsights,
  DocumentEntry,
  EventEntry,
  LabelsResponse,
  QAHistoryEntry,
  RoleDefinition,
  RuntimeConfig,
  SearchHistoryEntry,
  UserProfile,
} from '../api/types';

export const IS_STATIC_SHOWCASE = import.meta.env.VITE_STATIC_SHOWCASE === 'true';

const DEMO_SEED_VERSION = 'workspace-v1';
const now = Date.now();
const hoursFromNow = (hours: number) => new Date(now + hours * 60 * 60 * 1000).toISOString();
const minutesFromNow = (minutes: number) => new Date(now + minutes * 60 * 1000).toISOString();

interface DemoDocumentSpec {
  slug: string;
  filename: string;
  docType: string;
  role: string;
  label: string;
  status: string;
  owner: string;
  uploadedHoursAgo: number;
  dueHoursFromNow?: number;
  summary?: string;
  bulletPoints?: string[];
  chunks: string[];
}

const documentSpecs: DemoDocumentSpec[] = [
  {
    slug: 'acme-msa',
    filename: 'Acme Cloud — Master Services Agreement.pdf',
    docType: 'Master Services Agreement',
    role: 'Legal',
    label: 'Commercial Agreement',
    status: 'Ready',
    owner: 'Elena Torres',
    uploadedHoursAgo: 2,
    dueHoursFromNow: 120,
    summary: 'A two-year cloud services agreement with a 60-day renewal notice, annual price protection, and a negotiated liability cap.',
    bulletPoints: [
      'Initial term ends September 30, 2026 and renews automatically for one year.',
      'Written non-renewal notice is required at least 60 days before the term ends.',
      'Aggregate liability is capped at fees paid during the preceding 12 months.',
    ],
    chunks: [
      'The initial service term continues through September 30, 2026. The agreement renews automatically for successive one-year periods unless either party gives written notice at least 60 days before the current term ends.',
      'Subscription fees may increase only once per renewal term and any increase may not exceed three percent. Acme must provide written notice of a proposed increase with the renewal notice.',
      "Except for confidentiality, data protection, and indemnification obligations, each party's aggregate liability is limited to fees paid or payable during the twelve months preceding the event giving rise to the claim.",
      'Customer data remains the exclusive property of Northstar Labs. Acme must return or securely delete customer data within thirty days after termination and provide written confirmation on request.',
    ],
  },
  {
    slug: 'vendor-risk',
    filename: 'Q3 Vendor Risk Review — Atlas Payments.pdf',
    docType: 'Compliance Review',
    role: 'Compliance',
    label: 'Vendor Risk',
    status: 'Needs review',
    owner: 'Maya Chen',
    uploadedHoursAgo: 5,
    dueHoursFromNow: -1,
    chunks: [
      'Atlas Payments completed its SOC 2 Type II audit in May 2026. Two low-severity exceptions concerned delayed access recertification for contractor accounts.',
      'The vendor processes payment metadata in the United States and Ireland. No primary account numbers are stored in the analytics environment.',
      'Open action: obtain evidence that quarterly contractor access reviews were completed by July 10. Compliance owner: Maya Chen.',
      'Residual risk is rated medium until the access-review evidence is accepted. No critical availability, privacy, or financial-control gaps were identified.',
    ],
  },
  {
    slug: 'northstar-invoice',
    filename: 'Northstar Cloud Invoice — June 2026.pdf',
    docType: 'Invoice',
    role: 'Finance',
    label: 'Accounts Payable',
    status: 'Ready',
    owner: 'Jordan Ellis',
    uploadedHoursAgo: 27,
    dueHoursFromNow: 72,
    summary: 'June cloud infrastructure invoice totaling $18,420, including a material increase in GPU compute and a one-time reserved-capacity credit.',
    bulletPoints: [
      'Amount due is $18,420 by July 21, 2026.',
      'GPU compute increased 24% month over month.',
      'A $1,250 reserved-capacity credit was applied.',
    ],
    chunks: [
      'Invoice NS-2026-0617 covers the billing period June 1 through June 30, 2026. Total charges are $19,670 before credits and $18,420 after credits.',
      'GPU compute usage was 8,240 accelerator-hours at a blended cost of $1.42 per hour, an increase of twenty-four percent compared with May.',
      'Reserved-capacity commitment credit: $1,250. Payment terms are net 15 and the payment due date is July 21, 2026.',
      'Cost center allocation: AI Platform 62%, Document Operations 23%, Shared Infrastructure 15%.',
    ],
  },
  {
    slug: 'security-handbook',
    filename: 'Employee Security Handbook — 2026.pdf',
    docType: 'Employee Policy',
    role: 'HR',
    label: 'Security Policy',
    status: 'Ready',
    owner: 'Priya Shah',
    uploadedHoursAgo: 52,
    summary: 'Company-wide security expectations covering device management, data handling, access reviews, and incident reporting.',
    bulletPoints: [
      'Managed devices and phishing-resistant MFA are required for production access.',
      'Suspected incidents must be reported within 30 minutes.',
      'Restricted data may not be copied to personal storage or consumer AI tools.',
    ],
    chunks: [
      'All employees and contractors must use a company-managed device and phishing-resistant multi-factor authentication before accessing production systems.',
      'Suspected security incidents, including accidental disclosure or lost devices, must be reported to the security channel within thirty minutes of discovery.',
      'Restricted customer data must not be copied to personal storage, public paste services, or consumer AI tools. Approved enterprise services must enforce retention controls.',
      'Managers review privileged access quarterly. Access that is no longer required must be removed within one business day of the review decision.',
    ],
  },
  {
    slug: 'incident-runbook',
    filename: 'Production Incident Response Runbook.pdf',
    docType: 'Operations Runbook',
    role: 'Operations',
    label: 'Incident Response',
    status: 'Ready',
    owner: 'Noah Williams',
    uploadedHoursAgo: 126,
    summary: 'Operational playbook for severity assessment, incident command, customer communications, mitigation, and post-incident review.',
    bulletPoints: [
      'SEV-1 incidents require an incident commander and communications lead within 10 minutes.',
      'Customer updates are published at least every 30 minutes.',
      'A blameless review is due within five business days.',
    ],
    chunks: [
      'For a SEV-1 incident, assign an incident commander, operations lead, and communications lead within ten minutes of declaration.',
      'Publish the first customer-facing status update within fifteen minutes. Continue updates at least every thirty minutes until service is restored.',
      'Prefer reversible mitigations such as traffic shaping, feature rollback, or queue isolation. Preserve logs and a timestamped decision record throughout the incident.',
      'The incident commander owns a blameless post-incident review within five business days, including contributing factors, detection gaps, and tracked corrective actions.',
    ],
  },
  {
    slug: 'ai-governance',
    filename: 'AI Governance Research Brief.pdf',
    docType: 'Research Brief',
    role: 'Compliance',
    label: 'AI Governance',
    status: 'Ready',
    owner: 'Maya Chen',
    uploadedHoursAgo: 242,
    summary: 'A practical control framework for evaluating model risk, grounding quality, human review, and auditability in document AI systems.',
    bulletPoints: [
      'High-impact workflows require human approval and traceable source evidence.',
      'Retrieval quality should be evaluated independently from answer quality.',
      'Model, prompt, and index versions belong in the audit record.',
    ],
    chunks: [
      'Document AI controls should be proportional to impact. High-impact decisions require human approval, visible source evidence, and a documented appeal path.',
      'Teams should evaluate retrieval recall independently from answer faithfulness. A fluent answer cannot compensate for missing or irrelevant evidence.',
      'Audit records should include model version, prompt version, index version, retrieved chunk identifiers, reviewer action, and final disposition.',
      'Monitoring should cover citation validity, abstention behavior, latency, cost, drift in document mix, and the rate of human overrides.',
    ],
  },
];

const nextStepsByRole: Record<string, string[]> = {
  Compliance: ['Review open evidence requests and record the final disposition.'],
  Finance: ['Confirm cost-center allocation before approving payment.'],
  HR: ['Share the policy update and track employee acknowledgement.'],
  Legal: ['Calendar the renewal notice deadline and assign an agreement owner.'],
  Operations: ['Validate escalation contacts during the next incident exercise.'],
};

export const STATIC_DOCUMENTS: DocumentEntry[] = documentSpecs.map((spec) => {
  const documentId = `demo-${spec.slug}`;
  const uploadedAt = hoursFromNow(-spec.uploadedHoursAgo);
  const vectorIds = spec.chunks.map((_, index) => `demo-vector-${spec.slug}-${index + 1}`);
  return {
    event_id: `demo-upload-${spec.slug}`,
    document_id: documentId,
    uploaded_at: uploadedAt,
    filename: spec.filename,
    doc_type: spec.docType,
    chunk_count: spec.chunks.length,
    embedded_chunk_count: spec.chunks.length,
    vector_ids: vectorIds,
    assigned_role: spec.role,
    status: spec.status,
    due_at: spec.dueHoursFromNow === undefined ? null : hoursFromNow(spec.dueHoursFromNow),
    metadata: {
      assigned_role: spec.role,
      status: spec.status,
      due_at: spec.dueHoursFromNow === undefined ? null : hoursFromNow(spec.dueHoursFromNow),
      owner: spec.owner,
      page_count: spec.chunks.length,
      label: spec.label,
      demo_content: true,
      demo_seed: DEMO_SEED_VERSION,
    },
    summary: spec.summary
      ? {
          summary: spec.summary,
          bullet_points: spec.bulletPoints ?? [],
          next_steps: nextStepsByRole[spec.role] ?? [],
          source_chunk_count: spec.chunks.length,
          doc_type: spec.docType,
          filename: spec.filename,
          document_id: documentId,
          generated_at: new Date(new Date(uploadedAt).getTime() + 8 * 60 * 1000).toISOString(),
        }
      : null,
  };
});

export const STATIC_CHUNKS: Record<string, ChunkRecord[]> = Object.fromEntries(
  documentSpecs.map((spec) => [
    `demo-${spec.slug}`,
    spec.chunks.map((contents, index) => ({
      id: `demo-vector-${spec.slug}-${index + 1}`,
      contents,
      metadata: {
        document_id: `demo-${spec.slug}`,
        filename: spec.filename,
        original_filename: spec.filename,
        doc_type: spec.docType,
        assigned_role: spec.role,
        chunk_index: index + 1,
        page_number: index + 1,
        demo_seed: DEMO_SEED_VERSION,
      },
    })),
  ]),
);

interface DemoQuestionSpec {
  slug: string;
  filename: string;
  query: string;
  answer: string;
  reasoning: string;
  confidence: number;
  chunkIndexes: number[];
  minutesAgo: number;
}

const questionSpecs: DemoQuestionSpec[] = [
  {
    slug: 'vendor-risk',
    filename: 'Q3 Vendor Risk Review — Atlas Payments.pdf',
    query: 'What evidence is still required before Atlas Payments can be approved?',
    answer: 'Obtain evidence that the quarterly contractor access reviews were completed by July 10. Until Compliance accepts that evidence, the residual vendor risk remains medium.',
    reasoning: 'The open action requests contractor access-review evidence, and the risk section makes acceptance of that evidence the condition for closing the medium residual risk.',
    confidence: 0.94,
    chunkIndexes: [3, 4],
    minutesAgo: 35,
  },
  {
    slug: 'northstar-invoice',
    filename: 'Northstar Cloud Invoice — June 2026.pdf',
    query: 'How much is due, when is it due, and what explains the change?',
    answer: 'Northstar owes $18,420 by July 21, 2026. GPU compute increased 24% month over month, while a $1,250 reserved-capacity credit reduced the final amount.',
    reasoning: 'The usage section explains the GPU increase, and the payment section gives the applied credit and due date.',
    confidence: 0.97,
    chunkIndexes: [2, 3],
    minutesAgo: 44,
  },
  {
    slug: 'security-handbook',
    filename: 'Employee Security Handbook — 2026.pdf',
    query: 'What should an employee do after discovering a suspected security incident?',
    answer: 'Report it to the security channel within 30 minutes of discovery. The rule covers suspected incidents, accidental disclosure, and lost devices.',
    reasoning: 'The incident-reporting policy specifies both the reporting destination and the 30-minute deadline.',
    confidence: 0.98,
    chunkIndexes: [2],
    minutesAgo: 55,
  },
  {
    slug: 'incident-runbook',
    filename: 'Production Incident Response Runbook.pdf',
    query: 'What are the first coordination and communication steps for a SEV-1?',
    answer: 'Assign an incident commander, operations lead, and communications lead within 10 minutes. Publish the first customer update within 15 minutes, then update at least every 30 minutes until recovery.',
    reasoning: 'The opening runbook steps define the response roles and the customer-communication cadence.',
    confidence: 0.95,
    chunkIndexes: [1, 2],
    minutesAgo: 63,
  },
  {
    slug: 'ai-governance',
    filename: 'AI Governance Research Brief.pdf',
    query: 'What evidence should be retained to audit an AI-assisted document decision?',
    answer: 'Retain the model, prompt, and index versions; the retrieved chunk identifiers; the reviewer action; and the final disposition.',
    reasoning: 'The auditability section lists the technical versions, retrieved evidence, and human decision record that make a result reproducible.',
    confidence: 0.96,
    chunkIndexes: [3],
    minutesAgo: 70,
  },
  {
    slug: 'acme-msa',
    filename: 'Acme Cloud — Master Services Agreement.pdf',
    query: 'When do we need to give notice if we do not want the Acme agreement to renew?',
    answer: "Send written non-renewal notice no later than August 1, 2026. The agreement requires at least 60 days' notice before the September 30 term end.",
    reasoning: 'The renewal clause states both the term end date and the 60-day notice requirement.',
    confidence: 0.96,
    chunkIndexes: [1],
    minutesAgo: 78,
  },
];

export const STATIC_QA_HISTORY: QAHistoryEntry[] = questionSpecs.map((spec) => {
  const citations = spec.chunkIndexes.map(
    (chunkIndex) => `${spec.filename} · page ${chunkIndex} · chunk ${chunkIndex}`,
  );
  return {
    event_id: `demo-qa-${spec.slug}`,
    created_at: minutesFromNow(-spec.minutesAgo),
    query: spec.query,
    answer: spec.answer,
    reasoning: spec.reasoning,
    confidence: spec.confidence,
    citations,
    chunk_references: spec.chunkIndexes.map((chunkIndex, index) => ({
      reference: citations[index],
      document_id: `demo-${spec.slug}`,
      filename: spec.filename,
      chunk_index: chunkIndex,
    })),
  };
});

export const STATIC_SEARCH_HISTORY: SearchHistoryEntry[] = [
  {
    event_id: 'demo-search-upcoming-deadlines',
    created_at: minutesFromNow(-42),
    query: 'documents with upcoming renewal or payment deadlines',
    filters: {},
    limit: 5,
    result_count: 2,
    results_truncated: false,
    results: [
      { ...STATIC_CHUNKS['demo-acme-msa'][0], distance: 0.12 },
      { ...STATIC_CHUNKS['demo-northstar-invoice'][0], distance: 0.19 },
    ],
  },
];

export const STATIC_EVENTS: EventEntry[] = [
  {
    id: STATIC_SEARCH_HISTORY[0].event_id,
    created_at: STATIC_SEARCH_HISTORY[0].created_at,
    updated_at: STATIC_SEARCH_HISTORY[0].created_at,
    data: { event_type: 'search_query', query: STATIC_SEARCH_HISTORY[0].query },
  },
  {
    id: STATIC_QA_HISTORY[0].event_id,
    created_at: STATIC_QA_HISTORY[0].created_at,
    updated_at: STATIC_QA_HISTORY[0].created_at,
    data: { event_type: 'qa_query', query: STATIC_QA_HISTORY[0].query },
  },
  ...STATIC_DOCUMENTS.slice(0, 3).map<EventEntry>((document) => ({
    id: document.event_id,
    created_at: document.uploaded_at,
    updated_at: document.uploaded_at,
    data: {
      event_type: 'document_upload',
      filename: `data/demo/${document.filename}`,
      metadata: { uploaded_filename: document.filename },
    },
  })),
];

export const STATIC_CLASSIFICATION_HISTORY: Record<string, ClassificationHistoryEntry[]> = Object.fromEntries(
  documentSpecs.map((spec) => [
    `demo-${spec.slug}`,
    [
      {
        id: `demo-classification-${spec.slug}`,
        document_id: `demo-${spec.slug}`,
        label_name: spec.label,
        confidence: 0.91,
        source: 'ai',
        classifier_version: 'demo-fixture-v1',
        notes: 'Synthetic classification included with the showcase workspace.',
        metadata: { demo_seed: DEMO_SEED_VERSION, role: spec.role },
        created_at: hoursFromNow(-spec.uploadedHoursAgo + 7 / 60),
      },
    ],
  ]),
);

const roleDefinitions: Record<string, RoleDefinition> = {
  admin: { label: 'Admin', access_level: 'full', description: 'Manages users, roles, settings, and integrations.', permissions: 'Manage all documents, users, system config, and API keys.' },
  analyst: { label: 'Analyst', access_level: 'standard', description: 'Processes, validates, and queries documents.', permissions: 'Upload, view, run QA, approve summaries, and export results.' },
  reviewer: { label: 'Reviewer', access_level: 'limited', description: 'Verifies and audits existing documents.', permissions: 'Review AI outputs, approve decisions, and add notes.' },
  manager: { label: 'Manager', access_level: 'read-heavy', description: 'Monitors documents, queues, and performance.', permissions: 'View metrics, summaries, and team performance data.' },
  developer: { label: 'Developer', access_level: 'technical', description: 'Integrates APIs and monitors pipelines.', permissions: 'Access API settings, logs, and technical diagnostics.' },
  viewer: { label: 'Viewer / Guest', access_level: 'minimal', description: 'Explores the public showcase workspace.', permissions: 'Read-only access to synthetic showcase data.' },
};

export const STATIC_RUNTIME_CONFIG: RuntimeConfig = {
  app_name: 'DocuLens AI',
  summary_chunk_limit: 8,
  qa_top_k: 5,
  search_result_limit: 10,
  search_preview_limit: 3,
  chunk_preview_limit: 8,
  auth_required: false,
  showcase_read_only: true,
  showcase_data_source: 'synthetic',
  api_key_header: 'X-API-Key',
  persona_options: ['analyst', 'manager', 'reviewer', 'developer', 'executive'],
  role_definitions: roleDefinitions,
};

export const STATIC_DASHBOARD_INSIGHTS: DashboardInsights = {
  total_documents: 6,
  summarised_documents: 5,
  chunk_count: 24,
  embedded_count: 24,
  queue_latency: '8m',
  estimated_savings: 1040,
  hours_saved: 16,
  analyst_rate: 65,
  sla_risk_count: 1,
  sla_risk_message: '1 review is approaching SLA.',
  throughput_series: [
    { label: 'Wed', value: 2 },
    { label: 'Thu', value: 5 },
    { label: 'Fri', value: 4 },
    { label: 'Sat', value: 1 },
    { label: 'Sun', value: 2 },
    { label: 'Mon', value: 6 },
    { label: 'Tue', value: 8 },
  ],
  compliance_series: [
    { label: 'Legal', value: 96 },
    { label: 'Finance', value: 92 },
    { label: 'Compliance', value: 84 },
    { label: 'HR', value: 98 },
    { label: 'Operations', value: 94 },
  ],
  delta_processed: '+100%',
  delta_processed_tone: 'positive',
  delta_summaries: '0%',
  delta_summaries_tone: 'neutral',
  today_total: 2,
  today_summaries: 1,
  yesterday_total: 1,
  yesterday_summaries: 1,
};

const domains = [...new Set(documentSpecs.map((spec) => spec.role))].sort();
export const STATIC_LABELS: LabelsResponse = {
  tree: domains.map((domain) => ({
    id: `demo-domain-${domain.toLowerCase()}`,
    name: domain,
    type: 'domain',
    description: `Synthetic ${domain.toLowerCase()} workspace`,
    children: documentSpecs
      .filter((spec) => spec.role === domain)
      .map((spec) => ({
        id: `demo-label-${spec.slug}`,
        name: spec.label,
        type: 'label',
        description: `Showcase label for ${spec.docType.toLowerCase()} documents`,
        parent_id: `demo-domain-${domain.toLowerCase()}`,
        children: [],
      })),
  })),
  candidate_labels: [...new Set(documentSpecs.map((spec) => spec.label))].sort(),
};

export const STATIC_USER: UserProfile = {
  id: 'demo-viewer',
  email: 'viewer@demo.doculens.ai',
  full_name: 'Demo Viewer',
  persona: 'manager',
  role: 'viewer',
  access_level: 'minimal',
};

export const STATIC_AUTH_RESPONSE: AuthResponse = {
  access_token: 'static-showcase-token',
  token_type: 'bearer',
  user: STATIC_USER,
  personas: STATIC_RUNTIME_CONFIG.persona_options ?? [],
  roles: roleDefinitions,
};
