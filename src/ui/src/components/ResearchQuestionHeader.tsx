type Props = { question: string; explanation: string; readingHint: string };

/** One compact framing block; navigation already identifies the hypothesis and phase. */
export default function ResearchQuestionHeader({ question, explanation, readingHint }: Props) {
  return <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2 border-b border-slate-200 pb-3">
    <div className="min-w-0 flex-1">
      <h2 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">{question}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{explanation}</p>
    </div>
    <p className="max-w-lg rounded-lg bg-teal-50 px-3 py-2 text-xs leading-relaxed text-teal-900"><strong>Read the chart:</strong> {readingHint}</p>
  </div>;
}
