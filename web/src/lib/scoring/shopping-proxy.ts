// Shopping intent scorer: estimates how likely a query surfaces product results.

const cache = new Map<string, number>();

function heuristicScore(query: string): number {
  const q = query.toLowerCase();
  let s = 0;
  if (/\b(best|top|buy|cheap|affordable|recommended)\b/.test(q)) s += 35;
  if (/\$\d+|\bunder \$?\d+\b|\bbudget\b/.test(q)) s += 20;
  if (/\b(vs|versus|compared|or which)\b/.test(q)) s += 15;
  if (/\b(laptop|phone|chair|desk|shoe|headphone|mattress|sofa|camera|watch|blender|organizer|pillow|supplement|cream|earbuds|monitor|keyboard|mouse|tablet|speaker|router|projector|microphone|backpack|jacket|alarm|curtain|blanket|purifier|vacuum|fryer|knife|rack|shelf|lamp)\b/.test(q)) s += 25;
  if (/\b(hurts?|pain|ache|can'?t|trouble|struggling|keeps?|too (bright|loud|hot|cold|small|big))\b/.test(q)) s += 15;
  if (/\bhow to (fix|stop|reduce|improve|deal|organize|set up|start)\b/.test(q)) s += 15;
  if (/\bi (need|want)\b/.test(q)) s += 15;
  if (/\b(what is the meaning|explain the concept|history of|define)\b/.test(q)) s -= 30;
  return Math.max(0, Math.min(100, s));
}

export function scoreQuery(query: string): number {
  if (cache.has(query)) return cache.get(query)!;
  const s = heuristicScore(query);
  cache.set(query, s);
  return s;
}
