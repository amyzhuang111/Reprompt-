import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { identifyCluster, CO_CITATION_MAP } from "@/lib/scoring/citation-cluster";

export const maxDuration = 60;

const CO_CITATION_PROMPT = `You are an AI Search expert analyzing a brand's content for co-citation cluster positioning.

CONTEXT: Profound's research on 700,000+ ChatGPT conversations found that citations travel in packs — sources appear together in predictable "co-citation clusters":

- Personal Finance: NerdWallet + The Points Guy co-cite at 14% rate. Cluster: NerdWallet, The Points Guy, Bankrate, Credit Karma
- Tech/Electronics: The Verge + TechRadar co-cite at 10%. Cluster: The Verge, TechRadar, Tom's Guide, CNET, Wirecutter
- Health/Wellness: MDPI + NIH co-cite at 7%. Cluster: NIH, WebMD, Mayo Clinic, Healthline
- Home/Lifestyle: Wirecutter + The Spruce co-cite at ~8%. Cluster: Wirecutter, The Spruce, Better Homes & Gardens, HGTV
- Travel: Kayak + Expedia co-cite at ~6%. Cluster: Kayak, Expedia, TripAdvisor, Lonely Planet

Key insight: "Your competition isn't just for visibility. It's for context proximity to the category leader." ChatGPT cites ~4 sources per turn. Brands need to land INSIDE these citation clusters, not displace them.

The citation distribution has a Gini coefficient of 0.8 — top 10 domains capture only 12% of citations. The long tail is massive. Niche brands have a real shot: you don't need to outrank Wikipedia, you need to appear alongside trusted co-citation partners.

Analyze this content and determine:
1. Which co-citation cluster it naturally fits into
2. How well-aligned the content is with cluster expectations
3. What changes would help it appear alongside cluster anchor domains

Score these 5 signals (each 0-100):

1. CLUSTER KEYWORD MATCH: Does the content use the same vocabulary, framing, and topics that cluster anchor domains use? "Best credit cards for travel rewards" matches the finance cluster. "Our innovative financial solutions" doesn't.

2. EDITORIAL VOICE: Is the content written in a way that could be cited alongside editorial/review sites? Factual, specific, balanced tone that invites source triangulation. Not marketing copy.

3. COMPARISON DEPTH: Does the content include comparisons, alternatives, or "vs" framing? ChatGPT's source triangulation behavior (citing ~4 sources per turn) is triggered by comparison queries. Content that facilitates comparison gets cited more.

4. SOURCE TRIANGULATION VALUE: Would ChatGPT gain something by citing this alongside the cluster anchors? Does it provide unique data, a different perspective, or specific product details that complement what NerdWallet/Wirecutter/etc. already cover?

5. VERTICAL AUTHORITY: Does the content demonstrate deep expertise in its vertical? Domain-specific terminology, detailed analysis, original data or insights — the signals that make ChatGPT trust this as a credible source within the cluster.

Return JSON:
{
  "brand_or_product": "detected brand/product name",
  "category": "detected category",
  "primary_cluster": {
    "name": "cluster name (e.g., tech_electronics)",
    "display_name": "display name (e.g., Tech & Electronics)",
    "co_citation_rate": 0.10,
    "anchor_domains": ["domain1", "domain2", "domain3"]
  },
  "alignment_score": 0-100,
  "content_signals": {
    "cluster_keyword_match": {"score": 0-100, "found": "what was detected", "missing": "what should be added"},
    "editorial_voice": {"score": 0-100, "found": "...", "missing": "..."},
    "comparison_depth": {"score": 0-100, "found": "...", "missing": "..."},
    "source_triangulation": {"score": 0-100, "found": "...", "missing": "..."},
    "vertical_authority": {"score": 0-100, "found": "...", "missing": "..."}
  },
  "positioning_recommendations": ["3-5 specific changes to better align with the co-citation cluster"],
  "competitor_domains": ["3-5 domains this content would likely be cited alongside"],
  "target_queries": ["5 queries where this content could appear in a co-citation set"],
  "verdict": "A single sentence summary"
}

Return ONLY valid JSON.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, content } = body;

  let pageContent = content || "";

  if (url && !content) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return NextResponse.json({ error: `Failed to fetch URL (${res.status}). This site blocks automated access. Try pasting the page content directly instead.` }, { status: 400 });
      const html = await res.text();
      pageContent = html
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

  if (!pageContent) return NextResponse.json({ error: "Provide a URL or paste content" }, { status: 400 });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Pre-identify cluster from content for context
    const preCluster = identifyCluster(pageContent);
    const clusterContext = preCluster.name
      ? `\n\nPre-analysis suggests this maps to the "${preCluster.name}" cluster (anchored by: ${preCluster.domains.join(", ")}). Verify or correct this.`
      : "\n\nNo obvious cluster detected from keyword analysis. Determine the best fit based on content analysis.";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: CO_CITATION_PROMPT,
      messages: [{ role: "user", content: `Content to analyze:${clusterContext}\n\n${pageContent}` }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(text);
    } catch {
      const s = text.indexOf("{"), e = text.lastIndexOf("}") + 1;
      analysis = s >= 0 && e > s ? JSON.parse(text.slice(s, e)) : {};
    }

    // Enrich with our co-citation data
    const clusterName = ((analysis.primary_cluster as Record<string, unknown>)?.name as string) || preCluster.name;
    const matchedVertical = CO_CITATION_MAP.verticals.find(v => v.name === clusterName);

    return NextResponse.json({
      brand_or_product: analysis.brand_or_product || "",
      category: analysis.category || "",
      primary_cluster: {
        name: clusterName,
        display_name: ((analysis.primary_cluster as Record<string, unknown>)?.display_name as string) || clusterName.replace(/_/g, " "),
        co_citation_rate: matchedVertical?.co_citation_rate || ((analysis.primary_cluster as Record<string, unknown>)?.co_citation_rate as number) || 0,
        anchor_domains: matchedVertical?.domains || ((analysis.primary_cluster as Record<string, unknown>)?.anchor_domains as string[]) || [],
      },
      alignment_score: analysis.alignment_score || 0,
      content_signals: analysis.content_signals || {},
      positioning_recommendations: analysis.positioning_recommendations || [],
      competitor_domains: analysis.competitor_domains || [],
      target_queries: analysis.target_queries || [],
      verdict: analysis.verdict || "",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
