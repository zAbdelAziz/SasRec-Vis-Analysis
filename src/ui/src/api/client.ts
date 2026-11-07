import type { AppStatus, Evaluation, Recommendation, UserHistory, ModelStatus, AnalysisResult, JobStatus, AnalysisReadiness, MovieDetails } from '../types/api';

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
