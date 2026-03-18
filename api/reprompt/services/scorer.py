"""Composite scorer: wires all 6 sub-scorers into a single 0-100 score.

When a trained classifier is available, uses it as the primary scorer.
Falls back to weighted heuristic sub-scorers otherwise.
Weights calibrated via grid search against 135 ChatGPT-validated queries.
"""

from reprompt.models import ScoreBreakdown
from reprompt.services import (
    citation_cluster,
    lexical,
    shopping_proxy,
    specificity,
    structural,
    turn1_fitness,
)

# Weights from ground-truth grid search (135 validated queries)
W_LEXICAL = 0.20
W_STRUCTURAL = 0.05
W_SPECIFICITY = 0.15
W_SHOPPING = 0.35
W_CITATION = 0.05
W_TURN1 = 0.20


def _try_classifier(query: str) -> int | None:
    """Try to get a score from the trained classifier. Returns None if unavailable."""
    try:
        from reprompt.services.classifier import is_trained, predict

        if not is_trained():
            return None
        result = predict(query)
        if result.get("available"):
            return result["predicted_score"]
    except Exception:
        pass
    return None


async def score_query(query: str, include_proxy: bool = True) -> ScoreBreakdown:
    lex = lexical.score(query)
    struct = structural.score(query)
    spec = specificity.score(query)
    shop = shopping_proxy.score_query(query) if include_proxy else 0
    cite = citation_cluster.score(query)
    t1 = turn1_fitness.score(query)

    heuristic_composite = int(
        W_LEXICAL * lex
        + W_STRUCTURAL * struct
        + W_SPECIFICITY * spec
        + W_SHOPPING * shop
        + W_CITATION * cite
        + W_TURN1 * t1
    )

    # Use trained classifier if available — it's more accurate
    ml_score = _try_classifier(query)
    if ml_score is not None:
        composite = ml_score
    else:
        composite = heuristic_composite

    return ScoreBreakdown(
        lexical=lex,
        structural=struct,
        specificity=spec,
        shopping_proxy=shop,
        citation_cluster=cite,
        turn1_fitness=t1,
        composite=max(0, min(100, composite)),
    )
