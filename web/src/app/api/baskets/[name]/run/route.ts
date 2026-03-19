import { NextRequest, NextResponse } from "next/server";
import { BASKETS } from "@/lib/baskets";
import { rewrite } from "@/lib/rewriter";

export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const prompts = BASKETS[name];
  if (!prompts) return NextResponse.json({ error: `Basket '${name}' not found` }, { status: 404 });

  const results = await Promise.all(prompts.map(p => rewrite(p.query, 5)));

  const originalScores = results.map(r => r.original_score);
  const bestScores = results.map(r => r.rewrites.length > 0 ? r.rewrites[0].score : r.original_score);
  const lifts = originalScores.map((o, i) => bestScores[i] - o);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return NextResponse.json({
    basket_name: name,
    prompt_count: prompts.length,
    avg_original_score: Math.round(avg(originalScores) * 10) / 10,
    avg_best_rewrite_score: Math.round(avg(bestScores) * 10) / 10,
    avg_lift: Math.round(avg(lifts) * 10) / 10,
    results,
  });
}
