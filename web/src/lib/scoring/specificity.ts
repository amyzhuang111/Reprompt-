// Specificity scorer: SKU-matchable details

const CATEGORIES = [
  /\b(laptop|phone|tablet|headphone|speaker|camera|monitor|keyboard|mouse)\b/,
  /\b(chair|desk|sofa|couch|table|mattress|pillow|lamp|rug|shelf)\b/,
  /\b(shoe|sneaker|boot|jacket|shirt|pants|dress|watch|backpack|bag)\b/,
  /\b(cream|serum|supplement|vitamin|protein|mask|shampoo|toothbrush)\b/,
  /\b(organizer|storage|container|rack|holder|basket|bin|tray)\b/,
  /\b(blender|mixer|pan|pot|knife|grill|oven|coffee maker|air fryer)\b/,
];
const PRICE = [/\$\d+/, /\bunder \$?\d+\b/, /\bbudget\b/, /\bcheap\b/, /\baffordable\b/, /\bmid-range\b/];
const SIZE = [/\b\d+[\"']\b/, /\b\d+\s?(inch|mm|cm|ft|oz|lb|gallon|liter)\b/, /\b(small|medium|large|king|queen|twin|full)\b/];
const MATERIAL = [/\b(leather|wood|metal|steel|cotton|bamboo|foam|gel|ceramic|glass|silicone|mesh)\b/];
const PERSONA = [/\bfor\s+(a\s+)?\w+\s+(who|that|with)\b/, /\bfor\s+(kids|children|adults|seniors|beginners|professionals|gamers|runners|students|travelers)\b/];

export function score(query: string): number {
  let s = 0;
  const q = query.toLowerCase().trim();
  if (CATEGORIES.some(p => p.test(q))) s += 30;
  if (PRICE.some(p => p.test(q))) s += 20;
  if (SIZE.some(p => p.test(q))) s += 20;
  if (MATERIAL.some(p => p.test(q))) s += 15;
  if (PERSONA.some(p => p.test(q))) s += 15;
  return Math.max(0, Math.min(100, s));
}
