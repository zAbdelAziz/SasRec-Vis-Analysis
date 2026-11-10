# AI Reflection Midpoint — Phase I

**AI-aided pair members (first and last names):**  Timur Ibragimov, Ksenia Leontyeva

**Student IDs:** k12127091, k12136772

## Reflection on using generative AI in Phase I

We used gen AI as an active part of our Phase I analysis of SASRec's next-item recommendations on MovieLens-1M dataset. It helped us turn broad interests like popularity bias and genre differences into further questions that can be examined with the model's inputs and outputs. It also helped us to plan visual comparisons and implement code for analyzing recommendations across the full eligible user set.

One of useful contribution was a suggestion to compare three profiles directly: each user's recent interaction history, the movies available to recommend, model's Top-20 recommendations. This made it easy to distinguish model-related shift from patterns already present in users' histories or in the catalog. AI also suggested a per-user density plot, which showed that the average increase in popular-movie share did not apply to every user: the recommendation list had a higher Q5 share for 55.0% of users, the same share for 9.4% and lower share for 35.6%.

AI helped us explore beyond a single aggregate chart. We examined how popularity exposure varied with recent-history genre diversity and how recommendations changed when same-timestamp events were reversed in a stress test. These directions gave us additional views of model behavior, while the notebook and interaction record preserve the analysis steps and decisions.

As was said, AI suggestions still needed careful checking. An early tie-group comparison used timestamp information from the full interaction sequence, including events unavailable in the model's training context. We noticed the mismatch, discarded that result, and recomputed the comparison using only each user's model-visible training prefix. This significantly changed the subgroup result. It reinforced that generated code and interpretations can look plausible while using the wrong data scope. We also revised an unhelpful tie-count grouping and removed a demographic plot whose numeric age axis could be misread.

We treated the model's recommendation outputs more as evidence for descriptive patterns rather than proof of causes. For example, reversal experiment measures sensitivity to an alternative ordering within timestamp ties; it cannot reveal the true order of events recorded at the same second. Similarly, popularity exposure differences do not establish whether users would prefer or benefit from those recommendations. We used user-level summaries and bootstrap intervals to show variation and uncertainty, but those checks do not remove confounding.

Overall, AI made it easier to brainstorm follow-up questions and build richer analyses, but it also created verification work. The most effective practice was to inspect the repository's actual data and model setup, check generated code against the intended cohort and time boundary, reproduce summaries from the notebook, and keep limitations next to each finding. We should retain independent judgment about which suggestions answer our research question and which are only technically possible.

