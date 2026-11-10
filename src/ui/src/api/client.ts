import type { AppStatus, Evaluation, Recommendation, UserHistory, ModelStatus, AnalysisResult, JobStatus, AnalysisReadiness, MovieDetails, NotebookNotes, NotebookPrompts, ResearchManifest, NotebookTable, NotebookUserDetail, NotebookRunReadiness } from '../types/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options?.headers },
      });
    } catch {
      throw new ApiError(0, 'Backend is not reachable. Start the app with npm run dev.');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail ?? `Request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  researchAvailability() { return this.request<Record<string, Record<string, string[]>>>('/research/availability'); }
  notebookManifest() { return this.request<ResearchManifest>('/research/phase1/pair-b/manifest'); }
  notebookNotes() { return this.request<NotebookNotes>('/research/phase1/pair-b/notebook/notes'); }
  notebookPrompts() { return this.request<NotebookPrompts>('/research/phase1/pair-b/prompts'); }
  notebookTable(name: string, options: { offset?: number; limit?: number; user_id?: number; genre?: string } = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) if (value !== undefined) params.set(key, String(value));
    return this.request<NotebookTable>(`/research/phase1/pair-b/tables/${encodeURIComponent(name)}?${params}`);
  }
  notebookUserDetail(hypothesis: string, userId: number, runId?: string) {
    const params = new URLSearchParams();
    if (runId) params.set('run_id', runId);
    return this.request<NotebookUserDetail>(`/research/phase1/pair-b/users/${hypothesis}/${userId}?${params}`);
  }
  notebookRunReadiness() { return this.request<NotebookRunReadiness>('/research/phase1/pair-b/run/readiness'); }
  runFullNotebook() { return this.request<JobStatus>('/research/phase1/pair-b/run', { method: 'POST' }); }
  notebookGeneratedResults(runId: string, hypothesis: string) {
    return this.request<AnalysisResult>(`/research/phase1/pair-b/runs/${runId}/results/${hypothesis}`);
  }
  analysisReadiness() { return this.request<Record<string, AnalysisReadiness>>('/analyses/status'); }
  analysisResults(id: string, phase: 1 | 2, pair: 'a' | 'b') {
    return this.request<AnalysisResult>(`/analyses/${id}/results?phase=${phase}&pair=${pair}`);
  }
  runAnalysis(id: string, phase: 1 | 2, pair: 'a' | 'b', options: {
    history_window?: number; attention_layer?: number; attention_head?: number; max_users: number; top_k: number; max_examples: number; seed: number;
  }) {
    return this.request<JobStatus>(`/analyses/${id}/run`, {
      method: 'POST', body: JSON.stringify({ phase, pair, ...options }),
    });
  }
  job(id: string) { return this.request<JobStatus>(`/jobs/${id}`); }
  movieDetails(ids: number[]) { return this.request<MovieDetails>(`/dataset/movies?ids=${ids.join(',')}`); }
  status() { return this.request<AppStatus>('/status'); }
  loadModel() { return this.request<ModelStatus>('/model/load', { method: 'POST' }); }
  history(userId: number, split = 'train') {
    return this.request<UserHistory>(`/dataset/users/${userId}?split=${split}&limit=30`);
  }
  recommend(userId: number) {
    return this.request<Recommendation>('/model/recommend', {
      method: 'POST', body: JSON.stringify({ user_id: userId, top_k: 8 }),
    });
  }
  evaluate() {
    return this.request<Evaluation>('/model/evaluate', {
      method: 'POST', body: JSON.stringify({ split: 'validation', max_users: 100, seed: 42 }),
    });
  }
}

export const api = new ApiClient();
