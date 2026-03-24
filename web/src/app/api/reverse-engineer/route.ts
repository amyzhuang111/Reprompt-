import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const maxDuration = 60;

const QUERY_GEN_PROMPT = `You are generating realistic customer queries for competitive AI search analysis.

Given a product category and two competing brands, generate 5 diverse queries that real customers would type into ChatGPT. Mix these types:
- 1 broad recommendation query ("best X", "top X for Y")
- 2 comparison queries that could naturally include these brands ("X vs Y", "which X is better for Z")
- 1 problem-based query ("I have [problem], what should I buy")
- 1 specific query with constraints ("best X under $Y for Z")

Rules:
- Make them natural — how real people actually ask
- Don't force brand names into every query — let ChatGPT decide who to recommend
- Include 1-2 queries where brand names naturally appear (e.g., "is [brand] worth it" or "[brand A] vs [brand B]")

Return ONLY a JSON array of strings (the queries).`;

const EXTRACT_PROMPT = `Analyze this ChatGPT response and extract ALL specific product recommendations and brand mentions.

Return a JSON object with:
- "brands": array of brand/company names mentioned (e.g., ["Casper", "Purple", "Tuft & Needle"])
- "products": array of specific product names (e.g., ["Casper Wave Hybrid", "Purple Mattress"])
- "has_product_recs": boolean - does this response recommend specific purchasable products?
- "recommendation_strength": "strong" | "moderate" | "none"

Return ONLY valid JSON.`;

// URL finding is now done via OpenAI web search instead of guessing

const ANALYSIS_PROMPT = `You are an AI Search expert analyzing WHY a competitor brand gets recommended by ChatGPT while another brand doesn't.

You have REAL data:
1. Gap queries — queries where the competitor was recommended but the user's brand was NOT
2. ChatGPT's actual responses for those queries
3. REAL content from both brands' actual product pages (fetched from their websites)

Your job: identify the EXACT sentences, headers, structures, and data points on the competitor's page that cause ChatGPT to cite them — at the sentence level, not generic advice.

For each pattern you find, you must:
- Quote the exact text from the competitor's real page that drives citation
- Identify the exact section/paragraph on the user's page that is weak or missing
- Explain WHY this specific element drives AI citation (based on observed AI patterns, not speculation)

Focus areas:
1. HEADERS & STRUCTURE: Which specific H1/H2/H3 on the competitor page match how users prompt AI?
2. DATA POINTS: Which exact numbers, specs, prices on the competitor page make it SKU-matchable?
3. Q&A PATTERNS: Which sentences on the competitor page directly answer common prompts?
4. AUTHORITY SENTENCES: Which specific sentences mention reviews, certifications, awards?
5. COMPARISON ELEMENTS: Which tables, "vs" sections, or side-by-side content exists?
6. FRESHNESS MARKERS: Which date/year references signal recency?

Return JSON:
{
  "competitor_strengths": ["3-5 specific things — quote exact text from competitor page"],
  "user_gaps": ["3-5 specific things — quote what's weak/missing on user's page"],
  "content_patterns": [
    {
      "signal": "signal name",
      "competitor_has": "EXACT quote from their real page that drives citation",
      "user_missing": "what the user's page specifically lacks at this location",
      "importance": "high" | "medium" | "low",
      "why_it_matters": "why this specific element causes AI to cite the competitor"
    }
  ],
  "summary": "2-3 sentence executive summary based on the REAL page comparison"
}

Return ONLY valid JSON.`;

const RECOMMENDATIONS_PROMPT = `You are an AEO strategist generating specific, actionable recommendations with READY-TO-IMPLEMENT fixes.

You have REAL data: the actual content of both brands' product pages, ChatGPT's real responses, and analysis of specific gaps.

Generate 5-7 specific action items. For each action, you MUST include:
1. The exact section/sentence on the user's page to change (or where to add new content)
2. A REWRITTEN version — the actual text they should use, ready to copy-paste

Rules:
- Each action must include a "rewrite" field with the ACTUAL text to add or replace
- Be specific: write the exact heading, paragraph, or section they should add
- Rank by predicted impact (high/medium/low) based on what the competitor's page has
- Reference the specific gap query each fix addresses
- Do NOT fabricate percentage predictions — use qualitative impact levels only

Return JSON:
{
  "actions": [
    {
      "title": "short action title",
      "description": "what to change and why, referencing the real page",
      "current_text": "the current weak text on user's page (quote it, or 'not present' if missing)",
      "rewrite": "the EXACT replacement text to use — ready to copy-paste. Write the full paragraph, heading, or section.",
      "impact": "high" | "medium" | "low",
      "target_query": "the specific query this would help with",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}

Return ONLY valid JSON.`;

function emit(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + "\n"));
}

function parseJSON(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}") + 1;
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e));
    const as = text.indexOf("[");
    const ae = text.lastIndexOf("]") + 1;
    if (as >= 0 && ae > as) return { items: JSON.parse(text.slice(as, ae)) };
    return {};
  }
}

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { brand, competitor, category } = body;

  if (!brand || !competitor || !category) {
    return new Response(JSON.stringify({ error: "brand, competitor, and category are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Stage 1: Generate queries ──
        emit(controller, { step: "status", stage: 0, message: "Generating customer queries..." });

        const queryMsg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: QUERY_GEN_PROMPT,
          messages: [
            {
              role: "user",
              content: `Product category: ${category}\nBrand A (user's brand): ${brand}\nBrand B (competitor): ${competitor}`,
            },
          ],
        });

        const queryText = queryMsg.content[0].type === "text" ? queryMsg.content[0].text : "[]";
        let queries: string[];
        try {
          queries = JSON.parse(queryText);
        } catch {
          const s = queryText.indexOf("["),
            e = queryText.lastIndexOf("]") + 1;
          queries = s >= 0 && e > s ? JSON.parse(queryText.slice(s, e)) : [];
        }

        emit(controller, { step: "queries", queries });

        // ── Stage 2: Probe ChatGPT WITH WEB SEARCH + find brand pages ──
        emit(controller, { step: "status", stage: 1, message: "Probing ChatGPT with real web search..." });

        // Probe ChatGPT using Responses API with web_search_preview (real browsing)
        const results = await Promise.all(
          queries.map(async (query) => {
            let responseText = "";
            try {
              const response = await openai.responses.create({
                model: "gpt-4o-mini",
                tools: [{ type: "web_search_preview" as const }],
                input: query,
              });
              // Extract text from response output
              for (const item of response.output) {
                if (item.type === "message") {
                  for (const c of item.content) {
                    if (c.type === "output_text") {
                      responseText += c.text;
                    }
                  }
                }
              }
            } catch {
              // Fallback to chat completions if Responses API fails
              const chatRes = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: query }],
                max_tokens: 1024,
                temperature: 0.7,
              });
              responseText = chatRes.choices[0].message.content || "";
            }

            // Extract brands/products
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
            const analysis = parseJSON(extractText);

            return {
              query,
              response: responseText,
              response_preview: responseText.slice(0, 400) + (responseText.length > 400 ? "..." : ""),
              brands: (analysis.brands as string[]) || [],
              products: (analysis.products as string[]) || [],
              has_product_recs: Boolean(analysis.has_product_recs),
              recommendation_strength: (analysis.recommendation_strength as string) || "none",
            };
          })
        );

        emit(controller, { step: "responses", results });

        // ── Stage 3: Gap identification ──
        emit(controller, { step: "status", stage: 2, message: "Identifying competitive gaps..." });

        const brandLower = brand.toLowerCase();
        const compLower = competitor.toLowerCase();

        const brandCounts: Record<string, number> = {};
        results.forEach((r) => {
          r.brands.forEach((b) => {
            const n = b.trim();
            if (n) brandCounts[n] = (brandCounts[n] || 0) + 1;
          });
        });

        const brandRanking = Object.entries(brandCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({
            name,
            appearances: count,
            share: Math.round((count / queries.length) * 100),
          }));

        const gapIndices: number[] = [];
        results.forEach((r, i) => {
          const hasComp = r.brands.some((b) => b.toLowerCase().includes(compLower));
          const hasUser = r.brands.some((b) => b.toLowerCase().includes(brandLower));
          if (hasComp && !hasUser) gapIndices.push(i);
        });

        const userRankIdx = brandRanking.findIndex((b) => b.name.toLowerCase().includes(brandLower));
        const compRankIdx = brandRanking.findIndex((b) => b.name.toLowerCase().includes(compLower));

        const gaps = {
          brand_ranking: brandRanking,
          user_rank: userRankIdx >= 0 ? userRankIdx + 1 : null,
          user_appearances: userRankIdx >= 0 ? brandRanking[userRankIdx].appearances : 0,
          competitor_rank: compRankIdx >= 0 ? compRankIdx + 1 : null,
          competitor_appearances: compRankIdx >= 0 ? brandRanking[compRankIdx].appearances : 0,
          gap_indices: gapIndices,
          gap_count: gapIndices.length,
          total_queries: queries.length,
        };

        emit(controller, { step: "gaps", gaps });

        // ── Stage 4: Find and fetch REAL product pages via web search ──
        emit(controller, { step: "status", stage: 3, message: "Searching for real product pages..." });

        // Use OpenAI web search to find actual product page URLs
        const findUrls = async (brandName: string): Promise<{ label: string; url: string }[]> => {
          try {
            const searchResponse = await openai.responses.create({
              model: "gpt-4o-mini",
              tools: [{ type: "web_search_preview" as const }],
              input: `Find the official product page URL for ${brandName} ${category}. Return ONLY the URLs, one per line. Include the main product/category page and any review or comparison page if it exists on their official site.`,
            });
            let urlText = "";
            for (const item of searchResponse.output) {
              if (item.type === "message") {
                for (const c of item.content) {
                  if (c.type === "output_text") urlText += c.text;
                }
              }
            }
            // Extract URLs from the response
            const urlMatches = urlText.match(/https?:\/\/[^\s\](),"'<>]+/g) || [];
            return urlMatches.slice(0, 2).map((url, i) => ({
              label: `${brandName} ${i === 0 ? "product page" : "review page"}`,
              url: url.replace(/[.)]+$/, ""), // clean trailing punctuation
            }));
          } catch {
            return [];
          }
        };

        const [brandUrls, compUrls] = await Promise.all([findUrls(brand), findUrls(competitor)]);
        const urlsToFetch = [...brandUrls, ...compUrls];

        const fetchResults = await Promise.all(
          urlsToFetch.map(async ({ label, url }) => {
            const content = await fetchPageContent(url);
            return { label, url, content, fetched: content !== null };
          })
        );

        const userPageContent = fetchResults
          .filter((r) => r.fetched && r.label.includes(brand))
          .map((r) => `[${r.label} - ${r.url}]\n${r.content!.slice(0, 3000)}`)
          .join("\n\n");

        const compPageContent = fetchResults
          .filter((r) => r.fetched && r.label.includes(competitor))
          .map((r) => `[${r.label} - ${r.url}]\n${r.content!.slice(0, 3000)}`)
          .join("\n\n");

        const fetchedCount = fetchResults.filter((r) => r.fetched).length;
        const fetchedSummary = fetchResults.map((r) => ({
          label: r.label,
          url: r.url,
          fetched: r.fetched,
        }));

        emit(controller, { step: "content_fetched", fetched_count: fetchedCount, pages: fetchedSummary });

        // ── Stage 5: Content pattern analysis with REAL page data ──
        emit(controller, { step: "status", stage: 4, message: "Analyzing real page content..." });

        const gapContext = gapIndices.length > 0
          ? gapIndices
              .map((i) => `Query: "${results[i].query}"\nChatGPT recommended: ${results[i].brands.join(", ")}\nResponse: ${results[i].response.slice(0, 600)}`)
              .join("\n\n---\n\n")
          : results
              .map((r) => `Query: "${r.query}"\nChatGPT recommended: ${r.brands.join(", ")}\nResponse: ${r.response.slice(0, 400)}`)
              .join("\n\n---\n\n");

        const analysisInput = [
          `User's brand: ${brand}`,
          `Competitor brand: ${competitor}`,
          `Category: ${category}`,
          ``,
          `=== ${brand.toUpperCase()}'S REAL PRODUCT PAGE CONTENT ===`,
          userPageContent || `(Could not fetch ${brand}'s product page)`,
          ``,
          `=== ${competitor.toUpperCase()}'S REAL PRODUCT PAGE CONTENT ===`,
          compPageContent || `(Could not fetch ${competitor}'s product page)`,
          ``,
          gapIndices.length > 0
            ? `=== GAP QUERIES (competitor recommended, ${brand} NOT) ===`
            : `=== ALL CHATGPT RESPONSES ===`,
          gapContext,
        ].join("\n");

        const analysisMsg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          system: ANALYSIS_PROMPT,
          messages: [{ role: "user", content: analysisInput }],
        });

        const analysisText = analysisMsg.content[0].type === "text" ? analysisMsg.content[0].text : "{}";
        const contentAnalysis = parseJSON(analysisText);

        emit(controller, { step: "analysis", analysis: contentAnalysis });

        // ── Stage 6: Generate recommendations based on REAL content ──
        emit(controller, { step: "status", stage: 5, message: "Generating action plan..." });

        try {
          const recsInput = [
            `Brand: ${brand}`,
            `Competitor: ${competitor}`,
            `Category: ${category}`,
            ``,
            `Content analysis: ${JSON.stringify(contentAnalysis)}`,
            ``,
            `${brand}'s real page content summary: ${userPageContent.slice(0, 1500) || "Not fetched"}`,
            `${competitor}'s real page content summary: ${compPageContent.slice(0, 1500) || "Not fetched"}`,
            ``,
            gapIndices.length > 0
              ? `Gap queries:\n${gapIndices.map((i) => `- "${results[i].query}"`).join("\n")}`
              : `All queries:\n${queries.map((q) => `- "${q}"`).join("\n")}`,
          ].join("\n");

          const recsMsg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            system: RECOMMENDATIONS_PROMPT,
            messages: [{ role: "user", content: recsInput }],
          });

          const recsText = recsMsg.content[0].type === "text" ? recsMsg.content[0].text : "{}";
          const recommendations = parseJSON(recsText);

          emit(controller, {
            step: "recommendations",
            actions: (recommendations.actions as unknown[]) || [],
          });
        } catch (recErr) {
          emit(controller, { step: "recommendations", actions: [], error: String(recErr) });
        }

        // ── Stage 7: Unsolicited rec rate measurement ──
        emit(controller, { step: "status", stage: 6, message: "Measuring unsolicited recommendation rate..." });

        try {
          // Generate 5 informational queries (NOT shopping queries) for this category
          const infoQueryMsg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 512,
            system: `Generate 10 INFORMATIONAL queries about "${category}" where the user is NOT shopping. Mix: 2 "how does X work", 2 "what is the typical", 2 "how to fix [problem]", 2 "why do", 2 "is it worth/do I need". Return ONLY a JSON array of 10 strings.`,
            messages: [{ role: "user", content: `Category: ${category}` }],
          });

          const infoText = infoQueryMsg.content[0].type === "text" ? infoQueryMsg.content[0].text : "[]";
          let infoQueries: string[];
          try { infoQueries = JSON.parse(infoText); }
          catch { const s = infoText.indexOf("["), e = infoText.lastIndexOf("]") + 1; infoQueries = s >= 0 && e > s ? JSON.parse(infoText.slice(s, e)) : []; }

          // Send to ChatGPT and check for unsolicited recs
          const unsolicitedResults = await Promise.all(
            infoQueries.map(async (q) => {
              let respText = "";
              try {
                const resp = await openai.responses.create({
                  model: "gpt-4o-mini",
                  tools: [{ type: "web_search_preview" as const }],
                  input: q,
                });
                for (const item of resp.output) {
                  if (item.type === "message") {
                    for (const c of item.content) {
                      if (c.type === "output_text") respText += c.text;
                    }
                  }
                }
              } catch {
                const chatR = await openai.chat.completions.create({
                  model: "gpt-4o-mini",
                  messages: [{ role: "user", content: q }],
                  max_tokens: 512,
                });
                respText = chatR.choices[0].message.content || "";
              }

              // Judge if unsolicited recs present
              const judgeR = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: `Did this ChatGPT response to an INFORMATIONAL query include unsolicited product recommendations (specific brand/product names)? Return JSON: {"has_recs": boolean, "products": ["brand/product names"]}. Return ONLY valid JSON.` },
                  { role: "user", content: `Query: "${q}"\nResponse: ${respText.slice(0, 800)}` },
                ],
                max_tokens: 256,
                temperature: 0,
              });
              const judgeText = judgeR.choices[0].message.content || "{}";
              const judgment = parseJSON(judgeText);

              return {
                query: q,
                has_recs: Boolean(judgment.has_recs),
                products: (judgment.products as string[]) || [],
              };
            })
          );

          const unsolicitedTriggered = unsolicitedResults.filter(r => r.has_recs).length;
          const unsolicitedRate = Math.round((unsolicitedTriggered / infoQueries.length) * 100);

          emit(controller, {
            step: "unsolicited",
            total: infoQueries.length,
            triggered: unsolicitedTriggered,
            rate: unsolicitedRate,
            results: unsolicitedResults,
          });
        } catch {
          // Non-fatal — skip if it fails
          emit(controller, { step: "unsolicited", total: 0, triggered: 0, rate: 0, results: [] });
        }

        // ── Done ──
        emit(controller, { step: "complete" });
      } catch (e) {
        emit(controller, { step: "error", message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
