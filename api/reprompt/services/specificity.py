"""Specificity scorer: SKU-matchable details like category, price, size, material, persona."""

import re


_CATEGORIES = [
    r"\b(laptop|phone|tablet|headphone|speaker|camera|monitor|keyboard|mouse)\b",
    r"\b(chair|desk|sofa|couch|table|mattress|pillow|lamp|rug|shelf)\b",
    r"\b(shoe|sneaker|boot|jacket|shirt|pants|dress|watch|backpack|bag)\b",
    r"\b(cream|serum|supplement|vitamin|protein|mask|shampoo|toothbrush)\b",
    r"\b(organizer|storage|container|rack|holder|basket|bin|tray)\b",
    r"\b(blender|mixer|pan|pot|knife|grill|oven|coffee maker|air fryer)\b",
]

_PRICE = [r"\$\d+", r"\bunder \$?\d+\b", r"\bbudget\b", r"\bcheap\b", r"\baffordable\b", r"\bmid-range\b"]

_SIZE = [r"\b\d+[\"']\b", r"\b\d+\s?(inch|mm|cm|ft|oz|lb|gallon|liter)\b", r"\b(small|medium|large|king|queen|twin|full)\b"]

_MATERIAL = [r"\b(leather|wood|metal|steel|cotton|bamboo|foam|gel|ceramic|glass|silicone|mesh)\b"]

_PERSONA = [r"\bfor\s+(a\s+)?\w+\s+(who|that|with)\b", r"\bfor\s+(kids|children|adults|seniors|beginners|professionals|gamers|runners|students|travelers)\b"]


def score(query: str) -> int:
    s = 0
    q = query.lower().strip()

    if any(re.search(p, q) for p in _CATEGORIES):
        s += 30
    if any(re.search(p, q) for p in _PRICE):
        s += 20
    if any(re.search(p, q) for p in _SIZE):
        s += 20
    if any(re.search(p, q) for p in _MATERIAL):
        s += 15
    if any(re.search(p, q) for p in _PERSONA):
        s += 15

    return max(0, min(100, s))
