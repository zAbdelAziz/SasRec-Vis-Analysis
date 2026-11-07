"""Small, explicit model-behavior metrics; no trained representations here."""
from collections import Counter
import math
import numpy as np


class Metrics:
    @staticmethod
    def jaccard(first, second):
        a, b = set(first), set(second)
        return len(a & b) / len(a | b) if a or b else 1.0

    @staticmethod
    def rank_change(first, second, persistence=0.9):
        """One minus finite-list extrapolated Rank-Biased Overlap (RBO)."""
        a, b = list(first), list(second)
        if not a or not b:
            return 0.0
        depth = max(len(a), len(b))
        seen_a, seen_b = set(), set()
        overlap, weighted = 0, 0.0
        for index in range(depth):
            if index < len(a):
                seen_a.add(a[index])
            if index < len(b):
                seen_b.add(b[index])
            overlap = len(seen_a & seen_b) / (index + 1)
            weighted += (1 - persistence) * persistence ** index * overlap
        similarity = weighted + persistence ** depth * overlap
        return float(min(1.0, max(0.0, 1 - similarity)))

    @staticmethod
    def cosine(first, second):
        a, b = np.asarray(first, dtype=float), np.asarray(second, dtype=float)
        divisor = np.linalg.norm(a) * np.linalg.norm(b)
        return float(np.dot(a, b) / divisor) if divisor else 0.0

    @staticmethod
    def genre_profile(items, genres):
        profile = Counter()
        for item in items:
            categories = genres.get(int(item), [])
            for genre in categories:
                profile[genre] += 1 / max(len(categories), 1)
        total = sum(profile.values())
        return {key: value / total for key, value in profile.items()} if total else {}

    @staticmethod
    def profile_distance(first, second):
        """Total variation distance of multi-label-normalized genre distributions."""
        return 0.5 * sum(abs(first.get(key, 0) - second.get(key, 0)) for key in first.keys() | second.keys())

    @staticmethod
    def profile_alignment(recommended, target):
        return sum(recommended.get(key, 0) * target.get(key, 0) for key in target)

    @staticmethod
    def mean(values):
        return float(np.mean(values)) if values else 0.0

    @staticmethod
    def ci(values):
        values = list(values)
        if len(values) < 2:
            return [None, None]
        average = float(np.mean(values))
        deviation = float(np.std(values, ddof=1))
        margin = 1.96 * deviation / math.sqrt(len(values))
        return [average - margin, average + margin]
