export interface DocumentSummary {
  summary: string;
  bullet_points: string[];
  next_steps?: string[] | null;
  source_chunk_count?: number;
  doc_type?: string | null;
  filename?: string | null;
  document_id?: string | null;
  generated_at?: string | null;
}

export interface DocumentEntry {
  event_id: string;
  document_id: string;
  uploaded_at: string;
  filename?: string | null;
  doc_type?: string | null;
  chunk_count?: number | null;
  embedded_chunk_count?: number | null;
  vector_ids?: string[] | null;
  metadata?: Record<string, unknown> | null;
  summary?: DocumentSummary | null;
  assigned_role?: string | null;
  status?: string | null;
  due_at?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  restored_at?: string | null;
}

export interface ChunkRecord {
  id: string;
  metadata: Record<string, unknown>;
  contents: string;
}

export interface SearchResult {
  id: string;
  contents: string;
  distance?: number | null;
  metadata: Record<string, unknown>;
}

export interface SearchHistoryEntry {
  event_id: string;
  created_at: string;
  query: string;
  filters: Record<string, unknown>;
  limit: number;
  result_count: number;
  results: SearchResult[];
  results_truncated: boolean;
}

export interface QAHistoryEntry {
  event_id: string;
  created_at: string;
  query: string;
  answer?: string | null;
  reasoning?: string | null;
  confidence?: number | null;
  citations: string[];
  chunk_references: Array<{
    reference: string;
    document_id?: string | null;
    filename?: string | null;
    chunk_index?: number | null;
  }>;
}

export interface ApiError extends Error {
  status?: number;
  payload?: unknown;
}

export interface EventResponse {
  message: string;
  event_id: string;
  task_id: string;
  event_type?: string;
}

export interface UploadResponse extends EventResponse {
  original_filename: string;
  stored_path: string;
}

export interface RoleDefinition {
  label: string;
  access_level: string;
  description: string;
  permissions: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  persona: string;
  role: string;
  access_level: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
  personas: string[];
  roles: Record<string, RoleDefinition>;
}

export interface ClassificationScore {
  label: string;
  score: number;
}

export interface DocumentClassificationResponse {
  document_id: string;
  predicted_label: string;
  confidence: number;
  scores: ClassificationScore[];
  candidate_labels: string[];
  used_text_preview: string;
  reasoning?: string;
}

export interface DocumentClassificationRequest {
  candidate_labels?: string[];
  hypothesis_template?: string;
  multi_label?: boolean;
  text_override?: string;
  examples?: Array<{
    label: string;
    text: string;
  }>;
}

export interface LabelTreeNode {
  id: string | null;
  name: string;
  type: 'domain' | 'label';
  description?: string | null;
  parent_id?: string | null;
  workspace_id?: string | null;
  children: LabelTreeNode[];
}

export interface LabelsResponse {
  tree: LabelTreeNode[];
  candidate_labels: string[];
}

export interface LabelRequestPayload {
  label_name: string;
  description?: string;
  parent_label_id?: string | null;
  label_type?: 'domain' | 'label';
}

export interface LabelResponse {
  id: string;
  label_name: string;
  label_type: 'domain' | 'label';
  description?: string | null;
  parent_label_id?: string | null;
  workspace_id?: string | null;
}

export interface ClassificationHistoryEntry {
  id: string;
  document_id: string;
  label_name: string;
  confidence?: number;
  source: string;
  classifier_version?: string;
  user_id?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ClassificationOverrideRequest {
  label_name: string;
  confidence?: number;
  notes?: string;
}

export interface DocumentLifecycleResponse {
  document_id: string;
  status: string;
  archived_at?: string | null;
  deleted_at?: string | null;
  restored_at?: string | null;
  message?: string;
}

export interface RuntimeConfig {
  app_name: string;
  summary_chunk_limit: number;
  qa_top_k: number;
  search_result_limit: number;
  search_preview_limit: number;
  chunk_preview_limit: number;
  auth_required: boolean;
  api_key_header: string;
  persona_options?: string[];
  role_definitions?: Record<string, RoleDefinition>;
}

export interface DashboardInsights {
  total_documents: number;
  summarised_documents: number;
  chunk_count: number;
  embedded_count: number;
  queue_latency: string;
  estimated_savings: number;
  hours_saved: number;
  analyst_rate: number;
  sla_risk_count: number;
  sla_risk_message: string;
  throughput_series: Array<{ label: string; value: number }>;
  compliance_series: Array<{ label: string; value: number }>;
  delta_processed: string;
  delta_processed_tone: 'positive' | 'negative' | 'neutral';
  delta_summaries: string;
  delta_summaries_tone: 'positive' | 'negative' | 'neutral';
  today_total: number;
  today_summaries: number;
  yesterday_total: number;
  yesterday_summaries: number;
}
