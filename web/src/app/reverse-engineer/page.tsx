"use client";

import { useState } from "react";

interface QueryResponse {
  query: string;
  response: string;
  response_preview: string;
  brands: string[];
  products: string[];
  urls: string[];
  has_product_recs: boolean;
  recommendation_strength: string;
}

interface BrandRank {
  name: string;
  appearances: number;
  share: number;
}

interface GapAnalysis {
  brand_ranking: BrandRank[];
  user_rank: number | null;
  user_appearances: number;
  competitor_rank: number | null;
  competitor_appearances: number;
  gap_indices: number[];
  gap_count: number;
  total_queries: number;
}

interface ContentPattern {
  signal: string;
  competitor_has: string;
  user_missing: string;
  importance: string;
  why_it_matters?: string;
}

interface ContentAnalysis {
  competitor_strengths: string[];
  user_gaps: string[];
  content_patterns: ContentPattern[];
  citation_likelihood?: {
    user_current: number;
    competitor_current: number;
    explanation: string;
  };
  summary: string;
}

interface ActionItem {
  title: string;
  description: string;
  current_text?: string;
  rewrite?: string;
  impact: string;
  citation_before?: number;
  citation_after?: number;
  target_query: string;
  difficulty: string;
}

type StepStatus = "pending" | "active" | "complete" | "error";

const STEPS = [
  "Generating customer queries",
  "Probing ChatGPT with real queries",
  "Identifying competitive gaps",
  "Fetching cited content",
  "Analyzing why competitor wins",
  "Generating action plan",
  "Measuring unsolicited rec rate",
];

const DEMO_CHIPS = [
  { brand: "Purple", competitor: "Casper", category: "mattresses" },
  { brand: "Jabra Elite", competitor: "Sony WH-1000XM5", category: "noise-cancelling headphones" },
  { brand: "Brooklinen", competitor: "Parachute", category: "luxury bedding" },
];

const IMPACT_STYLES: Record<string, { bg: string; text: string }> = {
  high: { bg: "var(--color-score-high)", text: "var(--color-score-high)" },
  medium: { bg: "var(--color-score-mid)", text: "var(--color-score-mid)" },
  low: { bg: "var(--color-text-muted)", text: "var(--color-text-muted)" },
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Quick win",
  medium: "Moderate effort",
  hard: "Major effort",
};

function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-score-high)";
  if (score >= 40) return "var(--color-score-mid)";
  return "var(--color-score-low)";
}

export default function ReverseEngineerPage() {
  const [brand, setBrand] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Progressive state
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(STEPS.map(() => "pending"));
  const [currentStep, setCurrentStep] = useState(-1);
  const [queries, setQueries] = useState<string[] | null>(null);
  const [responses, setResponses] = useState<QueryResponse[] | null>(null);
  const [gaps, setGaps] = useState<GapAnalysis | null>(null);
  const [fetchedPages, setFetchedPages] = useState<{ label: string; url: string; fetched: boolean }[] | null>(null);
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null);
  const [actions, setActions] = useState<ActionItem[] | null>(null);
  const [unsolicited, setUnsolicited] = useState<{ total: number; triggered: number; rate: number; results: { query: string; has_recs: boolean; products: string[] }[] } | null>(null);

  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

  const updateStep = (idx: number, status: StepStatus) => {
    setStepStatuses((prev) => {
      const next = [...prev];
      next[idx] = status;
      return next;
    });
  };

  const handleSubmit = async (chip?: (typeof DEMO_CHIPS)[0]) => {
    const b = chip?.brand ?? brand;
    const c = chip?.competitor ?? competitor;
    const cat = chip?.category ?? category;
    if (!b.trim() || !c.trim() || !cat.trim()) return;
    if (chip) {
      setBrand(b);
      setCompetitor(c);
      setCategory(cat);
    }

    setLoading(true);
    setError("");
    setQueries(null);
    setResponses(null);
    setGaps(null);
    setFetchedPages(null);
    setAnalysis(null);
    setActions(null);
    setUnsolicited(null);
    setExpandedQuery(null);
    setStepStatuses(STEPS.map(() => "pending"));
    setCurrentStep(0);
    updateStep(0, "active");

    try {
      const res = await fetch("/api/reverse-engineer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: b.trim(), competitor: c.trim(), category: cat.trim() }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.step === "status" && typeof event.stage === "number") {
              const stage = event.stage as number;
              // Mark all previous stages as complete
              for (let s = 0; s < stage; s++) updateStep(s, "complete");
              setCurrentStep(stage);
              updateStep(stage, "active");
            }

            if (event.step === "queries") {
              setQueries(event.queries);
            } else if (event.step === "responses") {
              setResponses(event.results);
            } else if (event.step === "gaps") {
              setGaps(event.gaps);
            } else if (event.step === "content_fetched") {
              setFetchedPages(event.pages || null);
            } else if (event.step === "analysis") {
              setAnalysis(event.analysis);
            } else if (event.step === "recommendations") {
              setActions(event.actions);
            } else if (event.step === "unsolicited") {
              setUnsolicited(event);
            } else if (event.step === "complete") {
              updateStep(5, "complete");
              setCurrentStep(6);
            } else if (event.step === "error") {
              setError(event.message);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const isGapQuery = (idx: number) => gaps?.gap_indices.includes(idx) ?? false;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="pt-8 text-center space-y-3">
        <h1 className="text-[32px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Why does ChatGPT recommend them and not you?
        </h1>
        <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Enter two brands. We probe ChatGPT with real queries, fetch both product pages, and show you exactly what to change.
        </p>
      </div>

      {/* Input */}
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-accent)]">Your Brand</p>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="e.g. Nectar"
              className="w-full rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-accent)]/40"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-low)]">Competitor</p>
            <input
              type="text"
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="e.g. Casper"
              className="w-full rounded-lg border border-[var(--color-score-low)]/30 bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-score-low)]/40"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Category</p>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="e.g. mattresses"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-accent)]/40"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !brand.trim() || !competitor.trim() || !category.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-6 py-3 text-[13px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Running...
              </span>
            ) : (
              "Reverse-Engineer"
            )}
          </button>
        </div>

        {/* Demo chips */}
        <div className="flex flex-wrap gap-2">
          {DEMO_CHIPS.map((chip) => (
            <button
              key={chip.brand}
              onClick={() => handleSubmit(chip)}
              disabled={loading}
              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[12px] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-text-muted)]/40 hover:text-[var(--color-text-secondary)] active:scale-[0.97] disabled:opacity-30"
            >
              {chip.brand} vs {chip.competitor}
            </button>
          ))}
        </div>

        {error && <p className="text-[13px] text-[var(--color-score-low)]">{error}</p>}
      </div>

      {/* Progressive Stepper */}
      {currentStep >= 0 && (
        <div className="mx-auto max-w-md">
          <div className="space-y-0">
            {STEPS.map((label, i) => {
              const status = stepStatuses[i];
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                        status === "complete"
                          ? "border-[var(--color-score-high)] bg-[var(--color-score-high)]"
                          : status === "active"
                            ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                            : status === "error"
                              ? "border-[var(--color-score-low)] bg-[var(--color-score-low)]"
                              : "border-[var(--color-border)] bg-transparent"
                      }`}
                    >
                      {status === "complete" ? (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : status === "active" ? (
                        <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-white/30 border-t-white" />
                      ) : status === "error" ? (
                        <span className="text-[10px] font-bold text-white">!</span>
                      ) : null}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`w-px h-6 transition-colors ${
                          status === "complete" ? "bg-[var(--color-score-high)]" : "bg-[var(--color-border)]"
                        }`}
                      />
                    )}
                  </div>
                  <p
                    className={`pt-0.5 text-[13px] transition-colors ${
                      status === "active"
                        ? "text-[var(--color-text-primary)] font-medium"
                        : status === "complete"
                          ? "text-[var(--color-score-high)]"
                          : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Head-to-Head Summary */}
      {gaps && (() => {
        const userWinning = gaps.gap_count === 0 && gaps.user_appearances >= gaps.competitor_appearances;
        const gapColor = gaps.gap_count > 0 ? "var(--color-score-low)" : "var(--color-score-high)";
        return (
          <div className="mx-auto max-w-3xl space-y-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
              <div className="grid grid-cols-3 items-center text-center">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-accent)]">Your Brand</p>
                  <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">{brand}</p>
                  <p className="text-[36px] font-bold tabular-nums leading-none mt-2" style={{ color: gaps.user_rank ? scoreColor(100 - (gaps.user_rank - 1) * 20) : "var(--color-score-low)" }}>
                    {gaps.user_rank ? `#${gaps.user_rank}` : "N/A"}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    {gaps.user_appearances}/{gaps.total_queries} queries
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--color-text-muted)]">vs</p>
                  <p className="text-[28px] font-bold tabular-nums mt-1" style={{ color: gapColor }}>
                    {gaps.gap_count}
                  </p>
                  <p className="text-[11px]" style={{ color: gapColor }}>
                    {gaps.gap_count === 1 ? "query gap" : "query gaps"}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    {userWinning ? "You\u2019re ahead" : "Competitor wins, you don\u2019t appear"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-low)]">Competitor</p>
                  <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">{competitor}</p>
                  <p className="text-[36px] font-bold tabular-nums leading-none mt-2" style={{ color: gaps.competitor_rank ? scoreColor(100 - (gaps.competitor_rank - 1) * 20) : "var(--color-text-muted)" }}>
                    {gaps.competitor_rank ? `#${gaps.competitor_rank}` : "N/A"}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    {gaps.competitor_appearances}/{gaps.total_queries} queries
                  </p>
                </div>
              </div>
            </div>

            {/* Brand Leaderboard */}
            {gaps.brand_ranking.length > 0 && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">All brands ChatGPT recommended</p>
                  <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">{gaps.brand_ranking.length} brands</span>
                </div>
                <div className="space-y-1.5">
                  {gaps.brand_ranking.slice(0, 8).map((b, i) => {
                    const isUser = b.name.toLowerCase().includes(brand.toLowerCase());
                    const isComp = b.name.toLowerCase().includes(competitor.toLowerCase());
                    const barWidth = Math.max(8, (b.appearances / gaps.total_queries) * 100);
                    return (
                      <div key={b.name} className={`flex items-center gap-3 rounded-md px-3 py-1.5 ${isUser ? "bg-[var(--color-accent)]/[0.06]" : ""}`}>
                        <span className="w-5 shrink-0 text-right text-[12px] font-bold tabular-nums" style={{ color: isUser ? "var(--color-accent-bright)" : i === 0 ? "var(--color-score-high)" : "var(--color-text-muted)" }}>
                          {i + 1}
                        </span>
                        <span className={`w-28 shrink-0 truncate text-[12px] font-medium ${isUser ? "text-[var(--color-accent-bright)]" : isComp ? "text-[var(--color-score-low)]" : "text-[var(--color-text-secondary)]"}`}>
                          {b.name}
                        </span>
                        <div className="flex-1 h-4 rounded bg-white/[0.03] overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${barWidth}%`, backgroundColor: isUser ? "rgba(59,130,246,0.2)" : isComp ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)" }} />
                        </div>
                        <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-text-muted)]">
                          {b.appearances}/{gaps.total_queries}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Query-by-Query Results */}
      {responses && gaps && (
        <div className="mx-auto max-w-3xl space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Query-by-Query Results
          </p>
          <div className="space-y-2">
            {responses.map((r, i) => {
              const isGap = isGapQuery(i);
              const hasBrand = r.brands.some((b) => b.toLowerCase().includes(brand.toLowerCase()));
              const hasComp = r.brands.some((b) => b.toLowerCase().includes(competitor.toLowerCase()));
              const expanded = expandedQuery === i;

              return (
                <div
                  key={i}
                  className={`rounded-lg border transition-colors ${
                    isGap
                      ? "border-[var(--color-score-low)]/30 bg-[var(--color-score-low)]/[0.03]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
                  }`}
                >
                  <button
                    onClick={() => setExpandedQuery(expanded ? null : i)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="w-6 shrink-0 text-center text-[12px] tabular-nums text-[var(--color-text-muted)]">{i + 1}</span>
                    <span className="flex-1 text-[13px] text-[var(--color-text-secondary)]">&ldquo;{r.query}&rdquo;</span>

                    {/* Brand indicators */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: hasBrand ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.1)",
                          color: hasBrand ? "var(--color-accent-bright)" : "var(--color-score-low)",
                          border: `1px solid ${hasBrand ? "rgba(59, 130, 246, 0.3)" : "rgba(239, 68, 68, 0.2)"}`,
                        }}
                      >
                        {hasBrand ? "You" : "Missing"}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: hasComp ? "rgba(239, 68, 68, 0.1)" : "rgba(255,255,255,0.04)",
                          color: hasComp ? "var(--color-score-low)" : "var(--color-text-muted)",
                          border: `1px solid ${hasComp ? "rgba(239, 68, 68, 0.2)" : "var(--color-border)"}`,
                        }}
                      >
                        {hasComp ? "Comp" : "--"}
                      </span>
                    </div>

                    {isGap && (
                      <span className="rounded-full bg-[var(--color-score-low)]/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-[var(--color-score-low)]">
                        GAP
                      </span>
                    )}

                    <svg
                      className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expanded && (
                    <div className="border-t border-[var(--color-border)]/50 px-4 py-3 space-y-3">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Brands Recommended</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {r.brands.length === 0 ? (
                            <span className="text-[12px] text-[var(--color-text-muted)]">No brands detected</span>
                          ) : (
                            r.brands.map((b) => {
                              const isUser = b.toLowerCase().includes(brand.toLowerCase());
                              const isComp = b.toLowerCase().includes(competitor.toLowerCase());
                              return (
                                <span
                                  key={b}
                                  className="rounded-md px-2 py-1 text-[11px] font-medium"
                                  style={{
                                    backgroundColor: isUser ? "rgba(59, 130, 246, 0.15)" : isComp ? "rgba(239, 68, 68, 0.1)" : "rgba(255,255,255,0.04)",
                                    color: isUser ? "var(--color-accent-bright)" : isComp ? "var(--color-score-low)" : "var(--color-text-secondary)",
                                    border: `1px solid ${isUser ? "rgba(59, 130, 246, 0.3)" : isComp ? "rgba(239, 68, 68, 0.2)" : "var(--color-border)"}`,
                                  }}
                                >
                                  {b}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">ChatGPT Response</p>
                        <p className="mt-1.5 rounded-lg border border-[var(--color-border)]/50 bg-[var(--color-bg-secondary)] p-3 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                          {r.response_preview}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fetched Real Pages */}
      {fetchedPages && fetchedPages.length > 0 && (
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Real product pages analyzed
            </p>
            {fetchedPages.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span
                  className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.fetched ? "var(--color-score-high)" : "var(--color-score-low)" }}
                />
                <span className="text-[var(--color-text-secondary)]">{p.label}</span>
                <span className="text-[var(--color-text-muted)] truncate">{p.url}</span>
                <span className={`text-[10px] ${p.fetched ? "text-[var(--color-score-high)]" : "text-[var(--color-score-low)]"}`}>
                  {p.fetched ? "fetched" : "failed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Analysis Diff */}
      {analysis && (
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Why they get recommended and you don&apos;t
          </p>

          {analysis.summary && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{analysis.summary}</p>
            </div>
          )}


          {/* Content patterns */}
          {analysis.content_patterns && analysis.content_patterns.length > 0 && (
            <div className="space-y-3">
              {analysis.content_patterns.map((pattern, i) => {
                const imp = IMPACT_STYLES[pattern.importance] || IMPACT_STYLES.medium;
                return (
                  <div key={i} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest"
                        style={{ backgroundColor: `${imp.bg}15`, color: imp.text, border: `1px solid ${imp.bg}30` }}
                      >
                        {pattern.importance}
                      </span>
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{pattern.signal}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-md bg-[var(--color-score-high)]/[0.04] p-3 border border-[var(--color-score-high)]/10">
                        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-high)] mb-1">Competitor has</p>
                        <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{pattern.competitor_has}</p>
                      </div>
                      <div className="rounded-md bg-[var(--color-score-low)]/[0.04] p-3 border border-[var(--color-score-low)]/10">
                        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-low)] mb-1">You&apos;re missing</p>
                        <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{pattern.user_missing}</p>
                      </div>
                    </div>
                    {pattern.why_it_matters && (
                      <p className="mt-2 text-[11px] text-[var(--color-text-muted)] italic">{pattern.why_it_matters}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Strengths vs Gaps */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {analysis.competitor_strengths && analysis.competitor_strengths.length > 0 && (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-high)]">
                  What competitor does well
                </p>
                {analysis.competitor_strengths.map((s, i) => (
                  <p key={i} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)]">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-score-high)]" />
                    {s}
                  </p>
                ))}
              </div>
            )}
            {analysis.user_gaps && analysis.user_gaps.length > 0 && (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-score-low)]">
                  What you&apos;re likely missing
                </p>
                {analysis.user_gaps.map((g, i) => (
                  <p key={i} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)]">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-score-low)]" />
                    {g}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ranked Action Items */}
      {actions && actions.length > 0 && (
        <div className="mx-auto max-w-3xl space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Action Plan &mdash; ranked by predicted impact
          </p>
          <div className="space-y-2">
            {actions.map((action, i) => {
              const imp = IMPACT_STYLES[action.impact] || IMPACT_STYLES.medium;
              return (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
                  style={{
                    borderLeftWidth: "3px",
                    borderLeftColor: imp.bg,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[14px] font-bold tabular-nums text-[var(--color-text-muted)]">{i + 1}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest"
                      style={{ backgroundColor: `${imp.bg}15`, color: imp.text, border: `1px solid ${imp.bg}30` }}
                    >
                      {action.impact} impact
                    </span>
                    {action.difficulty && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-[var(--color-text-muted)]">
                        {DIFFICULTY_LABEL[action.difficulty] || action.difficulty}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{action.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{action.description}</p>

                  {/* Current text vs Rewrite */}
                  {action.rewrite && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {action.current_text && action.current_text !== "not present" && (
                        <div className="rounded-md bg-[var(--color-score-low)]/[0.04] p-3 border border-[var(--color-score-low)]/10">
                          <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-score-low)] mb-1">Current</p>
                          <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">{action.current_text}</p>
                        </div>
                      )}
                      <div className={`rounded-md bg-[var(--color-score-high)]/[0.04] p-3 border border-[var(--color-score-high)]/10 ${!action.current_text || action.current_text === "not present" ? "sm:col-span-2" : ""}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-score-high)]">
                            {action.current_text && action.current_text !== "not present" ? "Rewrite" : "Add this"}
                          </p>
                          <button
                            onClick={() => { navigator.clipboard.writeText(action.rewrite!); }}
                            className="text-[9px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[var(--color-text-secondary)]">{action.rewrite}</p>
                      </div>
                    </div>
                  )}

                  {action.target_query && (
                    <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                      Targets: &ldquo;{action.target_query}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unsolicited Rec Rate */}
      {unsolicited && unsolicited.total > 0 && (
        <div className="mx-auto max-w-3xl space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Unsolicited Recommendation Rate for &ldquo;{category}&rdquo;
          </p>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-[36px] font-bold tabular-nums" style={{
                  color: unsolicited.rate >= 30 ? "var(--color-score-high)" : unsolicited.rate >= 15 ? "var(--color-score-mid)" : "var(--color-score-low)"
                }}>
                  {unsolicited.rate}%
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {unsolicited.triggered}/{unsolicited.total} informational queries
                </p>
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                  When users ask informational questions about {category}, ChatGPT inserts unsolicited product recommendations {unsolicited.rate}% of the time.
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Profound benchmark: 15-28% overall (per their LinkedIn research on 100k shopping prompts, Sep 2025 → Jan 2026)
                </p>
              </div>
            </div>
            {unsolicited.results.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--color-border)]/50 space-y-1.5">
                {unsolicited.results.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className={`mt-1 inline-block h-2 w-2 rounded-full flex-shrink-0 ${r.has_recs ? "bg-[var(--color-score-high)]" : "bg-[var(--color-border)]"}`} />
                    <span className="text-[var(--color-text-muted)]">&ldquo;{r.query}&rdquo;</span>
                    {r.products.length > 0 && (
                      <span className="text-[var(--color-score-high)]">→ {r.products.join(", ")}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom methodology note */}
      {!loading && !gaps && (
        <div className="mx-auto max-w-3xl rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">What happens when you click</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-center">
            <div className="rounded-md bg-white/[0.03] p-3">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">1. Probe</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Send real queries to ChatGPT with web search. See who gets recommended.</p>
            </div>
            <div className="rounded-md bg-white/[0.03] p-3">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">2. Analyze</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Fetch both brands&apos; real product pages. Compare what the winner has that you don&apos;t.</p>
            </div>
            <div className="rounded-md bg-white/[0.03] p-3">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">3. Fix</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Get specific rewrites you can copy-paste onto your page today.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
