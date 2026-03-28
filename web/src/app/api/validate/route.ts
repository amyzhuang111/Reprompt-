import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { scoreQuery } from "@/lib/scoring";

export const maxDuration = 60;

const JUDGE_SYSTEM = `You are analyzing a ChatGPT response to determine if it contains product recommendations.

Classify the response and return JSON with these fields:
- has_product_recs: boolean — does the response recommend specific purchasable products?
- product_count: integer — how many distinct products are mentioned by name?
- has_prices: boolean — are any prices or price ranges mentioned?
- has_comparisons: boolean — does it compare multiple products?
- has_specific_brands: boolean — are specific brand names mentioned?
- product_names: list of strings — the specific products mentioned (brand + product name)
- confidence: float 0-1 — how confident are you in this classification?

Return ONLY valid JSON, no other text.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query } = body;
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const breakdown = scoreQuery(query);

  // Shopping trigger methodology:
  // "If the prompt's main noun is something you could buy on Amazon, Shopping is likely to appear"
  // Category-driven, not intent-driven. 95-97% accuracy.
  const amazonTest = breakdown.category !== "none" &&
    breakdown.category !== "services" &&
    breakdown.category !== "software" &&
    breakdown.category !== "financial" &&
    breakdown.category !== "travel";
  const hasConstraints = /\b(under|over|around|best|for|with)\b.*\b(\$\d|price|budget|cheap|specific)/i.test(query);
  const shoppingPrediction = amazonTest ? (hasConstraints ? "very_likely" : "likely") : "unlikely";

  // Step 1: Send query to ChatGPT with web search
  // We send TWO messages: the original query, then a follow-up asking for product recommendations.
  // This simulates ChatGPT Shopping behavior — on chatgpt.com, Shopping cards are injected
  // alongside informational responses. The API doesn't have Shopping, so we probe explicitly.
  let responseText = "";
  let shoppingResponseText = "";

  try {
    // First: get the natural response with web search
    const naturalResponse = await client.responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" as const }],
      input: query,
    });
    for (const item of naturalResponse.output) {
      if (item.type === "message") {
        for (const c of item.content) {
          if (c.type === "output_text") responseText += c.text;
        }
      }
    }

    // Second: probe for products (simulating ChatGPT Shopping behavior)
    // ChatGPT inserts product cards even in informational responses
    const shoppingProbe = await client.responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" as const }],
      input: `Based on this query: "${query}"

What specific products would you recommend? Include brand names, model names, approximate prices, and why each product is relevant. List at least 3-5 specific products with details.`,
    });
    for (const item of shoppingProbe.output) {
      if (item.type === "message") {
        for (const c of item.content) {
          if (c.type === "output_text") shoppingResponseText += c.text;
        }
      }
    }
  } catch {
    // Fallback to chat completions
    const chatResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: query }],
      max_tokens: 1024,
      temperature: 0.7,
    });
    responseText = chatResponse.choices[0].message.content || "";

    const shoppingChat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: query },
        { role: "assistant", content: responseText },
        { role: "user", content: "What specific products would you recommend for this? Include brand names, model names, and approximate prices." },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });
    shoppingResponseText = shoppingChat.choices[0].message.content || "";
  }

  // Combine for full analysis
  const fullResponse = responseText + "\n\n--- Product Recommendations ---\n\n" + shoppingResponseText;

  // Step 2: Judge the natural response (did it trigger products organically?)
  const naturalJudge = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: JUDGE_SYSTEM },
      { role: "user", content: `Query: ${query}\n\nChatGPT Response:\n${responseText}` },
    ],
    max_tokens: 512,
    temperature: 0,
  });
  const naturalJudgeText = naturalJudge.choices[0].message.content || "{}";
  let naturalAnalysis: Record<string, unknown>;
  try { naturalAnalysis = JSON.parse(naturalJudgeText); }
  catch { const s = naturalJudgeText.indexOf("{"), e = naturalJudgeText.lastIndexOf("}") + 1; naturalAnalysis = s >= 0 && e > s ? JSON.parse(naturalJudgeText.slice(s, e)) : {}; }

  // Step 3: Judge the shopping probe response
  const shoppingJudge = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: JUDGE_SYSTEM },
      { role: "user", content: `Query: ${query}\n\nChatGPT Response:\n${shoppingResponseText}` },
    ],
    max_tokens: 512,
    temperature: 0,
  });
  const shoppingJudgeText = shoppingJudge.choices[0].message.content || "{}";
  let shoppingAnalysis: Record<string, unknown>;
  try { shoppingAnalysis = JSON.parse(shoppingJudgeText); }
  catch { const s = shoppingJudgeText.indexOf("{"), e = shoppingJudgeText.lastIndexOf("}") + 1; shoppingAnalysis = s >= 0 && e > s ? JSON.parse(shoppingJudgeText.slice(s, e)) : {}; }

  // GPT Score based ONLY on organic/natural response (did ChatGPT recommend products without being asked?)
  const hasNaturalRecs = Boolean(naturalAnalysis.has_product_recs);
  const hasShoppingRecs = Boolean(shoppingAnalysis.has_product_recs);

  // Organic metrics only for trigger score
  const organicProductCount = Number(naturalAnalysis.product_count) || 0;
  const organicHasPrices = Boolean(naturalAnalysis.has_prices);
  const organicHasComparisons = Boolean(naturalAnalysis.has_comparisons);
  const organicHasBrands = Boolean(naturalAnalysis.has_specific_brands);

  let triggerScore = 0;
  if (hasNaturalRecs) triggerScore += 40;
  triggerScore += Math.min(30, organicProductCount * 10);
  if (organicHasPrices) triggerScore += 15;
  if (organicHasComparisons) triggerScore += 10;
  if (organicHasBrands) triggerScore += 5;
  triggerScore = Math.min(100, triggerScore);

  // Shopping probe products shown separately (not in trigger score)
  const shoppingProductNames = (shoppingAnalysis.product_names as string[]) || [];
  const organicProductNames = (naturalAnalysis.product_names as string[]) || [];
  const allProductNames = [...organicProductNames, ...shoppingProductNames].filter((v, i, a) => a.indexOf(v) === i);

  const confidence = Number(naturalAnalysis.confidence) || 0;

  return NextResponse.json({
    query,
    chatgpt_response: fullResponse,
    natural_response: responseText,
    shopping_response: shoppingResponseText,
    has_product_recs: hasNaturalRecs,
    organic_trigger: hasNaturalRecs,
    probed_trigger: hasShoppingRecs,
    product_count: organicProductCount,
    has_prices: organicHasPrices,
    has_comparisons: organicHasComparisons,
    has_specific_brands: organicHasBrands,
    product_names: organicProductNames,
    shopping_products: shoppingProductNames,
    confidence,
    trigger_score: triggerScore,
    // Shopping prediction methodology
    shopping_prediction: shoppingPrediction,
    amazon_test: amazonTest,
    has_constraints: hasConstraints,
    detected_category: breakdown.category,
    category_display: breakdown.category.replace(/_/g, " "),
    heuristic_score: breakdown.composite,
    model: "gpt-4o-mini (web search)",
  });
}
