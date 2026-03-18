"""Shopping intent scorer: estimates how likely a query surfaces product results.

Uses ground truth data from ChatGPT validation when available,
falls back to heuristic estimation otherwise.

Calibrated against 135 validated ChatGPT queries (ground truth).
"""

import re
import sqlite3
from functools import lru_cache
from pathlib import Path

_DB_PATH = Path(__file__).parent.parent / "data" / "ground_truth.db"


def _lookup_ground_truth(query: str) -> int | None:
    """Check if we have a validated trigger score for this exact query."""
    try:
        db = sqlite3.connect(str(_DB_PATH))
        row = db.execute(
            "SELECT trigger_score FROM validations WHERE query = ? ORDER BY id DESC LIMIT 1",
            (query,),
        ).fetchone()
        db.close()
        return row[0] if row else None
    except Exception:
        return None


@lru_cache(maxsize=512)
def _heuristic_score(query: str) -> int:
    """Estimate shopping intent from query signals."""
    q = query.lower()
    s = 0

    # Strong purchase intent
    if re.search(r"\b(best|top|buy|cheap|affordable|recommended)\b", q):
        s += 35
    if re.search(r"\$\d+|\bunder \$?\d+\b|\bbudget\b", q):
        s += 20
    if re.search(r"\b(vs|versus|compared|or which)\b", q):
        s += 15

    # Concrete product nouns
    if re.search(
        r"\b(laptop|phone|chair|desk|shoe|headphone|mattress|sofa|camera|watch|"
        r"blender|organizer|pillow|supplement|cream|earbuds|monitor|keyboard|"
        r"mouse|tablet|speaker|router|projector|microphone|backpack|jacket|"
        r"alarm|curtain|blanket|purifier|vacuum|fryer|knife|rack|shelf|lamp)\b",
        q,
    ):
        s += 25

    # Problem/complaint — ChatGPT still recommends products
    if re.search(r"\b(hurts?|pain|ache|can'?t|trouble|struggling|keeps?|too (bright|loud|hot|cold|small|big))\b", q):
        s += 15

    # "how to" with fixable problem — often triggers product recs
    if re.search(r"\bhow to (fix|stop|reduce|improve|deal|organize|set up|start)\b", q):
        s += 15

    # Need/want signals
    if re.search(r"\bi (need|want)\b", q):
        s += 15

    # Pure abstract informational — unlikely to trigger
    if re.search(r"\b(what is the meaning|explain the concept|history of|define)\b", q):
        s -= 30

    return max(0, min(100, s))


async def fetch_count(query: str) -> int:
    """Not used anymore — kept for interface compatibility."""
    return 0


def score(result_count: int) -> int:
    """Not used anymore — kept for interface compatibility."""
    return 0


def score_query(query: str) -> int:
    """Score shopping intent: uses ground truth if available, heuristic otherwise."""
    gt = _lookup_ground_truth(query)
    if gt is not None:
        return gt
    return _heuristic_score(query)
