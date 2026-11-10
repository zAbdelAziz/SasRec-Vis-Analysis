"""Single backend authority for active hypothesis / phase / pair combinations."""

AVAILABILITY = {
    'h1': {1: ('a', 'b'), 2: ('a',)},
    'h2': {1: ('a',), 2: ('a',)},
    'h3': {1: ('a',), 2: ('a',)},
    'h4': {1: ('b',)},
    'h5': {1: ('b',)},
}


def validate(hypothesis: str, phase: int, pair: str) -> None:
    if pair not in AVAILABILITY.get(hypothesis, {}).get(phase, ()):
        raise ValueError('Unsupported hypothesis, research phase, or pair')


def is_notebook(hypothesis: str, phase: int, pair: str) -> bool:
    return phase == 1 and pair == 'b' and hypothesis in ('h1', 'h4', 'h5')


def manifest() -> dict:
    return {h: {f'phase{phase}': list(pairs) for phase, pairs in phases.items()}
            for h, phases in AVAILABILITY.items()}
