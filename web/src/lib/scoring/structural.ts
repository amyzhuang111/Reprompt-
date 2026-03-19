// Structural signal scorer: query length, question type, modifiers.

const MODIFIERS = [
  /\b(lightweight|portable|ergonomic|durable|waterproof|compact|adjustable)\b/,
  /\b(premium|budget|mid-range|professional|beginner)\b/,
  /\b(small|medium|large|mini|full-size)\b/,
];

function lengthScore(wordCount: number): number {
  if (wordCount <= 3) return 0;
  if (wordCount <= 7) return Math.floor(100 * (wordCount - 3) / 4);
  if (wordCount <= 15) return Math.floor(100 * (15 - wordCount) / 8);
  return 0;
}

function questionTypeScore(query: string): number {
  const q = query.toLowerCase().trim();
  if (/^\bbest\b/.test(q)) return 90;
  if (/^\b(which|what)\b/.test(q) && /\b(product|brand|model|option|item)\b|[a-z]+er\b/.test(q)) return 80;
  if (/^\b(which|what)\b/.test(q)) return 60;
  if (/^\bhow to\b/.test(q)) return 30;
  return 40;
}

export function score(query: string): number {
  const words = query.trim().split(/\s+/);
  let s = 0;
  s += Math.floor(0.5 * lengthScore(words.length));
  s += Math.floor(0.3 * questionTypeScore(query));
  if (MODIFIERS.some(p => p.test(query.toLowerCase()))) s += 20;
  return Math.max(0, Math.min(100, s));
}
