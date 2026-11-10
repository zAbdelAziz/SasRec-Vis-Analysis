# AI-assisted pair — Phase I

This folder contains the rebuilt Phase I analysis using the checkpoint and ID mapping supplied by the shared repository.

## Files

- `phase1_behavior_analysis.ipynb` — end-to-end data audit, full-catalog recommendations, behavior analysis, and plots.
- `../../../ai-interactions/phase1_ai_pair.md` — interaction record for this Phase I workflow.
- `outputs/` — generated plots, user-level analysis tables, recommendation records, and run metadata.

The main Phase I story compares popularity profiles in each user's recent history (up to 20 training interactions), the unseen catalog, and recommendations, alongside the controlled same-second-order sensitivity analysis. Q1–Q5 are five equal-sized item groups ranked by training interaction counts. The user-level paired input/output increase for Q5 is 3.6 percentage points on average (95% bootstrap CI: 3.1–4.1). The genre-profile shift provides a complementary view. Follow-up comparisons examine popularity exposure by recent-history genre diversity and tie-order sensitivity by the size of the latest visible timestamp group. Release-year profiles and sampled-negative hit rates are supporting descriptive and protocol checks, respectively; they are not the main behavioral claims.

The subgroup results are descriptive. Recent-history genre diversity is associated with a larger popularity exposure gap. For tie sensitivity, the subgroup uses the latest timestamp group visible in the training prefix, excluding validation and test events; users with a tied latest group show much larger changes under the reversal stress test. This is not a dose-response by tie size, and the reversal test does not identify the true event order within a timestamp.

The hexbin density plot `q5_user_input_output_density.png` complements the group bars by showing the paired Q5 input/output shares for all users. Recommendations increase Q5's share for 55.0% of users and decrease it for 35.6%, so the average increase does not describe every user.

## Run

From the `SasRec-Vis-Analysis` repository root, install the project Python requirements and upstream model submodule as described in the root README. Then open this notebook in Jupyter. The notebook uses the repository checkpoint and processes the full set of eligible MovieLens users. It does not train or modify the checkpoint.

The sequence audit verifies that timestamp sorting with original raw-file order as the tie-break reproduces the processed interaction sequence. Same-second ties have no recoverable true order. The reversal analysis preserves the visible history item set and recommendation candidate set; it is a sensitivity stress test only.
