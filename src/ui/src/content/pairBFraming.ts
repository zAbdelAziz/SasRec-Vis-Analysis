/** Brief chart reading guidance; the full research notes are served unchanged from their source. */
export const pairBFraming: Record<string, { question: string; explanation: string; readingHint: string }> = {
  h1: {
    question: 'How does SASRec change the genres in users\' Top-20 recommendations?',
    explanation: 'Across 6,040 users, compare each genre\'s share in the latest 20 training interactions with its share in the Top-20 recommendations. Each user contributes equally to the average.',
    readingHint: 'Right of zero means a genre gained share; left means it lost share. Horizontal intervals show 95% user-bootstrap confidence intervals.',
  },
  h4: {
    question: 'Does SASRec expose users to more popular movies?',
    explanation: 'Compare popularity in recent histories, eligible unseen movies, and Top-20 recommendations. The five popularity groups contain approximately equal numbers of movies, ordered by training interaction counts.',
    readingHint: 'The grouped bars compare distributions. In the user-level density plot, points above the diagonal mean more popular movies in recommendations than in history.',
  },
  h5: {
    question: 'How much do recommendations change when same-second interactions are reordered?',
    explanation: 'Reverse the order of movies sharing a timestamp inside each visible training history, without changing the movies or candidate set. Then compare the original and reordered Top-20 lists.',
    readingHint: 'Higher rank dissimilarity means larger ranking changes. The membership chart shows how often the set of recommended movies changes.',
  },
};
