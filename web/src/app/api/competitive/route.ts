import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const maxDuration = 60;

const QUERY_GEN_PROMPT = `You are generating realistic customer queries for competitive AI search analysis.

Given a product category, generate 8 diverse queries that real customers would type into ChatGPT when looking for products in this category. Mix these types:
- 2 broad recommendation queries ("best X", "top X for Y")
- 2 comparison queries ("X vs Y", "which X is better for Z")
- 2 problem-based queries ("I have [problem], what should I buy")
- 2 specific queries with constraints ("best X under $Y for Z")

Rules:
- These should be queries that would trigger product recommendations
- Make them natural — how real people actually ask
- Don't use brand names

Return ONLY a JSON array of strings (the queries).`;

const EXTRACT_PROMPT = `Analyze this ChatGPT response and extract ALL specific product recommendations and brand mentions.

Return a JSON object with:
- "brands": array of brand/company names mentioned (e.g., ["Casper", "Purple", "Tuft & Needle"])
- "products": array of specific product names (e.g., ["Casper Wave Hybrid", "Purple Mattress"])
- "has_product_recs": boolean - does this response recommend specific purchasable products?
- "recommendation_strength": "strong" | "moderate" | "none" - how explicitly does it recommend buying?

Return ONLY valid JSON.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { category, brand } = body;
  if (!category) return NextResponse.json({ error: "category is required" }, { status: 400 });

  try {
    // Step 1: Generate queries with Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const queryMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: QUERY_GEN_PROMPT,
      messages: [{ role: "user", content: `Product category: ${category}` }],
    });
    const queryText = queryMsg.content[0].type === "text" ? queryMsg.content[0].text : "[]";
    let queries: string[];
    try {
      queries = JSON.parse(queryText);
    } catch {
      const s = queryText.indexOf("["), e = queryText.lastIndexOf("]") + 1;
      queries = s >= 0 && e > s ? JSON.parse(queryText.slice(s, e)) : [];
    }

    // Step 2: Send each query to ChatGPT and extract brands
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const results = await Promise.all(queries.map(async (query) => {
      // Get ChatGPT's response
      const chatRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: query }],
        max_tokens: 1024,
        temperature: 0.7,
      });
      const responseText = chatRes.choices[0].message.content || "";

      // Extract brands/products from response
      const extractRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          { role: "user", content: `Query: ${query}\n\nChatGPT Response:\n${responseText}` },
        ],
        max_tokens: 512,
        temperature: 0,
      });
      const extractText = extractRes.choices[0].message.content || "{}";
      let analysis: Record<string, unknown>;
      try {
        analysis = JSON.parse(extractText);
      } catch {
        const s = extractText.indexOf("{"), e = extractText.lastIndexOf("}") + 1;
        analysis = s >= 0 && e > s ? JSON.parse(extractText.slice(s, e)) : { brands: [], products: [], has_product_recs: false };
      }

      return {
        query,
        response_preview: responseText.slice(0, 300) + (responseText.length > 300 ? "..." : ""),
        brands: (analysis.brands as string[]) || [],
        products: (analysis.products as string[]) || [],
        has_product_recs: Boolean(analysis.has_product_recs),
        recommendation_strength: (analysis.recommendation_strength as string) || "none",
      };
    }));

    // Step 3: Aggregate brand appearances
    const brandCounts: Record<string, number> = {};
    results.forEach(r => {
      r.brands.forEach(b => {
        const normalized = b.trim();
        if (normalized) brandCounts[normalized] = (brandCounts[normalized] || 0) + 1;
      });
    });

    // Sort brands by frequency
    const brandRanking = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        appearances: count,
        share: Math.round(count / queries.length * 100),
      }));

    // Check if user's brand appears
    const userBrandRank = brand
      ? brandRanking.findIndex(b => b.name.toLowerCase().includes(brand.toLowerCase()))
      : -1;

    const totalQueriesWithRecs = results.filter(r => r.has_product_recs).length;

    return NextResponse.json({
      category,
      brand: brand || null,
      queries_tested: queries.length,
      queries_with_recs: totalQueriesWithRecs,
      rec_rate: Math.round(totalQueriesWithRecs / queries.length * 100),
      brand_ranking: brandRanking,
      user_brand_rank: userBrandRank >= 0 ? userBrandRank + 1 : null,
      user_brand_appearances: userBrandRank >= 0 ? brandRanking[userBrandRank].appearances : 0,
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
