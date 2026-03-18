"""Strategy listing route."""

import json
from pathlib import Path

from fastapi import APIRouter

from reprompt.models import StrategyInfo

router = APIRouter()

_STRATEGIES_PATH = Path(__file__).parent.parent / "data" / "strategies.json"


@router.get("/strategies", response_model=list[StrategyInfo])
async def list_strategies() -> list[StrategyInfo]:
    data = json.loads(_STRATEGIES_PATH.read_text())
    return [StrategyInfo(**s) for s in data]
