import type { RawRow } from '../types/api';

export const rows = (value: unknown): RawRow[] =>
  Array.isArray(value) ? value.filter((row): row is RawRow => !!row && typeof row === 'object') : [];
export const num = (row: RawRow, key: string, fallback = 0): number =>
  Number.isFinite(Number(row[key])) ? Number(row[key]) : fallback;
export const str = (row: RawRow, key: string, fallback = ''): string =>
  row[key] === undefined || row[key] === null ? fallback : String(row[key]);
export const arrayNum = (value: unknown): number[] =>
  Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
export const mean = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
export const unique = (values: string[]): string[] => [...new Set(values)].sort();
export const formatNum = (value: number, digits = 3) => Number.isFinite(value) ? value.toFixed(digits) : '-';
export const findExample = (examples: RawRow[], record: RawRow, keys: string[]): RawRow | undefined =>
  examples.find((example) => keys.every((key) => String(example[key]) === String(record[key])));
export const asRows = (row: RawRow, key: string): RawRow[] => rows(row[key]);
export const historyIds = (row: RawRow, key: string): number[] => arrayNum(row[key]);
export const entries = (value: unknown): Array<[string, number]> =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    Object.entries(value).map(([name, count]) => [name, Number(count)] as [string, number]).filter(([, count]) => Number.isFinite(count)) : [];
