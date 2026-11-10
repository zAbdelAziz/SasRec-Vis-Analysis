import { useState, type ReactNode } from 'react';

/** Display source Markdown without rewriting it; raw mode preserves every character. */
function inline(source: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const tokens = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  for (const match of source.matchAll(tokens)) {
    const pos = match.index ?? 0;
    if (pos > last) parts.push(source.slice(last, pos));
    const value = match[0];
    if (value.startsWith('**')) parts.push(<strong key={pos}>{value.slice(2, -2)}</strong>);
    else if (value.startsWith('`')) parts.push(<code key={pos} className="rounded bg-slate-100 px-1 font-mono text-[.9em]">{value.slice(1, -1)}</code>);
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(value);
      if (link && /^https?:\/\//.test(link[2])) parts.push(<a key={pos} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline">{link[1]}</a>);
      else parts.push(value);
    }
    last = pos + value.length;
  }
  if (last < source.length) parts.push(source.slice(last));
  return parts;
}

export default function ResearchMarkdown({ markdown }: { markdown: string }) {
  const [raw, setRaw] = useState(false);
  const lines = markdown.split('\n');
  return <div className="min-w-0 text-sm leading-relaxed text-slate-700">
    <div className="mb-3 flex justify-end">
      <button type="button" className="text-xs font-semibold text-teal-700 underline" onClick={() => setRaw(!raw)}>
        {raw ? 'Formatted view' : 'View exact Markdown source'}
      </button>
    </div>
    {raw ? <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{markdown}</pre>
      : <div className="space-y-1">
          {lines.map((line, index) => {
            const heading = /^(#{1,6})\s+(.*)$/.exec(line);
            if (heading) {
              const entry = /^Entry ([1-5])\b/.exec(heading[2]);
              return <p key={index} id={entry ? `prompt-entry-${entry[1]}` : undefined} className={`${heading[1].length < 3 ? 'mt-5 text-base' : 'mt-3 text-sm'} font-bold text-slate-900`}>{inline(heading[2])}</p>;
            }
            if (!line.trim()) return <div key={index} className="h-2" aria-hidden="true" />;
            if (/^\s*[-*]\s+/.test(line)) return <p key={index} className="pl-4 before:mr-2 before:content-['•']">{inline(line.replace(/^\s*[-*]\s+/, ''))}</p>;
            if (/^>\s?/.test(line)) return <blockquote key={index} className="border-l-2 border-teal-200 pl-3 italic">{inline(line.replace(/^>\s?/, ''))}</blockquote>;
            return <p key={index} className="whitespace-pre-wrap break-words">{inline(line)}</p>;
          })}
        </div>}
  </div>;
}
