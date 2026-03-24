"use client";

import { useState } from "react";

type Platform = "linkedin" | "reddit" | "youtube";

interface SignalDetail {
  score: number;
  found: string;
  improve: string;
  reasoning?: string;
}

interface SentenceAnalysis {
  original: string;
  assessment: string;
  reason: string;
  rewrite: string | null;
}

interface CrossPlatform {
  chatgpt: { relevance: string; note: string };
  gemini: { relevance: string; note: string };
  perplexity: { relevance: string; note: string };
}

interface SocialAuditResult {
  platform: Platform;
  platform_insights: string;
  signals: Record<string, SignalDetail>;
  signal_labels?: Record<string, string>;
  signal_why?: Record<string, string>;
  overall_score: number;
  verdict: string;
  sentence_analysis?: SentenceAnalysis[];
  citation_likelihood?: { before: number; after: number; explanation: string };
  cross_platform?: CrossPlatform;
  top_improvements: string[];
  example_queries: string[];
  optimized_version: string;
}

const SIGNAL_LABELS: Record<string, string> = {
  semantic_alignment: "Semantic Alignment",
  structured_data: "Structured Data",
  content_structure: "Content Structure",
  query_fanout: "Query Fanout Optimization",
  recency_freshness: "Recency & Freshness",
};

const PLATFORM_CONFIG: Record<
  Platform,
  { label: string; stat: string; letter: string; placeholder: string; example: string; research: string }
> = {
  linkedin: {
    label: "LinkedIn",
    stat: "#5 on ChatGPT \u00B7 Posts = 25% of citations",
    letter: "in",
    placeholder: "Paste your LinkedIn post draft...",
    example:
      "Excited to share that we've been working on something big! Can't wait for everyone to see what we've built. More details coming soon. #innovation #startup",
    research:
      "LinkedIn jumped from #11 to #5 on ChatGPT\u2019s most-cited domains. Posts and profiles are tied at ~25% each of all LinkedIn citations. Company pages trail at 18%. Posts, articles, and newsletters account for 35% of all LinkedIn citations. AI cites LinkedIn when it finds specific expertise, data-backed claims, and actionable industry analysis.",
  },
  reddit: {
    label: "Reddit",
    stat: "2-3% of ALL citations \u00B7 99% individual threads",
    letter: "r/",
    placeholder: "Paste your Reddit post or comment...",
    example: "I've been looking for a good mattress and can't decide. Any suggestions?",
    research:
      "Reddit captures 2-3% of ALL ChatGPT citations \u2014 a remarkable share for a single platform. 99% of those citations are individual threads, not subreddit pages. What gets cited: detailed answers with specific information, personal experience with named products, comparison breakdowns, and troubleshooting steps with clear outcomes.",
  },
  youtube: {
    label: "YouTube",
    stat: "85% specific videos \u00B7 Platform behavior varies",
    letter: "YT",
    placeholder: "Paste your video title and description...",
    example: "NEW VIDEO | Check this out!",
    research:
      "85% of ChatGPT\u2019s YouTube citations point to specific videos, not channel pages. Citation patterns differ dramatically by AI platform: ChatGPT favors established creators (median 8,991 views, median 47,100 subscribers), while Gemini favors long-tail creators (median 4,394 views) \u2014 prioritizing relevance over popularity.",
  },
};

function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-score-high)";
  if (score >= 40) return "var(--color-score-mid)";
  return "var(--color-score-low)";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Needs work";
  return "Weak";
}

export default function SocialAuditPage() {
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SocialAuditResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleAudit = async () => {
    const val = content.trim();
    if (!val) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/social-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: val, platform }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Audit failed");
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const config = PLATFORM_CONFIG[platform];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="pt-8 text-center space-y-3">
        <h1 className="text-[32px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Social Content Optimizer
        </h1>
        <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Paste your post. Get an AI-optimized rewrite that&apos;s more likely to be cited by ChatGPT, Gemini, and Perplexity.
        </p>
      </div>

      {/* Platform Selector */}
      <div className="mx-auto max-w-3xl">
        <div className="grid grid-cols-3 gap-3">
          {(["linkedin", "reddit", "youtube"] as Platform[]).map((p) => {
            const c = PLATFORM_CONFIG[p];
            const selected = platform === p;
            return (
              <button
                key={p}
                onClick={() => {
                  setPlatform(p);
                  setResult(null);
                  setError("");
                }}
                className={`rounded-lg border p-4 text-left transition-all ${
                  selected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-glow)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)]"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-bold ${
                      selected ? "bg-[var(--color-accent)] text-white" : "bg-white/[0.08] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {c.letter}
                  </div>
                  <span
                    className={`text-[14px] font-semibold ${
                      selected ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {c.label}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">{c.stat}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Input */}
      <div className="mx-auto max-w-2xl space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={config.placeholder}
          rows={6}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-accent)]/40 resize-y"
          disabled={loading}
        />
        <div className="flex gap-2">
          <button
            onClick={handleAudit}
            disabled={loading || !content.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-6 py-3 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Auditing...
              </span>
            ) : (
              "Audit Content"
            )}
          </button>
          <button
            onClick={() => setContent(config.example)}
            disabled={loading}
            className="rounded-lg border border-[var(--color-border)] px-4 py-3 text-[13px] text-[var(--color-text-muted)] transition-all hover:text-[var(--color-text-secondary)] disabled:opacity-30"
          >
            Try Example
          </button>
        </div>
        {error && <p className="text-[13px] text-[var(--color-score-low)]">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="mx-auto max-w-3xl space-y-6">

          {/* SECTION 1: The Rewrite (most valuable output — shown first) */}
          {result.optimized_version && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                  Here&apos;s what to post instead
                </p>
                <button
                  onClick={() => handleCopy(result.optimized_version)}
                  className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-[11px] font-medium text-white transition-all hover:opacity-90"
                >
                  {copied ? "Copied!" : "Copy to clipboard"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.03] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-low)] mb-2">
                    Your original
                  </p>
                  <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)] whitespace-pre-wrap">
                    {content}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.03] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-high)] mb-2">
                    Optimized for AI citation
                  </p>
                  <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {result.optimized_version}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: Score + Verdict */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1 pr-6">
                <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{result.verdict}</p>
                {result.platform_insights && (
                  <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">{result.platform_insights}</p>
                )}
              </div>
              <div className="text-center flex-shrink-0">
                <span className="text-[40px] font-bold tabular-nums leading-none" style={{ color: scoreColor(result.overall_score) }}>
                  {result.overall_score}
                </span>
                <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                  {scoreLabel(result.overall_score)}
                </p>
              </div>
            </div>
          </div>

          {/* Signal Cards */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              5 AEO Content Dimensions
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(result.signals).map(([key, signal]) => (
                <div
                  key={key}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                      {result.signal_labels?.[key] || SIGNAL_LABELS[key] || key}
                    </p>
                    <span
                      className="text-[15px] font-bold tabular-nums"
                      style={{ color: scoreColor(signal.score) }}
                    >
                      {signal.score}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${signal.score}%`, backgroundColor: scoreColor(signal.score) }}
                    />
                  </div>
                  {signal.found && (
                    <p className="text-[11px] text-[var(--color-score-high)]/80">
                      <span className="font-medium text-[var(--color-score-high)]">Found:</span> {signal.found}
                    </p>
                  )}
                  {signal.improve && (
                    <p className="text-[11px] text-[var(--color-score-mid)]/80">
                      <span className="font-medium text-[var(--color-score-mid)]">Improve:</span> {signal.improve}
                    </p>
                  )}
                  {result.signal_why?.[key] && (
                    <p className="text-[10px] text-[var(--color-text-muted)]/60 italic">{result.signal_why[key]}</p>
                  )}
                  {signal.reasoning && (
                    <p className="mt-1 text-[10px] text-[var(--color-text-muted)]/60">{signal.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Top Improvements */}
          {result.top_improvements && result.top_improvements.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-mid)]">
                Top Improvements
              </p>
              {result.top_improvements.map((imp, i) => (
                <p key={i} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)]">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-score-mid)]" />
                  {imp}
                </p>
              ))}
            </div>
          )}

          {/* Sentence-Level Analysis */}
          {result.sentence_analysis && result.sentence_analysis.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Sentence-level breakdown
              </p>
              <div className="space-y-2">
                {result.sentence_analysis.map((s, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${
                      s.assessment === "strong"
                        ? "border-[var(--color-score-high)]/20 bg-[var(--color-score-high)]/[0.03]"
                        : s.assessment === "weak"
                          ? "border-[var(--color-score-low)]/20 bg-[var(--color-score-low)]/[0.03]"
                          : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 inline-block h-2 w-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            s.assessment === "strong" ? "var(--color-score-high)"
                            : s.assessment === "weak" ? "var(--color-score-low)"
                            : "var(--color-text-muted)",
                        }}
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-[12px] text-[var(--color-text-secondary)]">&ldquo;{s.original}&rdquo;</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{s.reason}</p>
                        {s.rewrite && (
                          <div className="mt-1 rounded-md bg-[var(--color-score-high)]/[0.05] border border-[var(--color-score-high)]/10 p-2">
                            <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-score-high)] mb-0.5">Rewrite</p>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">&ldquo;{s.rewrite}&rdquo;</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* Cross-Platform Comparison */}
          {result.cross_platform && (
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Cross-platform relevance (based on Profound&apos;s platform citation data)
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(["chatgpt", "gemini", "perplexity"] as const).map((p) => {
                  const data = result.cross_platform![p];
                  const relevanceColor = data.relevance === "high" ? "var(--color-score-high)" : data.relevance === "medium" ? "var(--color-score-mid)" : "var(--color-score-low)";
                  return (
                    <div key={p} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-center">
                      <p className="text-[11px] font-medium text-[var(--color-text-secondary)] capitalize">{p}</p>
                      <p className="text-[14px] font-bold mt-1 uppercase" style={{ color: relevanceColor }}>
                        {data.relevance}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{data.note}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Queries */}
          {result.example_queries && result.example_queries.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Queries that could cite this content
              </p>
              {result.example_queries.map((q, i) => (
                <p key={i} className="text-[12px] text-[var(--color-text-secondary)]">
                  {i + 1}. &ldquo;{q}&rdquo;
                </p>
              ))}
            </div>
          )}


          {/* Platform Research Note */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Platform Research
            </p>
            <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              {PLATFORM_CONFIG[result.platform].research}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]/60">
              Source: Jasman Singh / Profound &mdash; analysis of 400M+ real AI conversations
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
