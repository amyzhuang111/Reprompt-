import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { classifyCategory } from "@/lib/scoring";

export const maxDuration = 60;

// ── Binary signal detection: only detect what's present/absent, no scoring ──

function detectSignals(html: string, text: string) {
  const lower = text.toLowerCase();

  return {
    // Structured data: binary detection
    has_jsonld: /<script[^>]*type=["']application\/ld\+json["']/i.test(html),
    has_faq_schema: /faqpage/i.test(html),
    has_product_schema: /"@type"\s*:\s*"Product"/i.test(html),
    has_review_schema: /aggregaterating|"@type"\s*:\s*"Review"/i.test(html),
    has_howto_schema: /"@type"\s*:\s*"HowTo"/i.test(html),
    has_microdata: /itemscope|itemprop/i.test(html),

    // Content structure: counts
    h1_count: (html.match(/<h1[\s>]/gi) || []).length,
    h2_count: (html.match(/<h2[\s>]/gi) || []).length,
    h3_count: (html.match(/<h3[\s>]/gi) || []).length,
    list_items: (html.match(/<li[\s>]/gi) || []).length,
    tables: (html.match(/<table[\s>]/gi) || []).length,
    questions: (text.match(/\?/g) || []).length,

    // Query fanout terms (Profound: LLMs inject "best", "top", "reviews", year into searches)
    has_best: /\bbest\b/i.test(text),
    has_top: /\btop\b/i.test(text),
    has_reviews: /\breview/i.test(text),
    has_2025: /\b2025\b/.test(text),
    has_2026: /\b2026\b/.test(text),
    has_comparison: /\b(vs|versus|comparison|compare)\b/i.test(text),
    has_guide: /\bguide\b/i.test(text),
    has_howto: /\bhow to\b/i.test(text),
    fanout_term_count: [
      /\bbest\b/i, /\btop\b/i, /\breview/i, /\b2025\b/, /\b2026\b/,
      /\b(vs|versus|comparison|compare)\b/i, /\brecommend/i, /\brated\b/i, /\bguide\b/i, /\bhow to\b/i,
    ].filter(r => r.test(lower)).length,

    // Freshness
    current_year_refs: (text.match(new RegExp(`\\b${new Date().getFullYear()}\\b`, "g")) || []).length,
    has_updated: /\b(updated|last updated|as of|current as of)\b/i.test(text),
    has_latest: /\b(latest|newest|new for|just released)\b/i.test(text),
    has_date_meta: /meta[^>]*(?:date|modified|published)[^>]*content/i.test(html),
    has_visible_dates: /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/i.test(text),

    // Content metrics
    word_count: text.split(/\s+/).length,
    has_prices: /\$\d/.test(text),
    has_numbers_with_units: (text.match(/\d+(?:\.\d+)?(?:\s*(?:%|oz|lb|kg|mm|cm|inch|"|ft|hrs?|hours?|days?|watts?|mAh|GB|TB))/g) || []).length,
  };
}

const AUDIT_PROMPT = `You are an AI Search expert scoring a page using Profound's AEO Content Score framework.

Profound's AEO Content Score uses ML trained on millions of top-cited pages. You cannot replicate that model, but you CAN evaluate these 5 dimensions using the same criteria Profound published:

1. SEMANTIC ALIGNMENT: "between the page's core content and prompts you want to optimize" — does this content match how real users would ask AI about this topic?

2. STRUCTURED DATA USAGE: Profound found "certain JSON schemas (like FAQ) are favored over generic article schemas" — check the detected signals below.

3. CONTENT STRUCTURE: Profound measures "heading density, paragraph balance, title length" — check the detected signals below.

4. QUERY FANOUT PATTERNS: Profound found LLMs inject "best", "top", "reviews", year references into their web searches. Does this content contain these terms?

5. RECENCY & FRESHNESS: Profound emphasizes "content remains relevant to fast-evolving AI systems" — check the detected signals below.

IMPORTANT: You are scoring based on Profound's published criteria. Do NOT invent your own criteria.

You have REAL detected signals from the page (these are factual counts, not estimates):
{DETECTED_SIGNALS}

Score each dimension 0-100 based on the detected signals and your analysis of the content. Explain your scoring by referencing the detected signals.

Return JSON:
{
  "product_name": "detected product name",
  "product_category": "detected category",
  "signals": {
    "semantic_alignment": {"score": 0-100, "found": "what matches user prompts", "missing": "what doesn't match", "reasoning": "why this score based on Profound's criteria"},
    "structured_data": {"score": 0-100, "found": "what schema/markup exists", "missing": "what's needed", "reasoning": "why — Profound favors FAQ schema over generic article"},
    "content_structure": {"score": 0-100, "found": "heading/list/table counts", "missing": "structural gaps", "reasoning": "why — Profound measures heading density, paragraph balance"},
    "query_fanout": {"score": 0-100, "found": "which fanout terms present", "missing": "which terms absent", "reasoning": "why — Profound found LLMs inject these terms into searches"},
    "recency_freshness": {"score": 0-100, "found": "freshness signals detected", "missing": "freshness gaps", "reasoning": "why — Profound emphasizes content relevance to fast-evolving AI"}
  },
  "overall_score": 0-100,
  "top_strengths": ["strength 1", "strength 2"],
  "critical_gaps": ["gap 1", "gap 2", "gap 3"],
  "sample_queries": ["3 queries this page could rank for"],
  "one_line_verdict": "single sentence"
}

Return ONLY valid JSON.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, content } = body;

  let rawHtml = "";
  let pageText = content || "";

  if (url && !content) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return NextResponse.json({ error: `Failed to fetch URL (${res.status}). This site blocks automated access. Try pasting the page content directly instead.` }, { status: 400 });
      rawHtml = await res.text();
      pageText = rawHtml
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
    } catch (e) {
      return NextResponse.json({ error: `Could not fetch URL: ${String(e)}` }, { status: 400 });
    }
  }

  if (!pageText) return NextResponse.json({ error: "Provide a URL or paste content" }, { status: 400 });
  if (!rawHtml) rawHtml = pageText;

  // Detect binary signals (factual, no scoring)
  const detected = detectSignals(rawHtml, pageText);
  const cat = classifyCategory(pageText.slice(0, 500));

  const signalsSummary = `
Structured Data:
- JSON-LD present: ${detected.has_jsonld}
- FAQPage schema: ${detected.has_faq_schema}
- Product schema: ${detected.has_product_schema}
- Review/Rating schema: ${detected.has_review_schema}
- HowTo schema: ${detected.has_howto_schema}
- Microdata: ${detected.has_microdata}

Content Structure:
- H1 headings: ${detected.h1_count}
- H2 headings: ${detected.h2_count}
- H3 headings: ${detected.h3_count}
- List items: ${detected.list_items}
- Tables: ${detected.tables}
- Questions (? marks): ${detected.questions}
- Word count: ${detected.word_count}

Query Fanout Terms (Profound: LLMs inject these into searches):
- "best": ${detected.has_best}
- "top": ${detected.has_top}
- "reviews": ${detected.has_reviews}
- "2025": ${detected.has_2025}
- "2026": ${detected.has_2026}
- "vs/comparison": ${detected.has_comparison}
- "guide": ${detected.has_guide}
- "how to": ${detected.has_howto}
- Total fanout terms found: ${detected.fanout_term_count}/10

Freshness:
- Current year references: ${detected.current_year_refs}
- "Updated/as of" language: ${detected.has_updated}
- "Latest/newest" language: ${detected.has_latest}
- Date metadata in HTML: ${detected.has_date_meta}
- Visible dates in text: ${detected.has_visible_dates}

Other:
- Has prices ($): ${detected.has_prices}
- Numbers with units: ${detected.has_numbers_with_units}
`.trim();

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = AUDIT_PROMPT.replace("{DETECTED_SIGNALS}", signalsSummary);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: prompt,
      messages: [{ role: "user", content: `Page content (first 6000 chars):\n\n${pageText.slice(0, 6000)}` }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(text);
    } catch {
      const s = text.indexOf("{"), e = text.lastIndexOf("}") + 1;
      analysis = s >= 0 && e > s ? JSON.parse(text.slice(s, e)) : {};
    }

    const productName = (analysis.product_name as string) || "";

    return NextResponse.json({
      url: url || null,
      product_name: productName,
      product_category: (analysis.product_category as string) || cat.displayName,
      shopping_base_rate: cat.baseRate,
      amazon_test: cat.baseRate >= 30 ? "PASS" : "FAIL",
      signals: analysis.signals || {},
      detected_signals: detected,
      overall_score: analysis.overall_score || 0,
      top_strengths: analysis.top_strengths || [],
      critical_gaps: analysis.critical_gaps || [],
      sample_queries: analysis.sample_queries || [],
      one_line_verdict: analysis.one_line_verdict || "",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
