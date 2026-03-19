import Anthropic from "@anthropic-ai/sdk";
import { scoreQuery, identifyCluster, turn1Score } from "./scoring";
import type { ScoreBreakdown } from "./scoring";

const SYSTEM_PROMPT = `You are an expert at rewriting queries to trigger product recommendations in AI shopping assistants like ChatGPT.

Given a user query, generate {n} rephrased variants using these strategies:

1. SPECIFICITY INJECTION: Add product-matchable details (material, size, use-case, price range) so the query maps to real SKUs.
2. PREFERENCE FRAMING: Reframe as a recommendation/preference request using "best", "which", "recommended".
3. PROBLEM-TO-PRODUCT BRIDGE: Convert problem statements into product-solution queries.
4. COMPARISON TRIGGER: Frame as a product comparison to activate structured comparison UI.
5. USE-CASE ANCHORING: Ground in a specific scenario, persona, or context that implies a purchase decision.
6. CONCISENESS OPTIMIZATION: Distill to ~7 words that describe a specific, shippable product need.
7. CO-CITATION CLUSTER TARGETING: Frame the query so it lands in an established vertical where trusted domains co-cite each other.
8. TURN 1 OPENER FRAMING: Optimize as a conversation-starting query that maximizes citation rate.

Rules:
- Each rewrite should be a natural query a real person would type
- Aim for 5-10 words per rewrite (shopping fan-outs average 7 words)
- Include enough specificity to match real products (SKU-matchable)
- Never mention brands unless the original query does
- Assign each rewrite a strategy label from the list above
- Predict 2-4 product categories that would surface for each rewrite

Return ONLY a JSON array of objects with keys: "query", "strategy", "predicted_categories"

Strategy keys to use: specificity_injection, preference_framing, problem_to_product, comparison_trigger, use_case_anchoring, conciseness_optimization, co_citation_targeting, turn1_opener`;

export interface RewriteVariant {
  query: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  strategy: string;
  predicted_categories: string[];
  citation_cluster: string;
  co_citation_neighbors: string[];
  turn1_optimized: boolean;
}

export interface RewriteResponse {
  original_query: string;
  original_score: number;
  original_breakdown: ScoreBreakdown;
  rewrites: RewriteVariant[];
  metadata: Record<string, string | number>;
}

async function callClaude(query: string, numVariants: number): Promise<Array<{ query: string; strategy: string; predicted_categories: string[] }>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT.replace("{n}", String(numVariants)),
    messages: [{ role: "user", content: `Original query: "${query}"` }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]") + 1;
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end));
    }
    return [];
  }
}

function scoreVariant(rw: { query: string; strategy: string; predicted_categories: string[] }): RewriteVariant {
  const breakdown = scoreQuery(rw.query);
  const cluster = identifyCluster(rw.query);
  const t1 = turn1Score(rw.query);
  return {
    query: rw.query,
    score: breakdown.composite,
    score_breakdown: breakdown,
    strategy: rw.strategy,
    predicted_categories: rw.predicted_categories,
    citation_cluster: cluster.name,
    co_citation_neighbors: cluster.domains,
    turn1_optimized: t1 >= 60,
  };
}

export async function rewrite(query: string, numVariants = 8): Promise<RewriteResponse> {
  const start = Date.now();
  const originalBreakdown = scoreQuery(query);
  const rawRewrites = await callClaude(query, numVariants);
  const variants = rawRewrites.map(scoreVariant).sort((a, b) => b.score - a.score);
  return {
    original_query: query,
    original_score: originalBreakdown.composite,
    original_breakdown: originalBreakdown,
    rewrites: variants,
    metadata: { processing_time_ms: Date.now() - start, model_version: "claude-haiku-4-5-20251001" },
  };
}
