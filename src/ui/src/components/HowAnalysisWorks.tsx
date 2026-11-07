import type { Hypothesis } from '../content/hypotheses';
import type { AnalysisResult } from '../types/api';

type Props = { hypothesis: Hypothesis; phase: 1 | 2; result: AnalysisResult | null };

const phaseOneMethod: Record<string, string[]> = {
  h1: [
    'Each movie shares one unit equally among its genres. For each user, the most common historical genre is compared with that genre’s share in recommendations.',
    'The difference is in percentage points: 40% recommended vs 25% historical means +15 pp, not a 15% relative increase.',
    'User-level changes describe representation, not recommendation quality or the reason for a change.',
  ],
  h2: [
    'Each arrow joins the mean release year in a user’s selected history window to the mean release year in their recommendations.',
    'The selected user’s decade bars show history, recommendations, and all eligible unseen movies. Movies without known years are excluded.',
    'Changing the history window changes the comparison, not the recommendations. Later release years are relative to the historical MovieLens catalog.',
  ],
  h3: [
    'Each gray dot shows average historical genre share, and each diamond shows average recommended share for one age-and-gender group.',
    'The connection describes the change. The 95% bootstrap interval in the hover details applies to the difference, not to either endpoint.',
    'Age and gender label groups; they are not SASRec inputs. Differences between groups are descriptive and not causal.',
  ],
};
const phaseTwoMethod: Record<string, string[]> = {
  h1: [
    'The left chart compares shared-genre and disjoint-genre movie pairs at matched historical distances within each user; it excludes self-pairs.',
    'The right matrix uses raw non-self attention with fractional genre membership. Gray cells have no supporting observations, not zero attention.',
    'Attention depends on sequence position, available keys and padding. This is an internal diagnostic, not a causal explanation.',
  ],
  h2: [
    'The learned final contextual representation is compared with eligible movie embeddings by release decade. Cosine similarity measures direction.',
    'The score-advantage chart subtracts the movie-count-weighted mean score across eligible known-year candidates. Scores also depend on embedding magnitudes; neither chart proves a causal release-year effect.',
  ],
  h3: [
    'Each genre reference is a post-hoc centroid of normalized trained item embeddings, using verified fractional genre membership; the model does not directly learn named genre parameters.',
    'For each user we calculate cosine similarity of the final contextual state to every genre reference, then subtract that user’s average cosine. Group intervals resample users.',
    'For the same Phase I cohort, final-position SASRec attention is attributed fractionally to earlier movie genres. The main excess measure compares raw non-self attention to historical genre exposure, retaining self and padding mass separately.',
    'An optional leave-one-user-out position reference checks whether genre effects persist against the attention pattern at the same distance in other users. Both references are descriptive, not causal.',
    'Group 95% intervals bootstrap users. Internal cosine alignment, attention probability mass and Phase I genre-share changes use different units; do not read one as another.',
  ],
};

export default function HowAnalysisWorks({ hypothesis, phase, result }: Props) {
  const details = (phase === 1 ? phaseOneMethod : phaseTwoMethod)[hypothesis.id] ?? [];
  return <div className="space-y-3 text-sm leading-relaxed text-slate-600">
    <p>{phase === 1 ? hypothesis.phaseOne : hypothesis.phaseTwo}</p>
    <ul className="list-disc space-y-1.5 pl-5">
      {details.map((entry) => <li key={entry}>{entry}</li>)}
    </ul>
    <div className="border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold text-slate-800">Data and limitations</p>
      <p className="mt-1 text-xs">{hypothesis.dataRequired.join(' · ')}</p>
      <p className="mt-2 text-xs text-amber-800">{hypothesis.caution}</p>
      {!!result?.notes?.length && <div className="mt-3 space-y-1.5 border-l-2 border-amber-200 pl-3 text-xs text-slate-600">
        {result.notes.map((note) => <p key={note}>{note}</p>)}
      </div>}
    </div>
  </div>;
}
