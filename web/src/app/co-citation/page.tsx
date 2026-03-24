"use client";

import { useState } from "react";

interface SignalDetail {
  score: number;
  found: string;
  missing: string;
}

interface CoCitationResult {
  brand_or_product: string;
  category: string;
  primary_cluster: {
    name: string;
    display_name: string;
    co_citation_rate: number;
    anchor_domains: string[];
  };
  alignment_score: number;
  content_signals: Record<string, SignalDetail>;
  positioning_recommendations: string[];
  competitor_domains: string[];
  target_queries: string[];
  verdict: string;
}

const SIGNAL_LABELS: Record<string, string> = {
  cluster_keyword_match: "Cluster Keyword Match",
  editorial_voice: "Editorial Voice",
  comparison_depth: "Comparison Depth",
  source_triangulation: "Source Triangulation Value",
  vertical_authority: "Vertical Authority",
};

const SIGNAL_WHY: Record<string, string> = {
  cluster_keyword_match: "Using the same vocabulary as cluster anchors signals to ChatGPT that your content belongs in the same citation set.",
  editorial_voice: "Factual, balanced content gets cited alongside editorial sites. Marketing copy gets ignored.",
  comparison_depth: "ChatGPT cites ~4 sources per turn when answering comparison queries. Comparison-ready content gets more citation slots.",
  source_triangulation: "ChatGPT triangulates sources. Your content needs to add something the cluster anchors don't already cover.",
  vertical_authority: "Deep domain expertise signals that you're a credible source within the cluster, not a generic page.",
};

const CLUSTER_DISPLAY: Record<string, { color: string; icon: string }> = {
  personal_finance: { color: "#22c55e", icon: "$" },
  tech_electronics: { color: "#3b82f6", icon: "T" },
  health_wellness: { color: "#ef4444", icon: "+" },
  home_lifestyle: { color: "#eab308", icon: "H" },
  travel: { color: "#8b5cf6", icon: "P" },
};

function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-score-high)";
  if (score >= 40) return "var(--color-score-mid)";
  return "var(--color-score-low)";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Well-aligned";
  if (score >= 40) return "Partially aligned";
  return "Misaligned";
}

export default function CoCitationPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoCitationResult | null>(null);
  const [error, setError] = useState("");

  const isUrl = (s: string) => /^https?:\/\//.test(s.trim());

  const handleAnalyze = async () => {
    const val = input.trim();
    if (!val) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/co-citation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: isUrl(val) ? val : undefined, content: isUrl(val) ? undefined : val }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const clusterStyle = result ? CLUSTER_DISPLAY[result.primary_cluster.name] || { color: "#6b7280", icon: "?" } : null;

  return (
    <div className="space-y-10">
      <div className="pt-8 text-center space-y-4">
        <h1 className="text-[32px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Co-Citation Cluster Positioner
        </h1>
        <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Citations travel in packs. Find your cluster and get{" "}
          <span className="text-[var(--color-text-primary)] font-medium">cited alongside the right sources</span>
        </p>
        <p className="mx-auto max-w-xl text-[13px] text-[var(--color-text-muted)]">
          &ldquo;Your competition isn&apos;t just for visibility. It&apos;s for context proximity to the category leader.&rdquo;
          &mdash; Profound, 700k conversation study
        </p>
      </div>

      {/* Cluster Map Preview */}
      <div className="mx-auto max-w-3xl">
        <div className="grid grid-cols-5 gap-2">
          {[
            { name: "Finance", rate: "14%", pair: "NerdWallet + Points Guy", color: "#22c55e" },
            { name: "Tech", rate: "10%", pair: "The Verge + TechRadar", color: "#3b82f6" },
            { name: "Home", rate: "8%", pair: "Wirecutter + The Spruce", color: "#eab308" },
            { name: "Health", rate: "7%", pair: "MDPI + NIH", color: "#ef4444" },
            { name: "Travel", rate: "6%", pair: "Kayak + Expedia", color: "#8b5cf6" },
          ].map((c) => (
            <div
              key={c.name}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-center"
            >
              <p className="text-[18px] font-bold tabular-nums" style={{ color: c.color }}>
                {c.rate}
              </p>
              <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">{c.name}</p>
              <p className="text-[9px] text-[var(--color-text-muted)] mt-1">{c.pair}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--color-text-muted)]">
          Top co-citation pair rates by vertical &mdash; Profound
        </p>
      </div>

      {/* Input */}
      <div className="mx-auto max-w-2xl space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a product/brand page URL or content to analyze cluster positioning..."
          rows={3}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-accent)]/40 resize-y"
          disabled={loading}
        />
        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-6 py-3 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analyzing...
              </span>
            ) : (
              "Analyze Cluster Position"
            )}
          </button>
          <button
            onClick={() =>
              setInput(
                "The Wirecutter Best Mattresses of 2026 — After 1,200+ hours of research and testing 85 mattresses, our top pick is the Leesa Sapira Hybrid. It offers excellent pressure relief for side sleepers (measured via body mapping), strong edge support, and sleeps cooler than most foam options. At $1,199 for a queen, it's mid-range priced. Runner-up: Casper Original ($1,095). Budget pick: Nectar Premier ($899). We tested firmness on a 1-10 scale, measured motion transfer with a seismograph, and tracked temperature with thermal sensors over 14 nights."
              )
            }
            disabled={loading}
            className="rounded-lg border border-[var(--color-border)] px-4 py-3 text-[13px] text-[var(--color-text-muted)] transition-all hover:text-[var(--color-text-secondary)] disabled:opacity-30"
          >
            Try example
          </button>
        </div>
        {error && <p className="text-[13px] text-[var(--color-score-low)]">{error}</p>}
      </div>

      {/* Results */}
      {result && clusterStyle && (
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Cluster Card */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-3 flex-1 pr-6">
                <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{result.verdict}</p>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[14px] font-bold text-white"
                    style={{ backgroundColor: clusterStyle.color }}
                  >
                    {clusterStyle.icon}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                      {result.primary_cluster.display_name}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {(result.primary_cluster.co_citation_rate * 100).toFixed(0)}% co-citation rate
                    </p>
                  </div>
                </div>
                {result.brand_or_product && (
                  <span className="inline-block rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    {result.brand_or_product}
                  </span>
                )}
              </div>
              <div className="text-center">
                <span
                  className="text-[40px] font-bold tabular-nums leading-none"
                  style={{ color: scoreColor(result.alignment_score) }}
                >
                  {result.alignment_score}
                </span>
                <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                  {scoreLabel(result.alignment_score)}
                </p>
              </div>
            </div>
          </div>

          {/* Anchor Domains */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Cluster Anchor Domains — who you need to appear alongside
            </p>
            <div className="flex flex-wrap gap-2">
              {result.primary_cluster.anchor_domains.map((d) => (
                <span
                  key={d}
                  className="rounded-md px-3 py-1.5 text-[12px] font-medium"
                  style={{
                    backgroundColor: `${clusterStyle.color}15`,
                    color: clusterStyle.color,
                    border: `1px solid ${clusterStyle.color}30`,
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              ChatGPT cites ~4 sources per turn. These are the domains your content should appear alongside in this vertical.
            </p>
          </div>

          {/* Likely Co-Citation Partners */}
          {result.competitor_domains.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Likely co-citation partners for your content
              </p>
              <div className="flex flex-wrap gap-2">
                {result.competitor_domains.map((d) => (
                  <span
                    key={d}
                    className="rounded-md border border-[var(--color-border)] bg-white/[0.03] px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)]"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Signal Cards */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              5 Cluster Alignment Signals
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(result.content_signals).map(([key, signal]) => (
                <div key={key} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{SIGNAL_LABELS[key] || key}</p>
                    <span className="text-[15px] font-bold tabular-nums" style={{ color: scoreColor(signal.score) }}>
                      {signal.score}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full" style={{ width: `${signal.score}%`, backgroundColor: scoreColor(signal.score) }} />
                  </div>
                  {signal.found && (
                    <p className="text-[11px] text-[var(--color-score-high)]/80">
                      <span className="font-medium text-[var(--color-score-high)]">Found:</span> {signal.found}
                    </p>
                  )}
                  {signal.missing && (
                    <p className="text-[11px] text-[var(--color-score-mid)]/80">
                      <span className="font-medium text-[var(--color-score-mid)]">Add:</span> {signal.missing}
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--color-text-muted)]/60">{SIGNAL_WHY[key]}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Target Queries */}
          {result.target_queries.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Queries where you could appear in a co-citation set
              </p>
              {result.target_queries.map((q, i) => (
                <p key={i} className="text-[12px] text-[var(--color-text-secondary)]">
                  {i + 1}. &ldquo;{q}&rdquo;
                </p>
              ))}
            </div>
          )}

          {/* Positioning Recommendations */}
          {result.positioning_recommendations.length > 0 && (
            <div className="rounded-xl border border-[var(--color-score-mid)]/20 bg-[var(--color-score-mid)]/[0.03] p-5 space-y-3">
              <p className="text-[12px] font-medium uppercase tracking-widest text-[var(--color-score-mid)]">
                How to better align with this cluster
              </p>
              {result.positioning_recommendations.map((rec, i) => (
                <p key={i} className="flex items-start gap-2 text-[13px] text-[var(--color-text-secondary)]">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-score-mid)] flex-shrink-0" />
                  {rec}
                </p>
              ))}
            </div>
          )}

          {/* Gini Insight */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">The Long Tail Opportunity</p>
            <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              The citation distribution has a <span className="text-[var(--color-text-secondary)]">Gini coefficient of 0.8</span> — the top 10 domains capture only 12% of all citations. The remaining 88% is split across hundreds of thousands of domains.
              Unlike Google (where top 3 results capture ~60% of clicks), AI search is radically more open. You don&apos;t need to outrank Wikipedia — you need to appear <span className="text-[var(--color-text-secondary)]">alongside</span> trusted co-citation partners.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
