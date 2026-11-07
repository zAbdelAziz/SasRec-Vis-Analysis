import { create } from 'zustand';

type Phase = 1 | 2;
type Pair = 'a' | 'b';
type AnalysisStore = {
  phase: Phase;
  pair: Pair;
  filters: Record<string, Record<string, string>>;
  selections: Record<string, string | null>;
  setPhase: (phase: Phase) => void;
  setPair: (pair: Pair) => void;
  setFilter: (id: string, field: string, value: string) => void;
  selectExample: (key: string, example: string | null) => void;
};

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  phase: 1,
  pair: 'a',
  filters: {},
  selections: {},
  setPhase: (phase) => set({ phase }),
  setPair: (pair) => set({ pair }),
  setFilter: (id, field, value) => set((state) => ({
    filters: { ...state.filters, [id]: { ...state.filters[id], [field]: value } },
  })),
  selectExample: (key, example) => set((state) => ({ selections: { ...state.selections, [key]: example } })),
}));
