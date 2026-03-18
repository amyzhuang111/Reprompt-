"""Basket runner: loads JSONL prompt baskets, scores originals, rewrites each, computes lift."""

import asyncio
import json
from pathlib import Path

from reprompt.models import BasketPrompt, BasketResult, RewriteResponse
from reprompt.services.rewriter import rewrite

_BASKETS_DIR = Path(__file__).parent.parent / "data" / "baskets"
_SEMAPHORE = asyncio.Semaphore(5)


def list_baskets() -> list[str]:
    """Return available basket names."""
    return sorted(p.stem for p in _BASKETS_DIR.glob("*.jsonl"))


def load_basket(name: str) -> list[BasketPrompt]:
    """Load a JSONL basket file."""
    path = _BASKETS_DIR / f"{name}.jsonl"
    if not path.exists():
        raise FileNotFoundError(f"Basket '{name}' not found")
    prompts = []
    for line in path.read_text().strip().splitlines():
        data = json.loads(line)
        prompts.append(BasketPrompt(**data))
    return prompts


async def _rewrite_with_semaphore(query: str) -> RewriteResponse:
    async with _SEMAPHORE:
        return await rewrite(query, num_variants=5, include_proxy=True)


async def run_basket(name: str) -> BasketResult:
    """Run all prompts in a basket through the rewriter."""
    prompts = load_basket(name)

    tasks = [_rewrite_with_semaphore(p.query) for p in prompts]
    results: list[RewriteResponse] = await asyncio.gather(*tasks)

    original_scores = [r.original_score for r in results]
    best_scores = [max((rw.score for rw in r.rewrites), default=r.original_score) for r in results]
    lifts = [b - o for o, b in zip(original_scores, best_scores)]

    return BasketResult(
        basket_name=name,
        prompt_count=len(prompts),
        avg_original_score=round(sum(original_scores) / len(original_scores), 1) if original_scores else 0,
        avg_best_rewrite_score=round(sum(best_scores) / len(best_scores), 1) if best_scores else 0,
        avg_lift=round(sum(lifts) / len(lifts), 1) if lifts else 0,
        results=results,
    )
