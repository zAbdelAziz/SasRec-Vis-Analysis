import type { AnalysisResult, RawRow } from '../types/api';
export type VizProps = {
  result: AnalysisResult;
  scope: string;
  onPick: (record: RawRow, keys: string[]) => void;
};
