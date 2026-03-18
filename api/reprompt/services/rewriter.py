"""LLM rewriter service: generates shopping-optimized query variants via Claude."""

import asyncio
import json
import time
from pathlib import Path

import anthropic

from reprompt.config import settings
from reprompt.models import RewriteResponse, RewriteVariant, ScoreBreakdown
from reprompt.services import citation_cluster, turn1_fitness
from reprompt.services.scorer import score_query

_STRATEGIES_PATH = Path(__file__).parent.parent / "data" / "strategies.json"


def _load_strategies() -> list[dict]:
    return json.loads(_STRATEGIES_PATH.read_text())


_SYSTEM_PROMPT = """\
You are an expert at rewriting queries to trigger product recommendations \
in AI shopping assistants like ChatGPT.

Given a user query, generate {n} rephrased variants using these strategies:

1. SPECIFICITY INJECTION: Add product-matchable details (material, size, \
use-case, price range) so the query maps to real SKUs.
2. PREFERENCE FRAMING: Reframe as a recommendation/preference request \
using "best", "which", "recommended".
3. PROBLEM-TO-PRODUCT BRIDGE: Convert problem statements into \
product-solution queries.
4. COMPARISON TRIGGER: Frame as a product comparison to activate \
structured comparison UI.
5. USE-CASE ANCHORING: Ground in a specific scenario, persona, or \
context that implies a purchase decision.
6. CONCISENESS OPTIMIZATION: Distill to ~7 words that describe a \
specific, shippable product need.
7. CO-CITATION CLUSTER TARGETING: Frame the query so it lands in an \
established vertical where trusted domains co-cite each other \
(e.g., finance → NerdWallet + The Points Guy; tech → The Verge + \
TechRadar). Use comparison/review language that invites multi-source \
citation. ChatGPT cites ~4 sources per turn — aim to be in the set.
8. TURN 1 OPENER FRAMING: Optimize as a conversation-starting query. \
Turn 1 has a 12.6% citation rate (2.5x turn 10). Use factual-grounding \
patterns ("what are the top...", "which X is best for...") that demand a \
web search on the first message.

Rules:
- Each rewrite should be a natural query a real person would type
- Aim for 5-10 words per rewrite (shopping fan-outs average 7 words)
- Include enough specificity to match real products (SKU-matchable)
- Never mention brands unless the original query does
- Assign each rewrite a strategy label from the list above
- Predict 2-4 product categories that would surface for each rewrite

Return ONLY a JSON array of objects with keys: "query", "strategy", "predicted_categories"

Strategy keys to use: specificity_injection, preference_framing, problem_to_product, \
comparison_trigger, use_case_anchoring, conciseness_optimization, co_citation_targeting, turn1_opener"""


_MOCK_REWRITES: dict[str, list[dict]] = {
    "default": [
        {"query": "best products to help fall asleep faster", "strategy": "problem_to_product", "predicted_categories": ["sleep aids", "white noise machines", "melatonin supplements"]},
        {"query": "top-rated sleep accessories under $50", "strategy": "specificity_injection", "predicted_categories": ["sleep masks", "pillow sprays", "weighted blankets"]},
        {"query": "which sleep products do people recommend most", "strategy": "preference_framing", "predicted_categories": ["sleep aids", "mattress toppers", "sound machines"]},
        {"query": "sleep mask vs white noise machine for better sleep", "strategy": "comparison_trigger", "predicted_categories": ["sleep masks", "white noise machines"]},
        {"query": "best sleep aid for light sleeper who travels", "strategy": "use_case_anchoring", "predicted_categories": ["travel sleep kits", "noise-canceling earbuds", "melatonin"]},
        {"query": "best rated sleep products 2026", "strategy": "conciseness_optimization", "predicted_categories": ["sleep aids", "mattresses", "pillows"]},
        {"query": "top rated sleep products compared by experts", "strategy": "co_citation_targeting", "predicted_categories": ["sleep aids", "mattresses", "weighted blankets"]},
        {"query": "what are the best products for improving sleep quality", "strategy": "turn1_opener", "predicted_categories": ["sleep aids", "supplements", "white noise machines"]},
    ],
}

# Reuse a single async client for Claude
_async_client: anthropic.AsyncAnthropic | None = None


def _get_async_client() -> anthropic.AsyncAnthropic:
    global _async_client
    if _async_client is None:
        _async_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _async_client


async def rewrite(query: str, num_variants: int = 8, include_proxy: bool = True) -> RewriteResponse:
    start = time.time()

    # Score original + generate rewrites concurrently
    if settings.anthropic_api_key:
        original_task = score_query(query, include_proxy=include_proxy)
        rewrite_task = _call_claude(query, num_variants)
        original_breakdown, raw_rewrites = await asyncio.gather(original_task, rewrite_task)
    else:
        original_breakdown = await score_query(query, include_proxy=include_proxy)
        raw_rewrites = _get_mock_rewrites(query, num_variants)

    # Score ALL rewrites concurrently
    async def _score_one(rw: dict) -> RewriteVariant:
        breakdown = await score_query(rw["query"], include_proxy=include_proxy)
        cluster_name, neighbors = citation_cluster.identify_cluster(rw["query"])
        t1_score = turn1_fitness.score(rw["query"])
        return RewriteVariant(
            query=rw["query"],
            score=breakdown.composite,
            score_breakdown=breakdown,
            strategy=rw.get("strategy", "unknown"),
            predicted_categories=rw.get("predicted_categories", []),
            citation_cluster=cluster_name,
            co_citation_neighbors=neighbors,
            turn1_optimized=t1_score >= 60,
        )

    variants = await asyncio.gather(*[_score_one(rw) for rw in raw_rewrites])
    variants_list = sorted(variants, key=lambda v: v.score, reverse=True)

    elapsed_ms = int((time.time() - start) * 1000)

    return RewriteResponse(
        original_query=query,
        original_score=original_breakdown.composite,
        original_breakdown=original_breakdown,
        rewrites=variants_list,
        metadata={
            "processing_time_ms": elapsed_ms,
            "model_version": settings.rewrite_model if settings.anthropic_api_key else "mock",
        },
    )


async def rewrite_stream(query: str, num_variants: int = 8, include_proxy: bool = True):
    """Streaming generator: yields original score first, then each rewrite as scored."""
    import time as _time
    start = _time.time()

    # Fire original scoring + Claude call concurrently
    original_task = score_query(query, include_proxy=include_proxy)
    if settings.anthropic_api_key:
        rewrite_task = _call_claude(query, num_variants)
        original_breakdown, raw_rewrites = await asyncio.gather(original_task, rewrite_task)
    else:
        original_breakdown = await original_task
        raw_rewrites = _get_mock_rewrites(query, num_variants)

    # Yield original score immediately
    yield {
        "type": "original",
        "original_query": query,
        "original_score": original_breakdown.composite,
        "original_breakdown": original_breakdown.model_dump(),
    }

    # Score all rewrites concurrently, yield each as done
    async def _score_and_build(rw: dict) -> RewriteVariant:
        breakdown = await score_query(rw["query"], include_proxy=include_proxy)
        cluster_name, neighbors = citation_cluster.identify_cluster(rw["query"])
        t1_score = turn1_fitness.score(rw["query"])
        return RewriteVariant(
            query=rw["query"],
            score=breakdown.composite,
            score_breakdown=breakdown,
            strategy=rw.get("strategy", "unknown"),
            predicted_categories=rw.get("predicted_categories", []),
            citation_cluster=cluster_name,
            co_citation_neighbors=neighbors,
            turn1_optimized=t1_score >= 60,
        )

    tasks = [asyncio.create_task(_score_and_build(rw)) for rw in raw_rewrites]
    for coro in asyncio.as_completed(tasks):
        variant = await coro
        yield {"type": "rewrite", "variant": variant.model_dump()}

    elapsed_ms = int((_time.time() - start) * 1000)
    yield {
        "type": "done",
        "metadata": {
            "processing_time_ms": elapsed_ms,
            "model_version": settings.rewrite_model if settings.anthropic_api_key else "mock",
        },
    }


async def _call_claude(query: str, num_variants: int) -> list[dict]:
    client = _get_async_client()

    message = await client.messages.create(
        model=settings.rewrite_model,
        max_tokens=1024,
        system=_SYSTEM_PROMPT.format(n=num_variants),
        messages=[{"role": "user", "content": f'Original query: "{query}"'}],
    )

    text = message.content[0].text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        return _get_mock_rewrites(query, num_variants)


def _get_mock_rewrites(query: str, num_variants: int) -> list[dict]:
    """Return contextually relevant mock rewrites."""
    q = query.lower()

    if any(w in q for w in ["sleep", "sleeping", "insomnia", "tired", "rest"]):
        return _MOCK_REWRITES["default"][:num_variants]

    if any(w in q for w in ["couch", "sofa", "furniture", "desk", "chair", "home"]):
        return [
            {"query": "best mid-range sofa under $1000 for small apartment", "strategy": "specificity_injection", "predicted_categories": ["sofas", "loveseats", "sectionals"]},
            {"query": "which affordable couch is most comfortable for daily use", "strategy": "preference_framing", "predicted_categories": ["sofas", "futons", "sleeper sofas"]},
            {"query": "best small space furniture solutions for apartments", "strategy": "problem_to_product", "predicted_categories": ["compact furniture", "storage solutions", "multifunctional furniture"]},
            {"query": "fabric sofa vs leather sofa for small living room", "strategy": "comparison_trigger", "predicted_categories": ["sofas", "loveseats"]},
            {"query": "best sofa for remote worker who also uses it as guest bed", "strategy": "use_case_anchoring", "predicted_categories": ["sleeper sofas", "futons", "convertible couches"]},
            {"query": "best rated apartment sofas 2026", "strategy": "conciseness_optimization", "predicted_categories": ["sofas", "compact couches"]},
            {"query": "top rated sofas compared by furniture experts", "strategy": "co_citation_targeting", "predicted_categories": ["sofas", "loveseats", "sectionals"]},
            {"query": "what are the best sofas for small apartments in 2026", "strategy": "turn1_opener", "predicted_categories": ["sofas", "loveseats", "apartment furniture"]},
        ][:num_variants]

    if any(w in q for w in ["credit", "card", "bank", "loan", "finance", "money"]):
        return [
            {"query": "best travel credit cards with no annual fee 2026", "strategy": "specificity_injection", "predicted_categories": ["credit cards", "travel rewards cards"]},
            {"query": "which credit card has the best cashback rewards", "strategy": "preference_framing", "predicted_categories": ["cashback cards", "rewards cards"]},
            {"query": "best credit card for building credit from scratch", "strategy": "problem_to_product", "predicted_categories": ["secured credit cards", "student cards"]},
            {"query": "chase sapphire vs amex gold for travel rewards", "strategy": "comparison_trigger", "predicted_categories": ["travel credit cards", "premium cards"]},
            {"query": "best credit card for freelancer who travels monthly", "strategy": "use_case_anchoring", "predicted_categories": ["business credit cards", "travel cards"]},
            {"query": "best rewards credit cards 2026", "strategy": "conciseness_optimization", "predicted_categories": ["rewards cards", "cashback cards"]},
            {"query": "top rated credit cards compared by annual fee and rewards", "strategy": "co_citation_targeting", "predicted_categories": ["credit cards", "rewards comparison"]},
            {"query": "what are the best credit cards for everyday spending", "strategy": "turn1_opener", "predicted_categories": ["credit cards", "cashback cards", "rewards cards"]},
        ][:num_variants]

    if any(w in q for w in ["office", "organize", "productivity", "work"]):
        return [
            {"query": "best desk organizer set for small home office under $50", "strategy": "specificity_injection", "predicted_categories": ["desk organizers", "office storage", "desk accessories"]},
            {"query": "which home office organizers do people recommend the most", "strategy": "preference_framing", "predicted_categories": ["office organization", "storage solutions"]},
            {"query": "best products to keep a home office clutter-free", "strategy": "problem_to_product", "predicted_categories": ["desk organizers", "cable management", "shelving"]},
            {"query": "mesh desk organizer vs bamboo organizer for home office", "strategy": "comparison_trigger", "predicted_categories": ["desk organizers", "office accessories"]},
            {"query": "best office setup for remote developer in small apartment", "strategy": "use_case_anchoring", "predicted_categories": ["desks", "monitors", "chairs", "organizers"]},
            {"query": "best home office organizers 2026", "strategy": "conciseness_optimization", "predicted_categories": ["desk organizers", "office storage"]},
            {"query": "top rated home office products compared by experts", "strategy": "co_citation_targeting", "predicted_categories": ["office furniture", "desk accessories", "organizers"]},
            {"query": "what are the best ways to organize a small home office", "strategy": "turn1_opener", "predicted_categories": ["desk organizers", "storage solutions", "shelving units"]},
        ][:num_variants]

    return [
        {"query": f"best {query.strip('?').strip()} products recommended for 2026", "strategy": "preference_framing", "predicted_categories": ["general products"]},
        {"query": f"top rated {query.strip('?').strip()} solutions compared", "strategy": "co_citation_targeting", "predicted_categories": ["general products"]},
        {"query": f"what are the best {query.strip('?').strip()} options available", "strategy": "turn1_opener", "predicted_categories": ["general products"]},
        {"query": f"best {query.strip('?').strip()} for everyday use under $100", "strategy": "specificity_injection", "predicted_categories": ["general products"]},
        {"query": f"which {query.strip('?').strip()} is most recommended by experts", "strategy": "preference_framing", "predicted_categories": ["general products"]},
        {"query": f"{query.strip('?').strip()} products vs alternatives compared", "strategy": "comparison_trigger", "predicted_categories": ["general products"]},
        {"query": f"best {query.strip('?').strip()} for someone just getting started", "strategy": "use_case_anchoring", "predicted_categories": ["general products"]},
        {"query": f"top {query.strip('?').strip()} picks 2026", "strategy": "conciseness_optimization", "predicted_categories": ["general products"]},
    ][:num_variants]
