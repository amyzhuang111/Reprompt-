"""Turn 1 fitness scorer: optimized as conversation opener for max citation rate."""

import re


def score(query: str) -> int:
    s = 0
    q = query.lower().strip()

    # +40: Factual grounding patterns that demand web search
    grounding = [
        r"\bwhat are the (best|top|most)\b",
        r"\bwhich \w+ (is|are)\b",
        r"\btop[- ]rated\b",
        r"\bbest \w+ for\b",
        r"\bwhat is the best\b",
    ]
    if any(re.search(p, q) for p in grounding):
        s += 40

    # +30: Self-contained (no prior-context references)
    context_refs = [
        r"\bthat one\b",
        r"\bthe above\b",
        r"\bthose\b",
        r"\bthe one you\b",
        r"\bas you (said|mentioned)\b",
        r"^it\b",
    ]
    if not any(re.search(p, q) for p in context_refs):
        s += 30

    # +30: Research-journey initiator (broad + specific enough)
    words = q.split()
    if 4 < len(words) < 20 and re.search(r"\b(for|best|top|rated|recommended)\b", q):
        s += 30

    # -40: Follow-up/clarification patterns
    followup = [
        r"\bcan you explain\b",
        r"\btell me more\b",
        r"\bwhat about\b",
        r"\bexpand on\b",
        r"\bgo (deeper|further)\b",
        r"\belaborate\b",
    ]
    if any(re.search(p, q) for p in followup):
        s -= 40

    return max(0, min(100, s))
