/** Values in saved analysis JSON are proportions. Convert only for display. */
export const asPercent = (share: number) => 100 * share;
export const asPercentagePoints = (difference: number) => 100 * difference;
export const percentLabel = (share: number, digits = 1) => `${asPercent(share).toFixed(digits)}%`;
export const ppLabel = (difference: number | null | undefined, digits = 1) =>
  difference == null || !Number.isFinite(difference) ? 'Not estimated' :
    `${difference > 0 ? '+' : ''}${asPercentagePoints(difference).toFixed(digits)} pp`;
export const ppValueLabel = (value: number, digits = 1) =>
  `${value > 0 ? '+' : ''}${value.toFixed(digits)} pp`;
export const meanOf = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
export const relativeYearLabel = (value: number) =>
  Math.abs(value) < 0.05 ? 'Approximately unchanged' :
    `${Math.abs(value).toFixed(1)} years ${value > 0 ? 'newer' : 'older'}`;
export const CHANGE_COLORS = { increase: '#0f766e', decrease: '#c26b24', baseline: '#64748b', muted: '#dce5eb' } as const;
/** Use category colors when hue distinguishes groups, not positive/negative outcomes. */
export const GROUP_COLORS = ['#0f766e', '#4f46e5'] as const;
