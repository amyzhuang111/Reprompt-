// Turn 1 fitness scorer: optimized as conversation opener for max citation rate.

export function score(query: string): number {
  let s = 0;
  const q = query.toLowerCase().trim();

  const grounding = [
    /\bwhat are the (best|top|most)\b/,
    /\bwhich \w+ (is|are)\b/,
    /\btop[- ]rated\b/,
    /\bbest \w+ for\b/,
    /\bwhat is the best\b/,
  ];
  if (grounding.some(p => p.test(q))) s += 40;

  const contextRefs = [/\bthat one\b/, /\bthe above\b/, /\bthose\b/, /\bthe one you\b/, /\bas you (said|mentioned)\b/, /^it\b/];
  if (!contextRefs.some(p => p.test(q))) s += 30;

  const words = q.split(/\s+/);
  if (words.length > 4 && words.length < 20 && /\b(for|best|top|rated|recommended)\b/.test(q)) s += 30;

  const followup = [/\bcan you explain\b/, /\btell me more\b/, /\bwhat about\b/, /\bexpand on\b/, /\bgo (deeper|further)\b/, /\belaborate\b/];
  if (followup.some(p => p.test(q))) s -= 40;

  return Math.max(0, Math.min(100, s));
}
