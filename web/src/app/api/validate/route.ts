import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { scoreQuery } from "@/lib/scoring";

const JUDGE_SYSTEM = `You are analyzing a ChatGPT response to determine if it contains product recommendations.

Classify the response and return JSON with these fields:
- has_product_recs: boolean — does the response recommend specific purchasable products?
- product_count: integer — how many distinct products are mentioned by name?
- has_prices: boolean — are any prices or price ranges mentioned?
- has_comparisons: boolean — does it compare multiple products?
- has_specific_brands: boolean — are specific brand names mentioned?
- product_names: list of strings — the specific products mentioned
- confidence: float 0-1 — how confident are you in this classification?

Return ONLY valid JSON, no other text.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query } = body;
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const breakdown = scoreQuery(query);

  // Step 1: Get ChatGPT's response
  const chatResponse = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: query }],
    max_tokens: 1024,
    temperature: 0.7,
  });
  const responseText = chatResponse.choices[0].message.content || "";

  // Step 2: Judge the response
  const judgeResponse = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: JUDGE_SYSTEM },
      { role: "user", content: `Query: ${query}\n\nChatGPT Response:\n${responseText}` },
    ],
    max_tokens: 512,
    temperature: 0,
  });
  const judgeText = judgeResponse.choices[0].message.content || "{}";

  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(judgeText);
  } catch {
    const start = judgeText.indexOf("{");
    const end = judgeText.lastIndexOf("}") + 1;
    analysis = start >= 0 && end > start ? JSON.parse(judgeText.slice(start, end)) : { has_product_recs: false, product_count: 0, confidence: 0 };
  }

  let triggerScore = 0;
  if (analysis.has_product_recs) triggerScore += 40;
  triggerScore += Math.min(30, (Number(analysis.product_count) || 0) * 10);
  if (analysis.has_prices) triggerScore += 15;
  if (analysis.has_comparisons) triggerScore += 10;
  if (analysis.has_specific_brands) triggerScore += 5;
  triggerScore = Math.min(100, triggerScore);

  return NextResponse.json({
    query,
    chatgpt_response: responseText,
    has_product_recs: Boolean(analysis.has_product_recs),
    product_count: Number(analysis.product_count) || 0,
    has_prices: Boolean(analysis.has_prices),
    has_comparisons: Boolean(analysis.has_comparisons),
    has_specific_brands: Boolean(analysis.has_specific_brands),
    product_names: (analysis.product_names as string[]) || [],
    confidence: Number(analysis.confidence) || 0,
    trigger_score: triggerScore,
    heuristic_score: breakdown.composite,
    model: "gpt-4o-mini",
  });
}
