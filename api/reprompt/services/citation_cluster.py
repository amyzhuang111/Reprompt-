"""Citation cluster scorer: maps queries to co-citation verticals."""

import json
import re
from pathlib import Path

_MAP_PATH = Path(__file__).parent.parent / "data" / "co_citation_map.json"
_co_citation_map: dict | None = None


def _load_map() -> dict:
    global _co_citation_map
    if _co_citation_map is None:
        _co_citation_map = json.loads(_MAP_PATH.read_text())
    return _co_citation_map


def identify_cluster(query: str) -> tuple[str, list[str]]:
    """Return (cluster_name, co_citation_neighbor_domains) for a query."""
    cmap = _load_map()
    q = query.lower()

    best_cluster = ""
    best_domains: list[str] = []
    best_hits = 0

    for vertical in cmap["verticals"]:
        hits = sum(1 for kw in vertical["keywords"] if re.search(r"\b" + re.escape(kw) + r"\b", q))
        if hits > best_hits:
            best_hits = hits
            best_cluster = vertical["name"]
            best_domains = vertical["domains"]

    return best_cluster, best_domains


def score(query: str) -> int:
    """Score 0-100 based on co-citation cluster alignment."""
    s = 0
    q = query.lower()

    cluster_name, _ = identify_cluster(query)

    # +40: maps to a known high-co-citation vertical
    if cluster_name:
        s += 40

    # +30: comparison/review language inviting multi-source triangulation
    if re.search(r"\b(compared|vs|versus|top rated|review|rated|ranking)\b", q):
        s += 30

    # +30: specific enough to match editorial/review content
    if re.search(r"\b(best|top|recommended)\b", q) and len(q.split()) >= 5:
        s += 30

    # -20: pure informational likely to cite only Wikipedia
    if re.search(r"\b(what is|define|meaning of|history of)\b", q):
        s -= 20

    return max(0, min(100, s))
