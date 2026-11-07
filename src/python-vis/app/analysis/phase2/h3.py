"""H3 Phase II: learned genre alignment AND final-query genre attention.

Both signals come from the frozen trained SASRec. Age and gender are used
only after extraction to describe subgroups, never as network inputs.
"""
from app.analysis.phase2.base import BaseInternalAnalysis
from app.core.representation_genres import (
    genre_reference_vectors, user_genre_alignment, alignment_group_summaries,
)
from app.core.attention_genres import (
    final_query_genre_attention, leave_one_user_out_position_excess,
    attention_group_summaries, snapshot_preview,
)
from app.core.genre_analysis import movie_lookup
from app.explain.attention import AttentionExtractor


class H3Internal(BaseInternalAnalysis):
    hypothesis = 'h3'
    requires_metadata = True
    methods = [
        'Verified-metadata, fractional-genre, post-hoc centroids from frozen learned movie embeddings',
        'Training-only final contextual states, with per-user relative cosine alignment',
        'Actual selected-layer, selected-head last-query causal attention probabilities',
        'Non-self attention mass by genre minus equal-exposure mass from real historical keys',
        'Optional leave-one-user-out, cohort lag-profile reference for position sensitivity',
        'Age-by-gender user-bootstrap 95% intervals (2,000 draws)',
    ]

    def run(self, config):
        # Do not silently publish 'representation + attention' results when the
        # checkpoint architecture cannot expose genuine attention probabilities.
        extractor = AttentionExtractor(self.ranker.model)
        original = self.prepare(config)  # Exact H3 Phase I user cohort/config.
        embeddings = self.ranker.model.require_ready().item_emb.weight.detach().cpu().numpy()
        centroids, support = genre_reference_vectors(embeddings, self.data.genres)
        labels = sorted(centroids)
        examples_by_id = {int(row['user_id']): row for row in original['examples']}
        movies = movie_lookup(self.data)
        users, collected, saved_previews = [], [], {}
        for index, entry in enumerate(original['views']['users']):
            user_id = int(entry['user_id'])
            history = self.data.history(user_id)
            final = self.reps.snapshot(history)['final']
            alignment = user_genre_alignment(final, centroids)
            snapshot = extractor.snapshot(history, config.attention_layer, config.attention_head)
            attribution = final_query_genre_attention(snapshot, self.data.genres, labels)
            row = {
                'user_id': user_id, 'age_code': entry['age_code'],
                'age_label': entry['age_label'], 'gender': entry['gender'],
                'history_length': len(history), 'model_history_length': len(snapshot['items']),
                'history_profile': entry['history_profile'],
                'recommendation_profile': entry['recommendation_profile'],
                'phase1_delta': entry['amplification'],
                'cosine': alignment['cosine'], 'relative_alignment': alignment['relative'],
                'user_cosine_baseline': alignment['user_baseline'],
                'attention_mass': attribution['attention_mass'],
                'attention_expected_mass': attribution['expected_mass'],
                'attention_excess': attribution['attention_excess'],
                'conditional_excess': attribution['conditional_excess'],
                'historical_key_exposure': attribution['historical_exposure'],
                'conditional_attention_share': attribution['conditional_attention_share'],
                'attention_self_mass': attribution['self_mass'],
                'attention_padding_mass': attribution['padding_mass'],
                'attention_nonself_mass': attribution['nonself_mass'],
                'attention_key_count': attribution['position_count'],
                'attention_normalization_error': attribution['row_normalization_error'],
            }
            users.append(row)
            collected.append(attribution)
            if user_id in examples_by_id:
                saved_previews[user_id] = snapshot_preview(
                    snapshot, attribution['nonself_weights'], movies)
            # Do not retain each user’s dense sequence-by-sequence matrix.
            # The final-query weights and genre memberships suffice for the
            # leave-one-user-out lag reference; preview keys remain bounded.
            if getattr(self, 'progress', None):
                self.progress(index+1, len(original['views']['users']),
                              'Extracting learned geometry and last-query causal attention')

        # A lag reference is estimated from *other* users, rather than using the
        # same sequence's own attention, which would make every residual zero.
        position_checks = leave_one_user_out_position_excess(collected, labels)
        for row, reference in zip(users, position_checks):
            row['position_excess'] = reference['position_excess']
            row['position_reference_available'] = reference['position_reference_available']
            row['position_reference_users_min'] = reference['position_reference_users_min']

        records = []
        for row in users:
            for genre in labels:
                records.append({
                    'user_id': row['user_id'], 'age_code': row['age_code'],
                    'age_label': row['age_label'], 'gender': row['gender'],
                    'genre': genre, 'history_share': float(row['history_profile'].get(genre, 0)),
                    'recommendation_share': float(row['recommendation_profile'].get(genre, 0)),
                    'phase1_delta': float(row['phase1_delta'].get(genre, 0)),
                    'relative_alignment': float(row['relative_alignment'][genre]),
                    'raw_cosine': float(row['cosine'][genre]),
                    'attention_excess': float(row['attention_excess'][genre]),
                    'position_excess': (None if row['position_excess'] is None else
                                        float(row['position_excess'][genre])),
                    'historical_key_exposure': float(row['historical_key_exposure'][genre]),
                    'attention_nonself_mass': float(row['attention_nonself_mass']),
                    'history_length': row['history_length'],
                })

        examples = []
        for row in users:
            if row['user_id'] in examples_by_id:
                source = examples_by_id[row['user_id']]
                examples.append({
                    **source, 'example_id': f'h3-{row["user_id"]}',
                    'relative_alignment': row['relative_alignment'],
                    'cosine': row['cosine'],
                    'phase1_delta': row['phase1_delta'],
                    'attention_excess': row['attention_excess'],
                    'position_excess': row['position_excess'],
                    'attention_self_mass': row['attention_self_mass'],
                    'attention_padding_mass': row['attention_padding_mass'],
                    'attention_nonself_mass': row['attention_nonself_mass'],
                    'attention_movie_preview': saved_previews[row['user_id']],
                })

        alignment_groups = alignment_group_summaries(users, labels, config.seed)
        attention_groups = attention_group_summaries(users, labels, 'attention_excess', config.seed)
        position_groups = attention_group_summaries(users, labels, 'position_excess', config.seed)
        conditional_groups = attention_group_summaries(users, labels, 'conditional_excess', config.seed)
        position_coverage = sum(row['position_reference_available'] for row in users)
        heads = int(extractor.model.attention_layers[config.attention_layer].num_heads)
        views = {
            'analysis': 'demographic_internal_attention_v2',
            'users': users, 'groups': alignment_groups, 'genres': labels,
            'ages': original['views']['ages'], 'genders': original['views']['genders'],
            'genre_reference_support': support,
            'cohort_user_ids': [row['user_id'] for row in users],
            'cohort_source': 'H3 Phase I user cohort with identical configuration and seed',
            'model_context': 'full training history, truncated by model maxlen',
            'alignment_reference': 'within-user mean cosine over fixed available genre centroids',
            'attention_available': True,
            'attention': {
                'layer': config.attention_layer, 'head': config.attention_head,
                'head_count': heads, 'layer_count': len(extractor.model.attention_layers),
                'groups': attention_groups, 'position_groups': position_groups,
                'conditional_groups': conditional_groups,
                'reference': 'non-self raw probability mass minus equal-mass exposure across earlier real keys',
                'position_reference': 'leave-one-user-out mean conditional attention by lag; cohort-sensitive',
                'position_available_users': position_coverage,
                'position_unavailable_users': len(users)-position_coverage,
                'normalization_max_error': max((row['attention_normalization_error'] for row in users), default=0),
                'mean_self_mass': sum(row['attention_self_mass'] for row in users)/len(users) if users else None,
                'mean_padding_mass': sum(row['attention_padding_mass'] for row in users)/len(users) if users else None,
                'bootstrap_resamples': 2000,
            },
            'bootstrap_resamples': 2000,
            'n_users': len(users),
        }
        return self.output(records, examples, views, original['notes'] + [
            'H3 Phase II inspects actual learned contextual vectors and attention from the final model-visible query position; no demographic labels enter SASRec inference.',
            'Post-hoc genre centroids are not learned genre parameters. Alignment is a within-user-centered cosine difference, not a recommendation probability.',
            'Main attention excess is observed RAW non-self attention probability mass for genre minus uniform-key exposure at the SAME observed non-self mass. Self-attention and padding are excluded from this comparison and reported separately; raw attention is not renormalized.',
            'The optional position reference uses the other users\' observed non-self attention by historical lag. It requires support from another user for every lag of the selected user; unsupported comparisons are missing, never zero.',
            'Movies split both genre-reference and attention contribution evenly across their verified genres. Attention effects can reflect sequence position, genre frequency, history composition and other correlated features.',
            'Group means and 95% percentile intervals resample USERS, not individual attention keys. Sparse groups have fewer than five users; uncertainty for fewer than two is unavailable.',
            'Phase I percentage-point changes, alignment differences, and attention excess are distinct quantities and must not be placed on a single numerical scale or interpreted causally.',
        ])
