import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

// ── Binary signal detection only — no scoring, no invented weights ──

function detectSignals(text: string) {
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;

  return {
    word_count: wordCount,
    questions: (text.match(/\?/g) || []).length,
    bullet_lines: (text.match(/^[\s]*[-•*→]\s/gm) || []).length,
    numbered_lines: (text.match(/^[\s]*\d+[.)]\s/gm) || []).length,
    headers: (text.match(/^(?:\*\*[^*]+\*\*|#{1,3}\s)/gm) || []).length,
    paragraphs: text.split(/\n\s*\n/).filter(p => p.trim().length > 10).length,
    hashtags: (text.match(/#\w+/g) || []).length,
    mentions: (text.match(/@\w+/g) || []).length,
    urls: (text.match(/https?:\/\/\S+/g) || []).length,
    timestamps: (text.match(/\d{1,2}:\d{2}/g) || []).length,
    numbers_with_units: (text.match(/\$[\d,.]+|\d+(?:\.\d+)?(?:\s*(?:%|x|hrs?|hours?|days?|weeks?|months?|years?|times?))/g) || []).length,
    named_products: (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []).filter(e => e.length > 5).length,
    has_year: /\b202[5-9]\b/.test(text),
    has_personal_exp: /\b(I've been|I used|I bought|I tried|my experience|I switched|for \d+ (?:months?|years?))\b/i.test(text),
    has_solution_language: (lower.match(/\b(here's|I found|solution|what worked|ended up|figured out|solved|fixed|try this|you can|you should)\b/g) || []).length,
    has_comparison: /\b(vs|versus|compared|better than|worse than|alternative)\b/i.test(text),
    has_honest_tone: (lower.match(/\b(however|downside|con|issue|caveat|honestly|that said|not perfect|could be better)\b/g) || []).length,
    has_sales_language: (lower.match(/\b(amazing|incredible|game changer|buy now|check out|subscribe|discount|promo|affiliate)\b/g) || []).length,
    has_data_claims: (text.match(/\d+(?:\.\d+)?%|\$[\d,.]+|\d+(?:,\d+)?\+?\s*(?:users?|customers?|responses|conversations)/g) || []).length,
    has_credentials: /\b(years? of experience|as a|I lead|I manage|I built|at \w+ (?:we|our))\b/i.test(text),
  };
}

// Platform-specific research context
const PLATFORM_RESEARCH: Record<string, string> = {
  reddit: `PUBLISHED RESEARCH FINDINGS ON REDDIT (from 4B citations + 300M responses):
- Reddit is #1 most-cited domain across all AI models (3.11%)
- 99% of citations are individual threads, NOT subreddit pages
- "AI does NOT index for upvotes or karma. It's a quality contest, not a popularity one."
- "Models seek semiotic cues of helpfulness"
- "The most impactful content follows a question-response framework: specific problem followed by direct solutions"
- "Balanced, honest perspectives": positive brand sentiment (5%) ≈ negative (6.1%). AI seeks authenticity, not praise.
- "Models prioritize genuine, conversational language and filter out sales-y content"
- Average cited post is ONE YEAR OLD — "AI builds a durable, long-term knowledge base"
- Niche subreddits treated as Subject Matter Experts (r/whatcarshouldIbuy, r/BuyItForLife)
- For purchase intent, AI often prioritizes niche subreddits OVER official brand sites

Score these Reddit-specific signals based on published research:
1. QUESTION-RESPONSE FRAMEWORK: Does this follow "specific problem → direct solutions"?
2. HELPFULNESS SIGNALS: Specific details, named products, concrete advice, personal experience with outcomes
3. AUTHENTIC TONE: Genuine/conversational vs sales-y? Balanced/honest vs pure praise?
4. SPECIFICITY & DETAIL: Named products, prices, measurements, comparison data, personal experience
5. EVERGREEN VALUE: Will this still be useful in 12 months? (avg cited post = 1 year old)`,

  linkedin: `PUBLISHED RESEARCH FINDINGS ON LINKEDIN (from 1.4M citations across 6 AI platforms):
- LinkedIn is #1 most-cited domain for professional queries across ALL 6 AI platforms
- LinkedIn rose from #11 to #5 on ChatGPT in 3 months (Nov 2025 → Feb 2026)
- Posts + articles grew from 27% to 35% of all LinkedIn citations (profiles declining: 34% → 15%)
- "Posting cadence now matters as much as profile completeness"
- AI engines "increasingly draw from on-platform published content" over profile pages
- "Posts should be treated as a citation surface, not just engagement content"

Score these LinkedIn-specific signals based on published research:
1. PUBLISHED CONTENT VALUE: Is this substantive published content AI could cite? (posts+articles = 35% of citations)
2. PROFESSIONAL AUTHORITY: Does this demonstrate professional expertise? (LinkedIn = #1 for professional queries)
3. DATA & SPECIFICITY: Specific numbers, data, research references? (data-backed claims drive citation)
4. CITATION-EXTRACTABLE FORMAT: Can AI extract a clean snippet? Structured, scannable?
5. POSTING CADENCE FIT: Does this contribute to consistent posting? ("cadence matters as much as profile completeness")`,

  youtube: `PUBLISHED RESEARCH FINDINGS ON YOUTUBE (from ~700K social platform citations):
- 85.4% of YouTube citations are SPECIFIC VIDEOS (channels: 5.3%, playlists: 3.4%)
- "Channel-level authority matters less than individual video optimization"
- "Title, description, and content structure drive citations"
- YouTube is #1 on Gemini (18.8% of top-10 citations)
- YouTube = 13.9% of Perplexity top-10 citations
- YouTube is NOT in ChatGPT's top 10 cited domains
- Different AI platforms treat YouTube very differently

Score these YouTube-specific signals based on published research:
1. VIDEO-LEVEL OPTIMIZATION: Title clarity, description depth (85.4% of citations = specific videos)
2. DESCRIPTION STRUCTURE: Timestamps, sections, key takeaways (title+description = citation surface)
3. SEARCHABLE SPECIFICITY: Specific products, specs, comparisons (matches AI search queries)
4. CROSS-PLATFORM APPEAL: Optimized for Gemini (#1) and Perplexity, not just ChatGPT
5. STANDALONE DESCRIPTION VALUE: Can AI cite the description without watching?`,
};

const SIGNAL_LABELS: Record<string, Record<string, string>> = {
  reddit: {
    question_response: "Question-Response Framework",
    helpfulness: "Helpfulness Signals",
    authentic_tone: "Authentic Tone",
    specificity_detail: "Specificity & Detail",
    evergreen_value: "Evergreen Value",
  },
  linkedin: {
    published_content_value: "Published Content Value",
    professional_authority: "Professional Authority",
    data_specificity: "Data & Specificity",
    citation_extractable: "Citation-Extractable Format",
    posting_cadence: "Posting Cadence Fit",
  },
  youtube: {
    video_optimization: "Video-Level Optimization",
    description_structure: "Description Structure",
    searchable_specificity: "Searchable Specificity",
    cross_platform_appeal: "Cross-Platform Appeal",
    standalone_value: "Standalone Description Value",
  },
};

const SIGNAL_WHY: Record<string, Record<string, string>> = {
  reddit: {
    question_response: "Research: \"The most impactful content follows a specific problem followed by direct solutions.\"",
    helpfulness: "Research: \"AI does NOT index for upvotes or karma. Models seek semiotic cues of helpfulness.\"",
    authentic_tone: "Research: \"Models prioritize genuine, conversational language and filter out sales-y content.\"",
    specificity_detail: "Research: Threads with \"detailed answers, personal experience, product comparisons\" get cited.",
    evergreen_value: "Research: \"Average cited post is one year old. AI builds a durable, long-term knowledge base.\"",
  },
  linkedin: {
    published_content_value: "Research: Posts + articles grew from 27% to 35% of all LinkedIn citations.",
    professional_authority: "Research: LinkedIn is #1 most-cited domain for professional queries across ALL 6 AI platforms.",
    data_specificity: "Posts with specific stats and original research get cited more frequently.",
    citation_extractable: "AI needs to extract a clean, citable snippet from structured content.",
    posting_cadence: "Research: \"Posting cadence now matters as much as profile completeness.\"",
  },
  youtube: {
    video_optimization: "Research: \"85.4% of citations are specific videos. Channel authority matters less than individual video optimization.\"",
    description_structure: "Research: \"Title, description, and content structure drive citations.\"",
    searchable_specificity: "Research: YouTube citations go to specific, searchable videos with detailed content.",
    cross_platform_appeal: "Research: YouTube is #1 on Gemini (18.8% of top-10), strong on Perplexity (13.9%), weak on ChatGPT.",
    standalone_value: "AI cites descriptions without watching. Self-contained descriptions are independently valuable.",
  },
};

const AUDIT_PROMPT = `You are scoring social media content for AI citation potential using ONLY published research findings. Do NOT invent criteria — use only what published research has established.

{PLATFORM_RESEARCH}

You have REAL detected signals from the content (factual counts):
{DETECTED_SIGNALS}

Score each signal 0-100 based on the detected data and published research findings. Reference the specific research finding that justifies each score.

IMPORTANT: Use EXACTLY these signal keys in your response (they must match exactly):
{SIGNAL_KEYS}

Return JSON:
{
  "platform_insights": "platform-specific insight from research data",
  "signals": {
    "exact_signal_key_from_above": {"score": 0-100, "found": "what's present", "improve": "what to add", "reasoning": "which research finding justifies this score"}
  },
  "overall_score": 0-100,
  "verdict": "one sentence",
  "sentence_analysis": [
    {"original": "exact sentence", "assessment": "strong|weak|neutral", "reason": "based on research findings", "rewrite": "improved version or null"}
  ],
  "cross_platform": {
    "chatgpt": {"relevance": "high|medium|low", "note": "based on platform citation data"},
    "gemini": {"relevance": "high|medium|low", "note": "..."},
    "perplexity": {"relevance": "high|medium|low", "note": "..."}
  },
  "top_improvements": ["1","2","3"],
  "example_queries": ["1","2","3"],
  "optimized_version": "fully rewritten version"
}

Return ONLY valid JSON.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { content, platform } = body;
  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });
  if (!platform || !["linkedin", "reddit", "youtube"].includes(platform))
    return NextResponse.json({ error: "platform must be linkedin, reddit, or youtube" }, { status: 400 });

  const detected = detectSignals(content);
  const signalsSummary = Object.entries(detected)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const signalKeys = Object.keys(SIGNAL_LABELS[platform]).join(", ");
  const prompt = AUDIT_PROMPT
    .replace("{PLATFORM_RESEARCH}", PLATFORM_RESEARCH[platform])
    .replace("{DETECTED_SIGNALS}", signalsSummary)
    .replace("{SIGNAL_KEYS}", signalKeys);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: prompt,
      messages: [{ role: "user", content: `Content to audit:\n\n${content}` }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(text);
    } catch {
      const s = text.indexOf("{"), e = text.lastIndexOf("}") + 1;
      analysis = s >= 0 && e > s ? JSON.parse(text.slice(s, e)) : {};
    }

    return NextResponse.json({
      platform,
      platform_insights: analysis.platform_insights || "",
      signals: analysis.signals || {},
      signal_labels: SIGNAL_LABELS[platform],
      signal_why: SIGNAL_WHY[platform],
      detected_signals: detected,
      overall_score: analysis.overall_score || 0,
      verdict: analysis.verdict || "",
      sentence_analysis: analysis.sentence_analysis || [],
      citation_likelihood: analysis.citation_likelihood || null,
      cross_platform: analysis.cross_platform || null,
      top_improvements: (analysis.top_improvements as string[]) || [],
      example_queries: (analysis.example_queries as string[]) || [],
      optimized_version: (analysis.optimized_version as string) || "",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
