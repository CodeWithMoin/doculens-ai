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

export interface RuntimeConfig {
  app_name: string;
  summary_chunk_limit: number;
  qa_top_k: number;
  search_result_limit: number;
  search_preview_limit: number;
  chunk_preview_limit: number;
  auth_required: boolean;
  api_key_header: string;
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
