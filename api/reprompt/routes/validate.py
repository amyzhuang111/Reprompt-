"""Validation routes: validate queries against ChatGPT, view ground truth."""

from fastapi import APIRouter
from pydantic import BaseModel

from reprompt.services.validator import (
    validate_query,
    validate_batch,
    get_validation_stats,
    get_recent_validations,
)
from reprompt.services.scorer import score_query
from reprompt.services.classifier import train as train_classifier, predict as classify_query, is_trained

router = APIRouter(tags=["validate"])


class ValidateRequest(BaseModel):
    query: str


class ValidateBatchRequest(BaseModel):
    queries: list[str]


@router.post("/validate")
async def validate_single(req: ValidateRequest):
    """Send a query to ChatGPT and check if it triggers product recommendations."""
    breakdown = await score_query(req.query, include_proxy=True)
    result = await validate_query(req.query, heuristic_score=breakdown.composite)
    return result


@router.post("/validate/batch")
async def validate_batch_endpoint(req: ValidateBatchRequest):
    """Validate multiple queries against ChatGPT."""
    # Score all queries first
    pairs = []
    for q in req.queries:
        breakdown = await score_query(q, include_proxy=True)
        pairs.append((q, breakdown.composite))

    results = await validate_batch(pairs)
    return {"results": results, "count": len(results)}


@router.get("/validate/stats")
async def validation_stats():
    """Get aggregate validation stats — shows how well heuristic correlates with reality."""
    return get_validation_stats()


@router.get("/validate/recent")
async def recent_validations(limit: int = 50):
    """Get recent validation results."""
    return get_recent_validations(limit)


@router.post("/classifier/train")
async def train_model():
    """Train the ML classifier on ground truth data."""
    stats = train_classifier()
    return stats


@router.post("/classifier/predict")
async def predict_single(req: ValidateRequest):
    """Predict shopping trigger using trained classifier."""
    if not is_trained():
        return {"error": "No trained model. POST /classifier/train first."}
    return classify_query(req.query)


@router.get("/classifier/status")
async def classifier_status():
    """Check if classifier is trained."""
    return {"trained": is_trained()}
