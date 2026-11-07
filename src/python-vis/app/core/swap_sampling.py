"""Deterministic, opportunity-aware sampling for H6 history-swap experiments.

This is *stratified coverage sampling*, not a representative user-population
sample. Its coverage counts are based on eligible training-history positions;
no model scoring is required to enumerate the opportunities.
"""
from collections import Counter, defaultdict
from dataclasses import dataclass
from random import Random
from statistics import median

POPULARITY_GROUPS = ('Q1 rare', 'Q2', 'Q3', 'Q4', 'Q5 popular')
POSITION_BANDS = ('Far (15-18 before end)', 'Middle (10-14)', 'Near (6-9)')
MAX_SWAPS_PER_USER = 3


def position_band(original_position: int) -> str:
    distance = abs(original_position)
    if distance >= 15:
        return POSITION_BANDS[0]
    if distance >= 10:
        return POSITION_BANDS[1]
    return POSITION_BANDS[2]


@dataclass(frozen=True)
class SwapOpportunity:
    user_id: int
    source_index: int
    item_id: int
    partner_item_id: int
    popularity: int
    partner_popularity: int
    popularity_bin: str
    partner_popularity_bin: str
    original_position: int
    position_band: str

    @property
    def key(self):
        return self.user_id, self.source_index


def enumerate_opportunities(training, popularity, classify):
    """Return eligible two-slot swaps; skip swaps of identical items."""
    found = []
    no_change = 0
    for user_id in sorted(training):
        history = training[user_id]
        if len(history) < 14:
            continue
        for source in range(max(0, len(history) - 18), len(history) - 5, 2):
            partner = source + 2
            if history[source] == history[partner]:
                no_change += 1
                continue
            item_id = int(history[source])
            partner_item_id = int(history[partner])
            relative = source - len(history)
            found.append(SwapOpportunity(
                user_id=int(user_id), source_index=source,
                item_id=item_id, partner_item_id=partner_item_id,
                popularity=int(popularity.get(item_id, 0)),
                partner_popularity=int(popularity.get(partner_item_id, 0)),
                popularity_bin=classify(item_id),
                partner_popularity_bin=classify(partner_item_id),
                original_position=relative, position_band=position_band(relative),
            ))
    return found, no_change


def select_opportunities(opportunities, max_users, seed):
    """Cover popularity x position opportunities under a unique-user budget.

    Stage 1 selects users by rotating through opportunity cells, giving
    low-popularity and earlier-position opportunities a chance to participate.
    Stage 2 rotates through cells with the least selected representation,
    enforcing at most three distinct swaps per user. Selection is reproducible
    for a fixed seed and input history, and never fabricates empty cells.
    """
    if max_users < 1:
        return []
    rng = Random(int(seed))
    cells = [(group, band) for group in POPULARITY_GROUPS for band in POSITION_BANDS]
    by_cell = {cell: [] for cell in cells}
    for opportunity in opportunities:
        cell = (opportunity.popularity_bin, opportunity.position_band)
        if cell in by_cell:
            by_cell[cell].append(opportunity)
    for candidates in by_cell.values():
        candidates.sort(key=lambda row: row.key)
        rng.shuffle(candidates)

    # Diversify the *users* before allocating per-user edits. Filling quotas
    # with events alone would spend the entire budget on Q5-heavy users.
    user_queues = {cell: list(dict.fromkeys(row.user_id for row in by_cell[cell])) for cell in cells}
    chosen_users = set()
    while len(chosen_users) < int(max_users):
        progress = False
        for cell in cells:
            queue = user_queues[cell]
            while queue and queue[0] in chosen_users:
                queue.pop(0)
            if not queue:
                continue
            chosen_users.add(queue.pop(0))
            progress = True
            if len(chosen_users) >= int(max_users):
                break
        if not progress:
            break

    queues = {cell: [row for row in by_cell[cell] if row.user_id in chosen_users] for cell in cells}
    selected = []
    by_user = Counter()
    group_counts = Counter()
    cell_counts = Counter()
    # A user can supply at most three measured swaps. Cells with zero support
    # never receive synthetic points or a smoothed trend.
    budget = int(max_users) * MAX_SWAPS_PER_USER
    while len(selected) < budget:
        progress = False
        ordered = sorted(cells, key=lambda cell: (
            group_counts[cell[0]], cell_counts[cell], POPULARITY_GROUPS.index(cell[0]),
            POSITION_BANDS.index(cell[1])))
        for cell in ordered:
            queue = queues[cell]
            while queue and by_user[queue[0].user_id] >= MAX_SWAPS_PER_USER:
                queue.pop(0)
            if not queue:
                continue
            row = queue.pop(0)
            selected.append(row)
            by_user[row.user_id] += 1
            group_counts[cell[0]] += 1
            cell_counts[cell] += 1
            progress = True
            break
        if not progress:
            break
    return sorted(selected, key=lambda row: (row.user_id, row.source_index))


def select_saved_cases(scored, max_examples):
    """Choose observable examples with group/band coverage and effect diversity.

    A typical (near-median) case is selected for each observed popularity
    group first. Remaining slots favor uncovered positional cells, then high
    rank-change effects. The output is a deterministic subset of actual scores.
    """
    if not scored or max_examples < 1:
        return []
    chosen = []
    seen = set()

    def add(case):
        key = case['opportunity'].key
        if key not in seen and len(chosen) < max_examples:
            seen.add(key)
            chosen.append(case)

    for group in POPULARITY_GROUPS:
        subset = [s for s in scored if s['opportunity'].popularity_bin == group]
        if subset:
            typical = median(s['result']['rank_change'] for s in subset)
            add(min(subset, key=lambda s: (
                abs(s['result']['rank_change'] - typical),
                s['opportunity'].user_id, s['opportunity'].source_index)))

    while len(chosen) < min(max_examples, len(scored)):
        remaining = [s for s in scored if s['opportunity'].key not in seen]
        if not remaining:
            break
        used_cells = {(s['opportunity'].popularity_bin, s['opportunity'].position_band) for s in chosen}
        used_users = Counter(s['opportunity'].user_id for s in chosen)
        add(min(remaining, key=lambda s: (
            (s['opportunity'].popularity_bin, s['opportunity'].position_band) in used_cells,
            used_users[s['opportunity'].user_id],
            -s['result']['rank_change'],
            s['opportunity'].user_id, s['opportunity'].source_index)))
    return chosen


def coverage_report(opportunities, selected, saved, no_change, seed):
    all_groups = Counter(row.popularity_bin for row in opportunities)
    selected_groups = Counter(row.popularity_bin for row in selected)
    saved_groups = Counter(row.popularity_bin for row in saved)
    all_cells = Counter((row.popularity_bin, row.position_band) for row in opportunities)
    selected_cells = Counter((row.popularity_bin, row.position_band) for row in selected)
    saved_cells = Counter((row.popularity_bin, row.position_band) for row in saved)
    return {
        'strategy': 'stratified_popularity_position_v2',
        'seed': int(seed),
        'eligible_users': len({row.user_id for row in opportunities}),
        'sampled_users': len({row.user_id for row in selected}),
        'available_swap_opportunities': len(opportunities),
        'selected_swap_observations': len(selected),
        'excluded_identical_swaps': int(no_change),
        'max_swaps_per_user': MAX_SWAPS_PER_USER,
        'note': ('Selected users and swaps are deliberately stratified for coverage; '
                 'means are descriptive for sampled events, NOT population-weighted estimates.'),
        'by_popularity': [
            {'group': group, 'eligible': all_groups[group], 'sampled': selected_groups[group],
             'saved_cases': saved_groups[group],
             'eligible_users': len({r.user_id for r in opportunities if r.popularity_bin == group}),
             'sampled_users': len({r.user_id for r in selected if r.popularity_bin == group})}
            for group in POPULARITY_GROUPS],
        'by_popularity_position': [
            {'group': group, 'band': band,
             'eligible': all_cells[group, band], 'sampled': selected_cells[group, band],
             'saved_cases': saved_cells[group, band]}
            for group in POPULARITY_GROUPS for band in POSITION_BANDS],
    }
