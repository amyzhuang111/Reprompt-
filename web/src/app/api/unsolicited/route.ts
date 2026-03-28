import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const maxDuration = 60;

const QUERY_GEN_PROMPT = `Generate 15 INFORMATIONAL queries about a product category. These must be questions where the user is NOT shopping — they are asking for information, education, or advice. NOT "best X" or "buy X" or "recommend X."

Mix these types:
- 3 "how does X work" / educational queries
- 3 "what is the typical/average" / factual queries
- 3 "how to" / problem-solving queries (the problem, not the product)
- 3 "why do/does" / explanatory queries
- 3 "is it worth / do I need" / evaluative queries

Examples for mattresses:
- "How does memory foam work?"
- "What's the typical lifespan of a mattress?"
- "How to fix lower back pain from sleeping"
- "Why do some mattresses sleep hot?"
- "Is it worth spending more on a mattress?"
- "How often should you replace your mattress?"
- "What causes mattress sagging?"
- "How to tell if your mattress is too firm"
- "What's the difference between firm and medium firm?"
- "Do mattress toppers actually help?"

Rules:
- These must be INFORMATIONAL queries — a user seeking knowledge, NOT products
- If ChatGPT inserts product recommendations into these answers, that's an UNSOLICITED recommendation
- Make them diverse — different angles, different sub-topics
- Make them realistic — how real people actually ask

Return ONLY a JSON array of 15 strings.`;

const JUDGE_PROMPT = `Analyze this ChatGPT response to an INFORMATIONAL query. The user was NOT asking for product recommendations — they asked an informational question.

Determine: did ChatGPT insert UNSOLICITED product recommendations into this informational answer?

An unsolicited recommendation is when ChatGPT mentions specific purchasable products (by brand name) in response to a question that didn't ask for products.

Examples of UNSOLICITED recs:
- User asks "how does memory foam work?" → ChatGPT explains AND recommends "Casper Original" and "Purple Mattress"
- User asks "what's the typical price range for dining sets?" → ChatGPT gives price info AND links to specific products

Examples of NOT unsolicited:
- User asks "how does memory foam work?" → ChatGPT only explains the science, no products named
- User asks "is memory foam good?" → ChatGPT discusses pros/cons generically, no specific brands

Return JSON:
{
  "has_unsolicited_recs": boolean,
  "product_names": ["specific products/brands mentioned as recommendations"],
  "rec_type": "none" | "soft" | "explicit",
  "explanation": "brief explanation of what ChatGPT did — did it stay informational or insert products?"
}

"soft" = mentioned brands in passing or as examples
"explicit" = directly recommended specific products with details

Return ONLY valid JSON.`;

function emit(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + "\n"));
}

function parseJSON(text: string): Record<string, unknown> {
  try { return JSON.parse(text); }
  catch {
    const s = text.indexOf("{"), e = text.lastIndexOf("}") + 1;
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e));
    const as = text.indexOf("["), ae = text.lastIndexOf("]") + 1;
    if (as >= 0 && ae > as) return { items: JSON.parse(text.slice(as, ae)) };
    return {};
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { category } = body;

  if (!category) {
    return new Response(JSON.stringify({ error: "category is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Stage 1: Generate informational queries ──
        emit(controller, { step: "status", stage: 0, message: "Generating informational queries..." });

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

        emit(controller, { step: "queries", queries });

        // ── Stage 2: Send all queries to ChatGPT with web search ──
        emit(controller, { step: "status", stage: 1, message: `Probing ChatGPT with ${queries.length} informational queries...` });

        const results = await Promise.all(
          queries.map(async (query) => {
            let responseText = "";
            try {
              const response = await openai.responses.create({
                model: "gpt-4o-mini",
                tools: [{ type: "web_search_preview" as const }],
                input: query,
              });
              for (const item of response.output) {
                if (item.type === "message") {
                  for (const c of item.content) {
                    if (c.type === "output_text") responseText += c.text;
                  }
                }
              }
            } catch {
              const chatRes = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: query }],
                max_tokens: 1024,
                temperature: 0.7,
              });
              responseText = chatRes.choices[0].message.content || "";
            }

            // Judge: did ChatGPT insert unsolicited product recs?
            const judgeRes = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: JUDGE_PROMPT },
                { role: "user", content: `Informational query: "${query}"\n\nChatGPT response:\n${responseText}` },
              ],
              max_tokens: 512,
              temperature: 0,
            });
            const judgeText = judgeRes.choices[0].message.content || "{}";
            const judgment = parseJSON(judgeText);

            return {
              query,
              response_preview: responseText.slice(0, 300) + (responseText.length > 300 ? "..." : ""),
              has_unsolicited_recs: Boolean(judgment.has_unsolicited_recs),
              product_names: (judgment.product_names as string[]) || [],
              rec_type: (judgment.rec_type as string) || "none",
              explanation: (judgment.explanation as string) || "",
            };
          })
        );

        emit(controller, { step: "responses", results });

        // ── Stage 3: Calculate actual unsolicited rec rate ──
        emit(controller, { step: "status", stage: 2, message: "Calculating unsolicited recommendation rate..." });

        const totalQueries = results.length;
        const triggered = results.filter(r => r.has_unsolicited_recs);
        const triggeredCount = triggered.length;
        const triggerRate = Math.round((triggeredCount / totalQueries) * 100);

        const softRecs = results.filter(r => r.rec_type === "soft").length;
        const explicitRecs = results.filter(r => r.rec_type === "explicit").length;

        // Collect all unsolicited product mentions
        const allProducts: Record<string, number> = {};
        triggered.forEach(r => {
          r.product_names.forEach(p => {
            allProducts[p] = (allProducts[p] || 0) + 1;
          });
        });
        const topProducts = Object.entries(allProducts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, mentions: count }));

        const measurement = {
          total_queries: totalQueries,
          triggered_count: triggeredCount,
          trigger_rate: triggerRate,
          soft_recs: softRecs,
          explicit_recs: explicitRecs,
          top_products: topProducts,
          queries_that_triggered: triggered.map(r => ({
            query: r.query,
            products: r.product_names,
            type: r.rec_type,
          })),
          queries_that_didnt: results.filter(r => !r.has_unsolicited_recs).map(r => r.query),
        };

        emit(controller, { step: "measurement", measurement });

        // ── Stage 4: Analysis ──
        emit(controller, { step: "status", stage: 3, message: "Analyzing patterns..." });

        const analysisMsg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          system: `You are analyzing real unsolicited recommendation data from ChatGPT. These are MEASURED results, not estimates.

${triggeredCount} out of ${totalQueries} informational queries about "${category}" triggered unsolicited product recommendations (${triggerRate}%).

Published research found unsolicited recs grew from 15% to 28% between Sep 2025 and Jan 2026 (from a 100k prompt study). Compare this measured rate to that benchmark.

Provide analysis:
1. How does this category's rate compare to the overall research findings?
2. What patterns do you see in WHICH queries triggered recs vs which didn't?
3. What does this tell brands in this category?

Return JSON:
{
  "summary": "2-3 sentence summary of findings",
  "benchmark_comparison": "how this rate compares to the 15-28% benchmark range",
  "pattern_insights": ["2-3 insights about which query types triggered recs"],
  "brand_implications": ["2-3 implications for brands in this category"]
}

Return ONLY valid JSON.`,
          messages: [{
            role: "user",
            content: `Category: ${category}\nTrigger rate: ${triggerRate}% (${triggeredCount}/${totalQueries})\n\nQueries that triggered:\n${triggered.map(r => `- "${r.query}" → products: ${r.product_names.join(", ")} (${r.rec_type})`).join("\n")}\n\nQueries that did NOT trigger:\n${results.filter(r => !r.has_unsolicited_recs).map(r => `- "${r.query}"`).join("\n")}`,
          }],
        });

        const analysisText = analysisMsg.content[0].type === "text" ? analysisMsg.content[0].text : "{}";
        const analysis = parseJSON(analysisText);

        emit(controller, { step: "analysis", analysis });
        emit(controller, { step: "complete" });
      } catch (e) {
        emit(controller, { step: "error", message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}
