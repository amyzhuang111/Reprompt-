"""Structural signal scorer: query length, question type, modifiers."""

import re


def _length_score(word_count: int) -> int:
    """Peak at 7 words (100), linear decay to 0 at 3 or 15."""
    if word_count <= 3:
        return 0
    if word_count <= 7:
        return int(100 * (word_count - 3) / 4)
    if word_count <= 15:
        return int(100 * (15 - word_count) / 8)
    return 0


def _question_type_score(query: str) -> int:
    q = query.lower().strip()
    if re.match(r"\bbest\b", q):
        return 90
    if re.match(r"\b(which|what)\b", q) and re.search(r"\b(product|brand|model|option|item)\b|[a-z]+er\b", q):
        return 80
    if re.match(r"\b(which|what)\b", q):
        return 60
    if re.match(r"\bhow to\b", q):
        return 30
    return 40


_MODIFIERS = [
    r"\b(lightweight|portable|ergonomic|durable|waterproof|compact|adjustable)\b",
    r"\b(premium|budget|mid-range|professional|beginner)\b",
    r"\b(small|medium|large|mini|full-size)\b",
]


def score(query: str) -> int:
    words = query.strip().split()
    word_count = len(words)

    s = 0
    s += int(0.5 * _length_score(word_count))
    s += int(0.3 * _question_type_score(query))
    if any(re.search(p, query.lower()) for p in _MODIFIERS):
        s += 20

    return max(0, min(100, s))
