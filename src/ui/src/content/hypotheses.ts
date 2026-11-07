export type Hypothesis = {
  id: string;
  short: string;
  title: string;
  question: string;
  hypothesis: string;
  phaseOne: string;
  phaseTwo: string;
  plannedView: string;
  dataRequired: string[];
  caution: string;
  accent: string;
};

export const hypotheses: Hypothesis[] = [
  {
    id: 'h1', short: 'Genre representation', title: 'How do genres shape recommendations and attention?',
    question: 'Are dominant historical genres amplified in recommendations, and do movies sharing genres receive higher attention?',
    hypothesis: 'SASRec disproportionately represents dominant recent-history genres in Top-K recommendations while underrepresenting minority genres. Internally, same-genre movie pairs may receive higher average attention.',
    phaseOne: 'Explore changes in each user’s most common historical genre, then inspect genre-by-genre shares and the actual recommended movies.',
    phaseTwo: 'Compare shared-genre versus different-genre attention within matched sequence distances, then inspect directional genre-pair attention and individual histories.',
    plannedView: 'Phase I: user-level genre changes and detailed genre comparisons. Phase II: distance-matched attention differences, directional genre heatmap, and chronological inspection.',
    dataRequired: ['Training interactions', 'Verified movie genres', 'Trained SASRec attention', 'Full-catalog recommendations'],
    caution: 'Historical shares are reference profiles. Position, genre frequency, and causal accessibility affect attention; neither hypothesis is assumed true.',
    accent: '01',
  },
  {
    id: 'h2', short: 'Movie release years', title: 'Older movies in, newer movies out?',
    question: 'If a user mostly rates older movies, does SASRec keep recommending newer ones?',
    hypothesis: 'Users whose histories contain older movies may receive recommendations shifted toward newer release years.',
    phaseOne: 'Compare average release years across users, then inspect a selected user’s history, recommendations, and available-catalog decade distribution.',
    phaseTwo: 'Inspect how closely unseen movies from each decade align with the user’s final model representation, alongside their scores and embedding magnitudes.',
    plannedView: 'Phase I: release-year arrows and the selected user’s decade distribution. Phase II: coordinated cosine-alignment and ranking-score-advantage charts.',
    dataRequired: ['Training histories', 'Verified release years and genres', 'Full-catalog predictions'],
    caution: 'Newer means newer within MovieLens, not today. Release-year shifts do not establish dissatisfaction or a causal year bias.',
    accent: '02',
  },
  {
    id: 'h3', short: 'Age × gender', title: 'Who gets more of each genre?',
    question: 'Do different age and gender groups receive different genre mixes compared with their histories?',
    hypothesis: 'SASRec may amplify or suppress historical genre preferences differently across demographic groups, even among users with comparable historical preferences.',
    phaseOne: 'Choose a genre to see how its average historical and recommended shares compare across age and gender groups. Select a group to inspect its genre changes and examples.',
    phaseTwo: 'Compare learned user-state genre alignment and actual final-query self-attention to historical genres across age and gender groups.',
    plannedView: 'Phase I: male/female history-vs-recommendation panels with linked genre changes. Phase II: demographic learned-genre alignment, actual genre-attention excess, and same-cohort Phase I comparisons.' ,
    dataRequired: ['Verified age, gender, and movie metadata', 'Training histories', 'Full-catalog recommendations'],
    caution: 'Age and gender are subgroup attributes, not model inputs. Binning one genre share does not control the full history; group differences are descriptive, not causal.',
    accent: '03',
  },
];

export const hypothesisById = new Map(hypotheses.map((hypothesis) => [hypothesis.id, hypothesis]));
