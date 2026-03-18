"""Lexical signal scorer: transactional keywords, product attributes, comparison language.

Calibrated against 135 validated ChatGPT queries (ground truth).
"""

import re


_TRANSACTIONAL = [
    r"\b(best|top|recommended|buy|purchase|order|cheap|affordable|deal)\b",
]
_PRODUCT_ATTRS = [
    r"\b(size|color|material|price|inch|lb|oz|watt|gallon|pack)\b",
    r"\$\d+",
    r"\bunder \$?\d+\b",
]
_COMPARISON = [
    r"\b(vs|versus|compared|or|which|better|worse)\b",
]
_USE_CASE = [
    r"\bfor\s+\w+",
]
_INFORMATIONAL = [
    r"\b(what is|how does|explain|history of|define|meaning of)\b",
]

# Problem/complaint patterns — ChatGPT recommends products for these
_PROBLEM_STATEMENT = [
    r"\b(hurts?|pain|ache|sore|can'?t sleep|trouble|struggling|losing|broken|dying|dropping)\b",
    r"\bmy .{3,30}(hurts?|pain|sore|broken|dies|too|keeps?|won'?t|doesn'?t|isn'?t)\b",
    r"\b(how to (fix|stop|reduce|improve|deal|get rid))\b",
    r"\bi (need|want|keep|have|get|wake)\b",
]

# Recommendation-seeking language
_RECOMMENDATION = [
    r"\brecommend\w*\b",
    r"\bsuggestion\w*\b",
    r"\bwhat (should|do you|would you|can)\b",
    r"\b(tips|advice|help|ideas)\b",
]


def score(query: str) -> int:
    s = 0
    q = query.lower().strip()

    # +25 transactional keywords
    if any(re.search(p, q) for p in _TRANSACTIONAL):
        s += 25

    # +15 product attribute mentions
    if any(re.search(p, q) for p in _PRODUCT_ATTRS):
        s += 15

    # +15 comparison / preference language
    if any(re.search(p, q) for p in _COMPARISON):
        s += 15

    # +10 use-case mention
    if any(re.search(p, q) for p in _USE_CASE):
        s += 10

    # +20 problem/complaint patterns (ChatGPT recommends products for these)
    if any(re.search(p, q) for p in _PROBLEM_STATEMENT):
        s += 20

    # +15 recommendation-seeking language
    if any(re.search(p, q) for p in _RECOMMENDATION):
        s += 15

    # -15 pure informational framing (reduced penalty — some still trigger)
    if any(re.search(p, q) for p in _INFORMATIONAL):
        s -= 15

    return max(0, min(100, s))
