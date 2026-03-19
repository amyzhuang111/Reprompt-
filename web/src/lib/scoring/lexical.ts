// Lexical signal scorer: transactional keywords, product attributes, comparison language.

const TRANSACTIONAL = [/\b(best|top|recommended|buy|purchase|order|cheap|affordable|deal)\b/];
const PRODUCT_ATTRS = [/\b(size|color|material|price|inch|lb|oz|watt|gallon|pack)\b/, /\$\d+/, /\bunder \$?\d+\b/];
const COMPARISON = [/\b(vs|versus|compared|or|which|better|worse)\b/];
const USE_CASE = [/\bfor\s+\w+/];
const INFORMATIONAL = [/\b(what is|how does|explain|history of|define|meaning of)\b/];
const PROBLEM_STATEMENT = [
  /\b(hurts?|pain|ache|sore|can'?t sleep|trouble|struggling|losing|broken|dying|dropping)\b/,
  /\bmy .{3,30}(hurts?|pain|sore|broken|dies|too|keeps?|won'?t|doesn'?t|isn'?t)\b/,
  /\b(how to (fix|stop|reduce|improve|deal|get rid))\b/,
  /\bi (need|want|keep|have|get|wake)\b/,
];
const RECOMMENDATION = [/\brecommend\w*\b/, /\bsuggestion\w*\b/, /\bwhat (should|do you|would you|can)\b/, /\b(tips|advice|help|ideas)\b/];

export function score(query: string): number {
  let s = 0;
  const q = query.toLowerCase().trim();
  if (TRANSACTIONAL.some(p => p.test(q))) s += 25;
  if (PRODUCT_ATTRS.some(p => p.test(q))) s += 15;
  if (COMPARISON.some(p => p.test(q))) s += 15;
  if (USE_CASE.some(p => p.test(q))) s += 10;
  if (PROBLEM_STATEMENT.some(p => p.test(q))) s += 20;
  if (RECOMMENDATION.some(p => p.test(q))) s += 15;
  if (INFORMATIONAL.some(p => p.test(q))) s -= 15;
  return Math.max(0, Math.min(100, s));
}
