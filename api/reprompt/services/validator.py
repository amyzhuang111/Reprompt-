"""ChatGPT validation: sends queries to GPT, detects product recommendations, stores ground truth."""

import asyncio
import json
import re
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import AsyncOpenAI

from reprompt.config import settings

_DB_PATH = Path(__file__).parent.parent / "data" / "ground_truth.db"
_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


def _get_db() -> sqlite3.Connection:
    db = sqlite3.connect(str(_DB_PATH))
    db.execute("""
        CREATE TABLE IF NOT EXISTS validations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT NOT NULL,
            chatgpt_response TEXT,
            has_product_recs INTEGER NOT NULL,
            product_count INTEGER DEFAULT 0,
            has_prices INTEGER DEFAULT 0,
            has_comparisons INTEGER DEFAULT 0,
            has_specific_brands INTEGER DEFAULT 0,
            confidence REAL DEFAULT 0,
            trigger_score INTEGER DEFAULT 0,
            heuristic_score INTEGER DEFAULT 0,
            model TEXT,
            created_at TEXT NOT NULL
        )
    """)
    db.commit()
    return db


# --- Detection prompt: ask GPT to classify its OWN response ---

_JUDGE_SYSTEM = """\
You are analyzing a ChatGPT response to determine if it contains product recommendations.

Classify the response and return JSON with these fields:
- has_product_recs: boolean — does the response recommend specific purchasable products?
- product_count: integer — how many distinct products are mentioned by name?
- has_prices: boolean — are any prices or price ranges mentioned?
- has_comparisons: boolean — does it compare multiple products?
- has_specific_brands: boolean — are specific brand names mentioned?
- product_names: list of strings — the specific products mentioned
- confidence: float 0-1 — how confident are you in this classification?

Return ONLY valid JSON, no other text."""


async def validate_query(query: str, heuristic_score: int = 0) -> dict:
    """Send query to ChatGPT, analyze response for product recommendations."""
    client = _get_client()

    # Step 1: Get ChatGPT's natural response to the query
    chat_response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": query}],
        max_tokens=1024,
        temperature=0.7,
    )
    response_text = chat_response.choices[0].message.content or ""

    # Step 2: Have GPT judge its own response for product recs
    judge_response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _JUDGE_SYSTEM},
            {"role": "user", "content": f"Query: {query}\n\nChatGPT Response:\n{response_text}"},
        ],
        max_tokens=512,
        temperature=0,
    )
    judge_text = judge_response.choices[0].message.content or "{}"

    try:
        analysis = json.loads(judge_text)
    except json.JSONDecodeError:
        # Try to extract JSON
        start = judge_text.find("{")
        end = judge_text.rfind("}") + 1
        if start >= 0 and end > start:
            analysis = json.loads(judge_text[start:end])
        else:
            analysis = _fallback_detect(response_text)

    # Compute a trigger score from the analysis
    trigger_score = 0
    if analysis.get("has_product_recs"):
        trigger_score += 40
    trigger_score += min(30, (analysis.get("product_count", 0)) * 10)
    if analysis.get("has_prices"):
        trigger_score += 15
    if analysis.get("has_comparisons"):
        trigger_score += 10
    if analysis.get("has_specific_brands"):
        trigger_score += 5
    trigger_score = min(100, trigger_score)

    # Store in DB
    result = {
        "query": query,
        "chatgpt_response": response_text,
        "has_product_recs": bool(analysis.get("has_product_recs", False)),
        "product_count": analysis.get("product_count", 0),
        "has_prices": bool(analysis.get("has_prices", False)),
        "has_comparisons": bool(analysis.get("has_comparisons", False)),
        "has_specific_brands": bool(analysis.get("has_specific_brands", False)),
        "product_names": analysis.get("product_names", []),
        "confidence": analysis.get("confidence", 0),
        "trigger_score": trigger_score,
        "heuristic_score": heuristic_score,
        "model": "gpt-4o-mini",
    }

    _store_result(result)
    return result


def _fallback_detect(text: str) -> dict:
    """Regex fallback if LLM judge fails."""
    t = text.lower()
    has_recs = bool(re.search(r"\b(recommend|suggestion|top pick|best option|consider buying|you (might|should|could) (try|get|buy))\b", t))
    prices = re.findall(r"\$\d+", t)
    brands = re.findall(r"\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b", text)
    return {
        "has_product_recs": has_recs or len(prices) > 0,
        "product_count": len(prices) if prices else (3 if has_recs else 0),
        "has_prices": len(prices) > 0,
        "has_comparisons": bool(re.search(r"\bvs\b|\bcompare|\bversus\b", t)),
        "has_specific_brands": len(brands) > 2,
        "product_names": [],
        "confidence": 0.4,
    }


def _store_result(result: dict):
    db = _get_db()
    db.execute(
        """INSERT INTO validations
           (query, chatgpt_response, has_product_recs, product_count, has_prices,
            has_comparisons, has_specific_brands, confidence, trigger_score,
            heuristic_score, model, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            result["query"],
            result["chatgpt_response"],
            int(result["has_product_recs"]),
            result["product_count"],
            int(result["has_prices"]),
            int(result["has_comparisons"]),
            int(result["has_specific_brands"]),
            result["confidence"],
            result["trigger_score"],
            result["heuristic_score"],
            result["model"],
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    db.commit()
    db.close()


_SEMAPHORE = asyncio.Semaphore(5)


async def validate_batch(queries: list[tuple[str, int]]) -> list[dict]:
    """Validate multiple queries concurrently. Input: list of (query, heuristic_score)."""
    async def _one(q: str, hs: int) -> dict:
        async with _SEMAPHORE:
            return await validate_query(q, heuristic_score=hs)

    return await asyncio.gather(*[_one(q, hs) for q, hs in queries])


def get_validation_stats() -> dict:
    """Return aggregate stats from ground truth DB."""
    db = _get_db()
    rows = db.execute("""
        SELECT
            COUNT(*) as total,
            SUM(has_product_recs) as triggered,
            AVG(trigger_score) as avg_trigger,
            AVG(heuristic_score) as avg_heuristic,
            AVG(CASE WHEN has_product_recs THEN heuristic_score END) as avg_heuristic_when_triggered,
            AVG(CASE WHEN NOT has_product_recs THEN heuristic_score END) as avg_heuristic_when_not
        FROM validations
    """).fetchone()
    db.close()

    if not rows or rows[0] == 0:
        return {"total": 0}

    return {
        "total": rows[0],
        "triggered": rows[1],
        "trigger_rate": round(rows[1] / rows[0] * 100, 1),
        "avg_trigger_score": round(rows[2], 1),
        "avg_heuristic_score": round(rows[3], 1),
        "avg_heuristic_when_triggered": round(rows[4], 1) if rows[4] else 0,
        "avg_heuristic_when_not_triggered": round(rows[5], 1) if rows[5] else 0,
    }


def get_recent_validations(limit: int = 50) -> list[dict]:
    """Return recent validation results."""
    db = _get_db()
    rows = db.execute(
        """SELECT query, has_product_recs, product_count, has_prices,
                  has_specific_brands, trigger_score, heuristic_score, created_at
           FROM validations ORDER BY id DESC LIMIT ?""",
        (limit,),
    ).fetchall()
    db.close()

    return [
        {
            "query": r[0],
            "has_product_recs": bool(r[1]),
            "product_count": r[2],
            "has_prices": bool(r[3]),
            "has_specific_brands": bool(r[4]),
            "trigger_score": r[5],
            "heuristic_score": r[6],
            "created_at": r[7],
        }
        for r in rows
    ]
