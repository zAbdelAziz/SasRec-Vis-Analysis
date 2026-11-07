type Tone = 'good' | 'waiting' | 'neutral' | 'danger';

const styles: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  waiting: 'bg-amber-50 text-amber-800 ring-amber-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
};

export default function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${styles[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{label}
    </span>
  );
}
