export type DatasetStatus = {
  ready: boolean;
  message?: string;
  users?: number;
  items?: number;
  interactions?: number;
  average_history_length?: number;
  min_history_length?: number;
  max_history_length?: number;
  contiguous_user_ids?: boolean;
  contiguous_item_ids?: boolean;
  id_mapping?: string;
  mapping_message?: string;
  missing_metadata_files?: string[];
  raw_metadata?: { present: boolean; ratings_file: boolean; movies_file: boolean; users_file: boolean };
  note?: string;
};

export type ModelStatus = {
  ready: boolean;
  upstream_installed: boolean;
  checkpoint_found: boolean;
  checkpoint: string | null;
  checkpoint_sha256?: string | null;
  configuration: Record<string, number | boolean> | null;
  device: string;
  message: string;
  error: string | null;
  warnings: string[];
};

export type AppStatus = { phase: number; dataset: DatasetStatus; model: ModelStatus };
export type UserHistory = {
  user_id: number;
  split: string;
  total_interactions: number;
  items: number[];
  truncated: boolean;
  id_space: string;
  movie_details?: Array<{ item_id: number; original_movie_id: number; title: string; genres: string[] }>;
};
export type Recommendation = {
  history_length: number;
  candidate_count: number;
  score_type: string;
  id_space: string;
  items: Array<{ rank: number; item_id: number; score: number }>;
};
export type Evaluation = {
  split: string;
  evaluated_users: number;
  hit_at_10: number;
  ndcg_at_10: number;
  negative_candidates: number;
  note: string;
};

export type RawRow = Record<string, unknown>;
export type AnalysisResult = {
  hypothesis: string;
  phase: 1 | 2;
  pair: 'a' | 'b';
  status: string;
  current: boolean;
  n_records: number;
  run_id: string;
  created_at: string;
  config: { history_window?: number; attention_layer?: number; attention_head?: number; max_users: number; top_k: number; max_examples: number; seed: number };
  methods: string[];
  notes: string[];
  records: RawRow[];
  views: Record<string, unknown>;
  examples: RawRow[];
  measures: Record<string, number>;
  provenance: Record<string, unknown>;
};
export type JobStatus = { job_id: string; status: 'queued' | 'running' | 'complete' | 'failed'; error: string | null; run_id?: string; progress?: number; detail?: string };
export type AnalysisReadiness = { ready: boolean; model_ready: boolean; data_ready: boolean; metadata_ready: boolean; requires_metadata: boolean;
  metadata_state?: string; metadata_message?: string; missing_metadata_files?: string[] };
export type MovieDetails = { verified: boolean; items: Array<{ item_id: number; original_movie_id: number; title: string; genres: string[] }> };

export type NotebookNotes = { source: string; cells: Array<{ index: number; markdown: string }> };
export type NotebookPrompts = { source: string; markdown: string };
export type ResearchManifest = { available: boolean; source?: string; tables?: string[]; figures?: string[]; note_cells?: number[]; metadata?: Record<string, unknown>; schema_warnings?: string[] };
export type NotebookTable = { table: string; columns: string[]; total: number; offset: number; limit: number; rows: RawRow[]; source: string };

export type NotebookUserDetail = {
  hypothesis: string; user_id: number; source: string; has_detailed_example: boolean;
  tables: Record<string, RawRow[]>;
};
export type NotebookRunReadiness = {
  ready: boolean; missing_files: string[]; cohort: string; top_k: number; maxlen: number; mode: string;
};
